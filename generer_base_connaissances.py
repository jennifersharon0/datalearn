import json
import time
import argparse
import os
import re

from topics import tous_les_sujets_a_plat
from web_recherche import rassembler_contexte
from llm_client import generer, generer_json, QuotaJournalierDepasse


FICHIER_DB = "knowledge_db.json"

PAUSE_ENTRE_SUJETS_SECONDES = 3


def nettoyer_markdown(texte):

    texte = re.sub(r"\*\*(.+?)\*\*", r"\1", texte)
    texte = re.sub(r"(?<!\*)\*(.+?)\*(?!\*)", r"\1", texte)
    texte = re.sub(r"^#+\s*", "", texte, flags=re.MULTILINE)
    texte = re.sub(r"^[-*]\s+", "", texte, flags=re.MULTILINE)

    return texte.strip()


def charger_db():

    if os.path.exists(FICHIER_DB):
        with open(FICHIER_DB, "r", encoding="utf-8") as f:
            return json.load(f)

    return {}


def sauvegarder_db(db):

    with open(FICHIER_DB, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)


def generer_lecon(titre, contexte, categorie):

    if contexte.strip():

        prompt = f"""Tu es un pédagogue expert en data science et intelligence artificielle.

Voici des extraits de sources trouvées sur le web à propos de "{titre}" (catégorie : {categorie}) :

---
{contexte[:6000]}
---

Rédige une leçon claire et complète sur ce sujet, destinée à un(e) étudiant(e) en data science.
Consignes :
- Reformule entièrement avec tes propres mots, ne recopie jamais de phrases des sources telles quelles
- Structure la leçon avec une courte introduction, puis les points clés, en français
- Reste concret : donne un exemple simple si c'est pertinent
- Longueur : environ 200 à 350 mots
- IMPORTANT : réponds en TEXTE BRUT uniquement. N'utilise AUCUNE syntaxe Markdown
  (pas de **gras**, pas de *italique*, pas de titres avec #, pas de listes avec des tirets).
  Ce texte sera affiché tel quel dans un terminal qui n'interprète pas le Markdown.
  Sépare simplement tes paragraphes par une ligne vide.
- N'ajoute ni titre, ni introduction du type "Voici la leçon", donne directement le contenu
"""

    else:

        prompt = f"""Tu es un pédagogue expert en data science et intelligence artificielle.

Rédige une leçon claire et complète sur le sujet "{titre}" (catégorie : {categorie}),
destinée à un(e) étudiant(e) en data science.
Consignes :
- Structure la leçon avec une courte introduction, puis les points clés, en français
- Reste concret : donne un exemple simple si c'est pertinent
- Longueur : environ 200 à 350 mots
- IMPORTANT : réponds en TEXTE BRUT uniquement. N'utilise AUCUNE syntaxe Markdown
  (pas de **gras**, pas de *italique*, pas de titres avec #, pas de listes avec des tirets).
  Ce texte sera affiché tel quel dans un terminal qui n'interprète pas le Markdown.
  Sépare simplement tes paragraphes par une ligne vide.
- N'ajoute ni titre, ni introduction du type "Voici la leçon", donne directement le contenu
"""

    system = (
        "Tu es un excellent pédagogue en data science. "
        "Tu réponds toujours en français, de façon claire et structurée."
    )

    return generer(prompt, system=system)


# ==========================================
# GÉNÉRER UN QUIZ (8 questions minimum)
# ==========================================
# Passé de 2 à 8 questions : un quiz de 2 questions
# ne teste pas vraiment la compréhension d'une leçon
# de 200-350 mots. 8 questions permet de couvrir les
# différents points de la leçon.

NOMBRE_QUESTIONS_QUIZ = 8


def generer_quiz(titre, contenu_lecon):

    prompt = rf"""Voici une leçon sur "{titre}" :

---
{contenu_lecon}
---

Génère exactement {NOMBRE_QUESTIONS_QUIZ} questions à choix multiples (QCM) pour vérifier
la compréhension de cette leçon. Les questions doivent couvrir des points DIFFÉRENTS de
la leçon (pas plusieurs questions qui testent la même phrase). Réponds UNIQUEMENT avec un
JSON valide, sans aucun texte autour, au format EXACT suivant :

[
  {{
    "question": "...",
    "options": ["...", "...", "...", "..."],
    "answer": 2
  }},
  ... ({NOMBRE_QUESTIONS_QUIZ} questions au total)
]

Règles :
- 4 options par question, une seule correcte
- "answer" est le NUMÉRO de la bonne réponse en partant de 1 (pas de 0)
- Les mauvaises réponses doivent être plausibles, pas absurdes
- Varie la difficulté (quelques questions simples, quelques-unes plus fines)
- IMPORTANT : pour toute formule mathématique, écris-la en texte simple, JAMAIS en
  notation LaTeX. Interdit : \top, \times, \(, \), \frac, etc. Remplace par du texte
  lisible : "c transposé x" plutôt que "c^{{\top}}x", "A fois x" plutôt que "\(Ax\)".
  Les barres obliques inversées cassent le format JSON et rendent ta réponse inutilisable.
"""

    system = (
        "Tu génères uniquement du JSON valide, jamais de texte "
        "explicatif autour, jamais de balises markdown ```."
    )

    return generer_json(prompt, system=system)


def traiter_un_sujet(slug, categorie, titre, db):

    print(f"\n[{titre}] Recherche de sources...")

    contexte, sources = rassembler_contexte(titre, nb_sources=3)

    if not contexte.strip():
        print("   ATTENTION: Aucune source récupérée, génération à partir des connaissances du LLM.")

    print(f"[{titre}] Génération de la leçon...")

    contenu_lecon = generer_lecon(titre, contexte, categorie)

    contenu_lecon = nettoyer_markdown(contenu_lecon)

    print(f"[{titre}] Génération du quiz ({NOMBRE_QUESTIONS_QUIZ} questions)...")

    quiz = generer_quiz(titre, contenu_lecon)

    db[slug] = {
        "title": titre,
        "category": categorie,
        "content": contenu_lecon,
        "quiz": quiz if quiz is not None else [],
        "sources": sources,
    }

    # Sauvegarde immédiate : même si le quiz a échoué, on garde la
    # leçon (déjà bonne) plutôt que de la perdre. --quiz-seulement
    # la retrouvera avec un quiz vide et le régénérera, sans avoir
    # à refaire la recherche web ni la leçon.
    sauvegarder_db(db)

    if quiz is None:
        raise ValueError(
            f"Leçon enregistrée pour '{titre}', mais le quiz n'a pas pu être "
            f"généré (JSON invalide après plusieurs tentatives). "
            f"Relance --quiz-seulement pour ce sujet."
        )

    print(f"[{titre}] Terminé.")


# ==========================================
# RÉGÉNÉRER UNIQUEMENT LE QUIZ D'UN SUJET
# ==========================================
# Utile pour appliquer le passage à 8 questions
# aux sujets déjà générés, SANS refaire la recherche
# web ni régénérer la leçon (plus rapide, ne gaspille
# pas d'appels LLM inutiles).

def regenerer_quiz_seul(slug, db, forcer=False):

    if slug not in db:
        print(f"ERREUR: '{slug}' n'est pas encore en base, impossible de ne régénérer que le quiz.")
        return False

    titre = db[slug]["title"]

    quiz_actuel = db[slug].get("quiz", [])

    if not forcer and len(quiz_actuel) >= NOMBRE_QUESTIONS_QUIZ:
        print(f"[{titre}] Déjà {len(quiz_actuel)} questions, ignoré (utilise --force pour forcer).")
        return True

    print(f"[{titre}] Régénération du quiz seul ({NOMBRE_QUESTIONS_QUIZ} questions)...")

    quiz = generer_quiz(titre, db[slug]["content"])

    if quiz is None:
        print(f"[{titre}] Échec de génération du quiz.")
        return False

    db[slug]["quiz"] = quiz

    print(f"[{titre}] Quiz mis à jour.")

    return True


def main():

    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None,
                         help="Nombre maximum de sujets à traiter (utile pour tester)")
    parser.add_argument("--sujet", type=str, default=None,
                         help="Ne traiter qu'un seul sujet (par son slug)")
    parser.add_argument("--force", action="store_true",
                         help="Régénère même les sujets déjà présents dans la base")
    parser.add_argument("--quiz-seulement", action="store_true",
                         help="Ne régénère QUE les quiz des sujets déjà en base "
                              "(pas de recherche web ni de nouvelle leçon)")
    args = parser.parse_args()

    db = charger_db()

    # --------------------------------------
    # MODE : régénération des quiz uniquement
    # --------------------------------------

    if args.quiz_seulement:

        slugs_cibles = [args.sujet] if args.sujet else list(db.keys())

        if args.limit is not None:
            slugs_cibles = slugs_cibles[:args.limit]

        print(f"Régénération du quiz pour {len(slugs_cibles)} sujet(s) déjà en base.")

        echecs = []
        arret_premature = False

        for i, slug in enumerate(slugs_cibles, start=1):

            print(f"\n===== [{i}/{len(slugs_cibles)}] {slug} =====")

            try:
                ok = regenerer_quiz_seul(slug, db, forcer=args.force)
                if ok:
                    sauvegarder_db(db)
                else:
                    echecs.append(slug)

            except QuotaJournalierDepasse:
                print(
                    "\nQuota journalier Groq atteint pour ce modèle. "
                    "Arrêt du script (inutile de continuer, les sujets "
                    "suivants échoueraient tous pour la même raison)."
                )
                print(f"Sujets non traités : {len(slugs_cibles) - i + 1}")
                print(
                    "Solutions : ajoute GROQ_MODELE_FORCE=<autre modèle> "
                    "dans ton .env pour utiliser un modèle dont le quota "
                    "n'est pas encore atteint, ou relance ce script plus "
                    "tard (le quota se renouvelle généralement sous 24h). "
                    "Dans tous les cas, relancer cette commande reprendra "
                    "exactement là où on s'est arrêté."
                )
                arret_premature = True
                break

            except Exception as erreur:
                print(f"ERREUR: Échec sur '{slug}' : {erreur}")
                echecs.append(slug)

            if i < len(slugs_cibles):
                time.sleep(PAUSE_ENTRE_SUJETS_SECONDES)

        if not arret_premature:
            print(f"\nTerminé. {len(slugs_cibles) - len(echecs)} succès, {len(echecs)} échec(s).")

        if echecs:
            print("Sujets en échec :")
            for slug in echecs:
                print(" -", slug)

        return

    # --------------------------------------
    # MODE NORMAL : pipeline complet
    # --------------------------------------

    tous_les_sujets = tous_les_sujets_a_plat()

    if args.sujet:
        tous_les_sujets = [s for s in tous_les_sujets if s[0] == args.sujet]
        if not tous_les_sujets:
            print(f"ERREUR: Sujet inconnu : {args.sujet}")
            return

    a_traiter = []

    for slug, categorie, titre in tous_les_sujets:
        if slug in db and not args.force:
            continue
        a_traiter.append((slug, categorie, titre))

    if args.limit is not None:
        a_traiter = a_traiter[:args.limit]

    print(f"{len(a_traiter)} sujet(s) à générer "
          f"(sur {len(tous_les_sujets)} au total, "
          f"{len(db)} déjà en base).")

    echecs = []
    arret_premature = False

    for i, (slug, categorie, titre) in enumerate(a_traiter, start=1):

        print(f"\n===== [{i}/{len(a_traiter)}] {titre} =====")

        try:
            traiter_un_sujet(slug, categorie, titre, db)
            sauvegarder_db(db)

        except QuotaJournalierDepasse:
            print(
                "\nQuota journalier Groq atteint pour ce modèle. "
                "Arrêt du script (inutile de continuer, les sujets "
                "suivants échoueraient tous pour la même raison)."
            )
            print(f"Sujets non traités : {len(a_traiter) - i + 1}")
            print(
                "Solutions : ajoute GROQ_MODELE_FORCE=<autre modèle> "
                "dans ton .env pour utiliser un modèle dont le quota "
                "n'est pas encore atteint, ou relance ce script plus "
                "tard (le quota se renouvelle généralement sous 24h). "
                "Dans tous les cas, relancer cette commande reprendra "
                "exactement là où on s'est arrêté."
            )
            arret_premature = True
            break

        except Exception as erreur:
            print(f"ERREUR: Échec sur '{titre}' : {erreur}")
            echecs.append(titre)

        if i < len(a_traiter):
            time.sleep(PAUSE_ENTRE_SUJETS_SECONDES)

    if not arret_premature:
        print(f"\nTerminé. {len(a_traiter) - len(echecs)} succès, {len(echecs)} échec(s).")

    if echecs:
        print("Sujets en échec (relance le script pour réessayer, ils seront repris) :")
        for titre in echecs:
            print(" -", titre)


if __name__ == "__main__":
    main()