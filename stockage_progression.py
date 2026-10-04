# Fichier : stockage_progression.py
#
# Ce fichier gère tout ce qui touche à la progression des utilisateurs dans
# la base PostgreSQL hébergée sur Supabase : enregistrer une leçon vue ou un
# quiz passé, et relire ces informations pour le tableau de bord et les
# indicateurs de chaque leçon.
#
# Chaque fonction reçoit un user_id (l'identifiant du compte Supabase de la
# personne connectée) et filtre toujours ses requêtes dessus. C'est la
# garantie, côté application, qu'un utilisateur ne voit jamais les données
# d'un autre.
#
# Toutes les requêtes passent leurs valeurs avec %s au lieu de les coller
# dans le texte SQL. psycopg2 se charge alors de les échapper, ce qui rend
# impossible une injection SQL.
#
# Les heures sont enregistrées en temps universel (UTC), mais les jours sont
# comptés à l'heure de Paris : une leçon ouverte à 0 h 30 en France compte
# bien pour ce jour-là, et pas pour la veille comme ce serait le cas en UTC.

import os
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv


# Charge les variables du fichier .env (dont DATABASE_URL).
load_dotenv()


# Fuseau horaire utilisé pour découper l'activité en jours. Tous les
# utilisateurs visés sont en France : un seul fuseau suffit.
FUSEAU = "Europe/Paris"

# Expression SQL qui donne le jour, à l'heure de Paris, d'une ligne de la
# table. horodatage est stocké sans fuseau, en UTC : le premier AT TIME ZONE
# le déclare en UTC, le second le convertit à l'heure de Paris, et ::date ne
# garde que le jour. Le fuseau est passé en paramètre (%s), comme toute valeur.
JOUR_LOCAL = "(horodatage AT TIME ZONE 'UTC' AT TIME ZONE %s)::date"


def aujourd_hui():
    """Renvoie la date du jour à l'heure de Paris, quel que soit le fuseau du serveur."""
    return datetime.now(ZoneInfo(FUSEAU)).date()


def en_utc(horodatage):
    """
    Marque une date lue dans la base comme étant en UTC.

    Sans cette précision, isoformat() produit "2026-10-04T22:30:00", que le
    navigateur lit comme une heure locale : la date affichée serait décalée
    de une ou deux heures, et parfois d'un jour. Avec elle, on obtient
    "2026-10-04T22:30:00+00:00", que le navigateur convertit correctement.
    """
    return horodatage.replace(tzinfo=timezone.utc)


def obtenir_connexion():
    """Ouvre une connexion à la base à partir de DATABASE_URL."""

    url = os.getenv("DATABASE_URL")

    # Sans adresse de connexion, on s'arrête avec un message qui dit quoi faire.
    if not url:
        raise ValueError(
            "Erreur : DATABASE_URL introuvable dans ton .env.\n"
            "   Récupère l'URL de connexion depuis ton projet "
            "Supabase (bouton 'Connect' > Session pooler)."
        )

    return psycopg2.connect(url)


def initialiser_schema():
    """
    Crée la table 'evenements' si elle n'existe pas encore.

    Attention : CREATE TABLE IF NOT EXISTS ne modifie jamais une table déjà
    présente, même si sa structure est différente. Pour changer la structure,
    il faut d'abord supprimer l'ancienne table (DROP TABLE evenements;).
    """

    conn = obtenir_connexion()

    # "with conn" valide automatiquement la transaction si tout se passe bien,
    # et l'annule en cas d'erreur.
    with conn, conn.cursor() as cur:

        # Une ligne par événement : une leçon ouverte ou un quiz terminé.
        # REFERENCES auth.users(id) relie chaque ligne à un vrai compte
        # Supabase, et ON DELETE CASCADE supprime ses lignes si le compte
        # est supprimé.
        cur.execute("""
            CREATE TABLE IF NOT EXISTS evenements (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                sujet_slug TEXT NOT NULL,
                type_evenement TEXT NOT NULL
                    CHECK (type_evenement IN ('lecon_vue', 'quiz')),
                score INTEGER,
                total INTEGER,
                horodatage TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """)

        # Un index sur user_id accélère toutes nos requêtes, qui filtrent
        # systématiquement sur cette colonne.
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_evenements_user_id
            ON evenements (user_id)
        """)

        # Sécurité au niveau des lignes (RLS). Supabase publie
        # automatiquement chaque table du schéma public dans son API, que
        # n'importe quel visiteur peut appeler avec la clé publique du
        # frontend. Avec la RLS activée et aucune règle d'accès, cette API
        # ne renvoie plus aucune ligne de la table. Notre backend, lui, se
        # connecte en tant que propriétaire de la table : il n'est pas
        # concerné et continue de fonctionner normalement.
        # La commande ne fait rien si la RLS est déjà activée.
        cur.execute("ALTER TABLE evenements ENABLE ROW LEVEL SECURITY")

    conn.close()

    print("Schéma initialisé (table 'evenements' prête, RLS activée).")


# ---------------------------------------------------------------------------
# Écriture
# ---------------------------------------------------------------------------

def enregistrer_lecon_vue(user_id, sujet_slug):
    """Enregistre qu'un utilisateur a ouvert une leçon."""

    conn = obtenir_connexion()

    with conn, conn.cursor() as cur:
        cur.execute(
            # NOW() AT TIME ZONE 'UTC' donne l'heure en UTC, quel que soit le
            # réglage de fuseau de la base : toutes les lignes suivent la même règle.
            "INSERT INTO evenements (user_id, sujet_slug, type_evenement, horodatage) "
            "VALUES (%s, %s, 'lecon_vue', NOW() AT TIME ZONE 'UTC')",
            (user_id, sujet_slug)
        )

    conn.close()


def enregistrer_quiz(user_id, sujet_slug, score, total):
    """Enregistre le résultat d'un quiz terminé."""

    conn = obtenir_connexion()

    with conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO evenements (user_id, sujet_slug, type_evenement, score, total, horodatage) "
            "VALUES (%s, %s, 'quiz', %s, %s, NOW() AT TIME ZONE 'UTC')",
            (user_id, sujet_slug, score, total)
        )

    conn.close()


# ---------------------------------------------------------------------------
# Lecture et statistiques
# ---------------------------------------------------------------------------

def sujets_vus(user_id):
    """Renvoie la liste des slugs des leçons ouvertes au moins une fois."""

    conn = obtenir_connexion()

    with conn, conn.cursor() as cur:
        # DISTINCT ne garde qu'une ligne par sujet, même s'il a été ouvert
        # plusieurs fois.
        cur.execute(
            "SELECT DISTINCT sujet_slug FROM evenements "
            "WHERE type_evenement = 'lecon_vue' AND user_id = %s",
            (user_id,)
        )
        resultat = [ligne[0] for ligne in cur.fetchall()]

    conn.close()

    return resultat


def historique_quiz(user_id):
    """Renvoie tous les quiz passés, du plus ancien au plus récent."""

    conn = obtenir_connexion()

    # RealDictCursor renvoie chaque ligne sous forme de dictionnaire
    # ({"sujet_slug": ..., "score": ...}) au lieu d'un simple tuple.
    with conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT sujet_slug, score, total, horodatage
            FROM evenements
            WHERE type_evenement = 'quiz' AND user_id = %s
            ORDER BY horodatage
        """, (user_id,))
        lignes = cur.fetchall()

    conn.close()

    # On renvoie des dictionnaires simples, avec une date marquée en UTC.
    return [{**ligne, "horodatage": en_utc(ligne["horodatage"])} for ligne in lignes]


def jours_actifs(user_id):
    """Renvoie la liste des jours où l'utilisateur a eu au moins une activité."""

    conn = obtenir_connexion()

    with conn, conn.cursor() as cur:
        # JOUR_LOCAL ne garde que le jour (à l'heure de Paris), ce qui
        # permet de regrouper toutes les activités d'une même journée.
        cur.execute(f"""
            SELECT DISTINCT {JOUR_LOCAL} AS jour
            FROM evenements
            WHERE user_id = %s
            ORDER BY jour
        """, (FUSEAU, user_id))
        resultat = [ligne[0] for ligne in cur.fetchall()]

    conn.close()

    return resultat


def sujets_completes_par_categorie(user_id, db):
    """Compte le nombre de leçons vues dans chaque catégorie."""

    vus = sujets_vus(user_id)

    compteur = {}

    for slug in vus:
        # On ignore un sujet qui n'existerait plus dans la base de connaissances.
        if slug in db:
            categorie = db[slug]["category"]
            compteur[categorie] = compteur.get(categorie, 0) + 1

    return compteur


def progression_par_sujet(user_id):
    """
    Résume, pour chaque sujet que l'utilisateur a touché, où il en est :
      - lue : vrai si la leçon a été ouverte au moins une fois ;
      - meilleur_pourcentage : meilleur score obtenu au quiz, en pourcentage
        (None si aucun quiz n'a été passé sur ce sujet) ;
      - derniere_activite : date et heure de la dernière activité sur ce sujet.

    Les sujets jamais touchés n'apparaissent pas dans le résultat.
    C'est ce qui permet au frontend d'afficher un indicateur par leçon,
    de proposer "Reprendre" et de choisir une notion encore jamais vue.
    """

    conn = obtenir_connexion()

    with conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        # GROUP BY sujet_slug produit une seule ligne par sujet.
        # BOOL_OR est vrai si au moins une ligne du groupe est une leçon vue.
        # Le CASE ne calcule le pourcentage que pour les lignes de quiz, et
        # NULLIF évite une division par zéro si total valait 0.
        # MAX garde le meilleur pourcentage et la date la plus récente.
        cur.execute("""
            SELECT
                sujet_slug,
                BOOL_OR(type_evenement = 'lecon_vue') AS lue,
                MAX(
                    CASE WHEN type_evenement = 'quiz'
                    THEN ROUND(100.0 * score / NULLIF(total, 0))
                    END
                ) AS meilleur_pourcentage,
                MAX(horodatage) AS derniere_activite
            FROM evenements
            WHERE user_id = %s
            GROUP BY sujet_slug
        """, (user_id,))
        lignes = cur.fetchall()

    conn.close()

    # On convertit les valeurs dans des types simples, faciles à envoyer en JSON :
    # ROUND renvoie un nombre décimal PostgreSQL, qu'on transforme en entier.
    return [
        {
            "sujet_slug": ligne["sujet_slug"],
            "lue": bool(ligne["lue"]),
            "meilleur_pourcentage": (
                int(ligne["meilleur_pourcentage"])
                if ligne["meilleur_pourcentage"] is not None
                else None
            ),
            "derniere_activite": en_utc(ligne["derniere_activite"]).isoformat(),
        }
        for ligne in lignes
    ]


def activite_par_jour(user_id, nombre_de_jours=84):
    """
    Compte, pour chaque jour des dernières semaines, le nombre de leçons
    ouvertes et de quiz passés par l'utilisateur. Sert au calendrier
    d'activité et à la rangée des 7 derniers jours du tableau de bord.

    Par défaut, la période couvre 84 jours, soit 12 semaines complètes.
    Seuls les jours avec au moins une activité sont renvoyés : le frontend
    complète lui-même les jours vides avec zéro.

    Les jours sont comptés à l'heure de Paris, comme pour calculer_streak.
    """

    # Premier jour de la période : aujourd'hui compte pour un jour, d'où le - 1.
    debut = aujourd_hui() - timedelta(days=nombre_de_jours - 1)

    conn = obtenir_connexion()

    with conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        # JOUR_LOCAL ne garde que le jour, à l'heure de Paris. Les deux
        # COUNT ... FILTER comptent séparément les leçons et les quiz de
        # chaque jour, en une seule lecture de la table.
        # JOUR_LOCAL apparaît deux fois, avec chacun son paramètre de fuseau.
        cur.execute(f"""
            SELECT
                {JOUR_LOCAL} AS jour,
                COUNT(*) FILTER (WHERE type_evenement = 'lecon_vue') AS lecons,
                COUNT(*) FILTER (WHERE type_evenement = 'quiz') AS quiz
            FROM evenements
            WHERE user_id = %s
              AND {JOUR_LOCAL} >= %s
            GROUP BY jour
            ORDER BY jour
        """, (FUSEAU, user_id, FUSEAU, debut))
        lignes = cur.fetchall()

    conn.close()

    # Conversion en types simples pour le JSON : la date devient un texte
    # "AAAA-MM-JJ", et les compteurs des entiers Python.
    return [
        {
            "date": ligne["jour"].isoformat(),
            "lecons": int(ligne["lecons"]),
            "quiz": int(ligne["quiz"]),
        }
        for ligne in lignes
    ]


def calculer_streak(jours, jour_courant=None):
    """
    Compte le nombre de jours d'activité consécutifs jusqu'à aujourd'hui.

    Fonction pure : elle ne lit pas la base, elle reçoit la liste des jours
    déjà filtrée par jours_actifs(user_id). La série reste valable si le
    dernier jour actif est hier, pour ne pas la remettre à zéro le matin
    avant que l'utilisateur ait eu le temps de se connecter.

    jour_courant sert aux tests, pour fixer la date du jour. Sans lui, on
    prend la date du jour à l'heure de Paris.
    """

    if not jours:
        return 0

    # Un ensemble (set) permet de vérifier très vite si un jour en fait partie.
    jours_set = set(jours)

    if jour_courant is None:
        jour_courant = aujourd_hui()
    hier = jour_courant - timedelta(days=1)

    # On part d'aujourd'hui si l'utilisateur a déjà été actif, sinon d'hier.
    if jour_courant in jours_set:
        jour_reference = jour_courant
    elif hier in jours_set:
        jour_reference = hier
    else:
        return 0

    # On remonte le temps jour par jour tant que chaque jour est actif.
    streak = 0
    curseur = jour_reference

    while curseur in jours_set:
        streak += 1
        curseur -= timedelta(days=1)

    return streak