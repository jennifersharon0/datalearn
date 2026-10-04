# Fichier : main.py
#
# Le serveur web du projet, construit avec FastAPI. C'est lui que le frontend
# React appelle : il vérifie l'identité de l'utilisateur, lit les leçons dans
# la base de connaissances, corrige les quiz, transmet les questions au LLM
# et enregistre la progression.
#
# Lancement en local : uvicorn main:app --reload
#
# Toutes les routes, sauf /health, exigent un jeton de connexion valide.
# Le mécanisme est le même partout : Depends(obtenir_utilisateur_courant)
# vérifie le jeton avant d'exécuter la route, et fournit l'identifiant de
# la personne connectée.

import os

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# BaseModel décrit la forme attendue des données reçues.
# Field ajoute des règles sur chaque champ (longueur minimale, maximale...).
from pydantic import BaseModel, Field

from auth_jwt import obtenir_utilisateur_courant
from limiteur import LimiteurDebit, limite
from llm_client import QuotaJournalierDepasse
from base_connaissances import charger_connaissances
from moteur_lecons import obtenir_lecon, obtenir_quiz_sans_reponses, corriger_quiz
from moteur_questions import repondre_question_libre, obtenir_definition_courte
from stockage_progression import (
    enregistrer_lecon_vue,
    enregistrer_quiz,
    sujets_vus,
    historique_quiz,
    jours_actifs,
    sujets_completes_par_categorie,
    calculer_streak,
    progression_par_sujet,
    activite_par_jour,
)


# Charge les variables du fichier .env.
load_dotenv()


# Création de l'application. Le titre apparaît dans la documentation
# automatique de FastAPI, visible sur http://localhost:8000/docs.
app = FastAPI(title="API DataLearn")


# ---------------------------------------------------------------------------
# Base de connaissances
# ---------------------------------------------------------------------------
# Chargée une seule fois au démarrage du serveur et gardée en mémoire.
# Elle ne change pas pendant que le serveur tourne : elle n'est mise à jour
# que par generer_base_connaissances.py, lancé à part.

db = charger_connaissances()


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
# Par sécurité, un navigateur bloque les requêtes d'un site vers une autre
# adresse. Le frontend (localhost:5173) et le backend (localhost:8000) ont
# des adresses différentes, même en local. CORSMiddleware autorise
# explicitement le frontend, et lui seul, à appeler ce backend.
# FRONTEND_URL est dans le .env, pour changer d'adresse au déploiement sans
# toucher au code.

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Limites sur les données reçues
# ---------------------------------------------------------------------------
# Le frontend limite déjà la longueur des questions, mais cette limite peut
# être contournée par quelqu'un qui appelle l'API directement. Les règles
# ci-dessous sont la vraie protection : FastAPI refuse automatiquement
# (erreur 422) toute requête qui ne les respecte pas, avant même
# d'exécuter la route.

LONGUEUR_MAX_QUESTION = 1000   # protège le quota du LLM
LONGUEUR_MAX_SLUG = 100        # aucun slug réel n'approche cette longueur
NOMBRE_MAX_REPONSES = 50       # bien au-dessus des 8 questions d'un quiz


# Nombre maximal d'appels au LLM par utilisateur. Une question libre coûte
# beaucoup plus qu'une définition (la leçon entière est envoyée au LLM),
# d'où une limite plus basse. Les définitions sont en plus gardées en
# mémoire (moteur_questions.py) : la plupart ne coûtent rien.
LIMITE_QUESTIONS = LimiteurDebit(nombre_max=30, fenetre_secondes=3600)
LIMITE_DEFINITIONS = LimiteurDebit(nombre_max=60, fenetre_secondes=3600)


def appeler_llm(fonction, *arguments):
    """
    Appelle une fonction qui interroge le LLM, et transforme ses échecs en
    réponses HTTP claires au lieu d'une erreur 500 générique :
      quota journalier de Groq épuisé : 503 (service indisponible) ;
      toute autre panne du LLM : 502 (le service appelé a échoué).
    Le détail technique est écrit dans le terminal, jamais envoyé au client.
    """
    try:
        return fonction(*arguments)
    except QuotaJournalierDepasse:
        print("Avertissement : quota journalier Groq atteint.")
        raise HTTPException(status_code=503, detail="Assistant momentanément indisponible.")
    except Exception as erreur:
        print(f"Avertissement : échec de l'appel au LLM ({erreur})")
        raise HTTPException(status_code=502, detail="Assistant momentanément indisponible.")


class ReponsesQuiz(BaseModel):
    """Réponses envoyées pour un quiz : une par question, numérotées à partir de 1."""

    reponses: list[int] = Field(max_length=NOMBRE_MAX_REPONSES)


class QuestionPayload(BaseModel):
    """Question libre posée sur un sujet."""

    sujet_slug: str = Field(min_length=1, max_length=LONGUEUR_MAX_SLUG)
    question: str = Field(min_length=1, max_length=LONGUEUR_MAX_QUESTION)


# ---------------------------------------------------------------------------
# Route publique
# ---------------------------------------------------------------------------

@app.get("/health")
def verifier_sante():
    """Permet de vérifier que le serveur répond (utile une fois en ligne)."""
    return {"statut": "ok"}


# ---------------------------------------------------------------------------
# Identité
# ---------------------------------------------------------------------------

@app.get("/me")
def moi(user_id: str = Depends(obtenir_utilisateur_courant)):
    """Renvoie l'identifiant de la personne connectée."""
    return {"user_id": user_id}


# ---------------------------------------------------------------------------
# Catalogue des sujets
# ---------------------------------------------------------------------------

@app.get("/topics")
def lister_sujets(user_id: str = Depends(obtenir_utilisateur_courant)):
    """Liste tous les sujets, dans l'ordre de topics.py."""

    return [
        {"slug": slug, "titre": infos["title"], "categorie": infos["category"]}
        for slug, infos in db.items()
    ]


# ---------------------------------------------------------------------------
# Leçons
# ---------------------------------------------------------------------------

@app.get("/lessons/{slug}")
def obtenir_une_lecon(slug: str, user_id: str = Depends(obtenir_utilisateur_courant)):
    """Renvoie le contenu d'une leçon et enregistre qu'elle a été vue."""

    lecon = obtenir_lecon(db, slug)

    if lecon is None:
        raise HTTPException(status_code=404, detail="Sujet introuvable.")

    # Un échec d'enregistrement de la progression ne doit jamais empêcher
    # d'afficher la leçon elle-même : on le signale dans le terminal et on
    # continue.
    try:
        enregistrer_lecon_vue(user_id, slug)
    except Exception as erreur:
        print(f"Avertissement : progression non enregistrée ({erreur})")

    return {
        "titre": lecon["title"],
        "categorie": lecon["category"],
        "contenu": lecon["content"],
    }


# ---------------------------------------------------------------------------
# Quiz
# ---------------------------------------------------------------------------

@app.get("/lessons/{slug}/quiz")
def obtenir_quiz(slug: str, user_id: str = Depends(obtenir_utilisateur_courant)):
    """Renvoie les questions du quiz, sans les bonnes réponses."""

    quiz = obtenir_quiz_sans_reponses(db, slug)

    if quiz is None:
        raise HTTPException(status_code=404, detail="Sujet introuvable.")

    return {"questions": quiz}


@app.post("/lessons/{slug}/quiz/submit")
def soumettre_quiz(
    slug: str,
    corps: ReponsesQuiz,
    user_id: str = Depends(obtenir_utilisateur_courant),
):
    """Corrige le quiz côté serveur et enregistre le score."""

    if slug not in db:
        raise HTTPException(status_code=404, detail="Sujet introuvable.")

    score, total, corrections = corriger_quiz(db, slug, corps.reponses)

    try:
        enregistrer_quiz(user_id, slug, score, total)
    except Exception as erreur:
        print(f"Avertissement : progression non enregistrée ({erreur})")

    return {"score": score, "total": total, "corrections": corrections}


# ---------------------------------------------------------------------------
# Questions libres et définitions
# ---------------------------------------------------------------------------

@app.post("/questions")
def poser_question(
    corps: QuestionPayload,
    # limite(...) vérifie le jeton comme d'habitude, puis compte l'appel :
    # au-delà de 30 questions par heure, la route répond 429.
    user_id: str = Depends(limite(LIMITE_QUESTIONS)),
):
    """Transmet une question au LLM, avec le contenu de la leçon comme appui."""

    if corps.sujet_slug not in db:
        raise HTTPException(status_code=404, detail="Sujet introuvable.")

    reponse = appeler_llm(repondre_question_libre, db, corps.sujet_slug, corps.question)

    return {"reponse": reponse}


@app.get("/lessons/{slug}/definition")
def obtenir_une_definition(slug: str, user_id: str = Depends(limite(LIMITE_DEFINITIONS))):
    """Demande au LLM une définition courte du sujet (au plus 60 par heure)."""

    if slug not in db:
        raise HTTPException(status_code=404, detail="Sujet introuvable.")

    definition = appeler_llm(obtenir_definition_courte, db, slug)

    return {"definition": definition}


# ---------------------------------------------------------------------------
# Progression
# ---------------------------------------------------------------------------

@app.get("/progress")
def obtenir_progression(user_id: str = Depends(obtenir_utilisateur_courant)):
    """
    Renvoie l'état de chaque sujet déjà touché par l'utilisateur :
    leçon lue ou non, meilleur score au quiz, date de dernière activité.
    Les sujets jamais ouverts ne figurent pas dans la liste.
    """

    return progression_par_sujet(user_id)


@app.get("/dashboard")
def obtenir_dashboard(user_id: str = Depends(obtenir_utilisateur_courant)):
    """Renvoie les statistiques globales affichées sur la page Progression."""

    jours = jours_actifs(user_id)
    streak = calculer_streak(jours)

    sujets_termines = sujets_vus(user_id)
    par_categorie = sujets_completes_par_categorie(user_id, db)

    quiz_historique = historique_quiz(user_id)

    # On reconstruit des dictionnaires simples plutôt que de renvoyer les
    # lignes de la base telles quelles. Le format de réponse reste ainsi
    # indépendant de la structure de la table : si elle change un jour,
    # cette route n'a pas forcément à changer.
    quiz_serialise = [
        {
            "sujet_slug": ligne["sujet_slug"],
            "score": ligne["score"],
            "total": ligne["total"],
            "date": ligne["horodatage"].isoformat(),
        }
        for ligne in quiz_historique
    ]

    return {
        "streak_jours": streak,
        "sujets_completes": len(sujets_termines),
        "total_sujets": len(db),
        "par_categorie": par_categorie,
        "historique_quiz": quiz_serialise,
        # Activité jour par jour sur les 12 dernières semaines, pour le
        # calendrier et la rangée des 7 derniers jours.
        "activite": activite_par_jour(user_id),
    }