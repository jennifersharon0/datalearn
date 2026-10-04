# ==========================================
# LOGIQUE LEÇONS / QUIZ (pure, sans FastAPI)
# ==========================================
# Séparé volontairement du serveur web : ces fonctions ne savent
# rien de HTTP, elles manipulent juste des données Python. Ça les
# rend testables directement, sans lancer de serveur ni simuler
# de requête.

def obtenir_lecon(db, sujet_slug):

    if sujet_slug not in db:
        return None

    return db[sujet_slug]


def obtenir_quiz_sans_reponses(db, sujet_slug):
    """
    Renvoie les questions du quiz SANS le champ "answer".

    C'est la fonction qui protège contre la triche : le frontend
    ne doit recevoir que ce qui est nécessaire pour AFFICHER le
    quiz, jamais la bonne réponse elle-même.
    """

    if sujet_slug not in db:
        return None

    quiz = db[sujet_slug].get("quiz", [])

    quiz_public = []

    for question in quiz:

        quiz_public.append({
            "question": question["question"],
            "options": question["options"],
        })

    return quiz_public


def corriger_quiz(db, sujet_slug, reponses_utilisateur):
    """
    Compare les réponses envoyées par l'utilisateur aux vraies
    réponses, côté serveur — jamais côté client, précisément parce
    que le client ne les connaît pas.

    "reponses_utilisateur" : liste d'entiers (1-indexé, comme le
    reste du projet), une par question, dans l'ordre du quiz.

    Renvoie (score, total, corrections) où corrections est une liste
    de dicts détaillant chaque question, pour que le frontend puisse
    afficher un corrigé complet après coup.
    """

    quiz = db[sujet_slug]["quiz"]

    score = 0
    corrections = []

    for i, question in enumerate(quiz):

        ta_reponse = (
            reponses_utilisateur[i]
            if i < len(reponses_utilisateur)
            else None
        )

        correct = (ta_reponse == question["answer"])

        if correct:
            score += 1

        corrections.append({
            "question": question["question"],
            "options": question["options"],
            "ta_reponse": ta_reponse,
            "bonne_reponse": question["answer"],
            "correct": correct,
        })

    return score, len(quiz), corrections