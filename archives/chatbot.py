import os

from base_connaissances import charger_connaissances
from nlu_llm import classifier_message
from llm_client import generer
from stockage_progression import enregistrer_lecon_vue, enregistrer_quiz
from Moteur_questions import (
    repondre_question_libre as _repondre_question_libre,
    obtenir_definition_courte as _obtenir_definition_courte,
)


# ==========================================
# 0. MODE DEBUG
# ==========================================

DEBUG = True


# ==========================================
# 1. CHARGER LA BASE DE CONNAISSANCES
# ==========================================

try:
    db = charger_connaissances()

except FileNotFoundError as erreur:
    print(erreur)
    raise SystemExit(1)

print(f"Base de connaissances chargée : {len(db)} sujet(s) disponibles.")


# ==========================================
# 1bis. IDENTIFIANT UTILISATEUR (mode terminal)
# ==========================================
# Le vrai login (Supabase Auth) arrivera avec l'appli
# Streamlit. En attendant, le chatbot en mode terminal
# est un usage "solo" : il lit ton propre user_id depuis
# le .env, pour que ta progression soit quand même suivie
# sous TON compte (le même que tu utiliseras plus tard
# pour te connecter à l'appli).
#
# Pour l'obtenir : dans Supabase, va dans Authentication
# > Users, crée un utilisateur (ton email), puis copie
# son UUID ici, dans ton .env :
#   MON_USER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

USER_ID = os.getenv("MON_USER_ID")

if not USER_ID:
    print(
        "Avertissement : MON_USER_ID n'est pas défini dans ton .env — "
        "ta progression ne sera PAS enregistrée cette session.\n"
        "   Crée un utilisateur dans Supabase (Authentication > Users) "
        "et ajoute son UUID à ton .env."
    )


# ==========================================
# 2. LANCER UN QUIZ
# ==========================================

def lancer_quiz(sujet_slug):

    quiz = db[sujet_slug].get("quiz", [])

    if not quiz:

        print(
            "Bot : je n'ai pas encore de quiz généré "
            "pour ce sujet."
        )

        return

    titre = db[sujet_slug]["title"]

    score = 0

    print(f"\nQuiz sur : {titre} ({len(quiz)} question(s))\n")

    for i, q in enumerate(quiz, start=1):

        print(f"Question {i} : {q['question']}")

        for idx, option in enumerate(q["options"], start=1):
            print(f"  {idx}. {option}")

        reponse = input("Ta réponse (numéro) : ")

        try:
            choix = int(reponse)
        except ValueError:
            choix = -1

        if choix == q["answer"]:

            print("Bonne réponse !\n")

            score += 1

        else:

            bonne_reponse = q["options"][q["answer"] - 1]

            print(
                f"Ce n'est pas ça. "
                f"La bonne réponse était : {bonne_reponse}\n"
            )

    print(f"Résultat : {score}/{len(quiz)}")

    # On enregistre le résultat du quiz dans Supabase, pour le
    # dashboard de progression à venir. Un échec ici (réseau,
    # base temporairement indisponible...) ne doit JAMAIS
    # empêcher l'utilisatrice de voir son score et continuer.
    try:
        if USER_ID:
            enregistrer_quiz(USER_ID, sujet_slug, score, len(quiz))
    except Exception as erreur:
        print(f"Avertissement : progression non enregistrée ({erreur})")

    if score == len(quiz):
        print("Parfait, tu maîtrises cette notion !")
    elif score >= len(quiz) / 2:
        print("Pas mal, mais tu peux encore progresser.")
    else:
        print(
            "Cette notion mérite d'être revue, "
            "n'hésite pas à redemander la leçon."
        )


# ==========================================
# 3 & 4. RÉPONSES LLM (question libre, définition)
# ==========================================
# La logique elle-même vit dans moteur_questions.py, partagée
# avec l'API (main.py). Ici on ne fait qu'adapter à la signature
# utilisée dans ce fichier (sans repasser "db" à chaque appel,
# puisqu'il est déjà disponible globalement dans chatbot.py).

def repondre_question_libre(sujet_slug, question):
    return _repondre_question_libre(db, sujet_slug, question)


def obtenir_definition_courte(sujet_slug):
    return _obtenir_definition_courte(db, sujet_slug)


# ==========================================
# 5. RÉPONDRE (selon l'intention détectée)
# ==========================================

def repondre(intention, sujet_slug):

    if intention in ("ask_lesson", "quiz", "definition") and sujet_slug is None:

        print(
            "Bot : je n'ai pas trouvé de sujet précis dans mon catalogue "
            "pour cette demande. Essaie de reformuler, par exemple : "
            "\"apprends-moi le RAG\" ou \"c'est quoi les embeddings ?\"."
        )

        return None

    if intention == "ask_lesson":

        lecon = db[sujet_slug]

        print(f"\n{lecon['title']}\n")
        print(lecon["content"])

        # Même principe : on enregistre que la leçon a été vue,
        # sans jamais laisser un problème d'enregistrement
        # interrompre la leçon elle-même.
        try:
            if USER_ID:
                enregistrer_lecon_vue(USER_ID, sujet_slug)
        except Exception as erreur:
            print(f"Avertissement : progression non enregistrée ({erreur})")

        print(
            "\nUne question sur ce sujet ? Pose-la moi directement.\n"
            "Sinon, veux-tu faire un petit quiz pour vérifier "
            "ce que tu as retenu ? (oui/non)"
        )

        return sujet_slug

    elif intention == "quiz":

        lancer_quiz(sujet_slug)

        return None

    elif intention == "definition":

        definition = obtenir_definition_courte(sujet_slug)

        print(f"\nDéfinition : {definition}")

        return None

    else:

        print(
            "Bot : je suis un chatbot pédagogique en data science ! "
            "Demande-moi une leçon sur un sujet, un quiz, "
            "ou une définition."
        )

        return None


# ==========================================
# 6. DÉMARRAGE DU CHATBOT
# ==========================================

print("\nChatbot démarré !")
print("Écris 'quit' pour quitter.\n")


# ==========================================
# 7. MÉMOIRE DE L'ÉTAT DE LA CONVERSATION
# ==========================================

sujet_actuel = None
mode = None


# ==========================================
# 8. BOUCLE PRINCIPALE
# ==========================================

while True:

    message = input("Toi : ").strip()

    if message.lower() == "quit":

        print("Bot : à bientôt !")

        break

    if mode == "apres_lecon":

        reponse_utilisateur = message.lower()

        if reponse_utilisateur in ["oui", "oui.", "yes"]:

            lancer_quiz(sujet_actuel)

            mode = None
            sujet_actuel = None

        elif reponse_utilisateur in ["non", "non.", "no"]:

            print(
                "Bot : d'accord ! À la prochaine notion "
                "quand tu voudras."
            )

            mode = None
            sujet_actuel = None

        else:

            reponse = repondre_question_libre(sujet_actuel, message)

            print(f"\nBot : {reponse}")

            print(
                "\nAutre question ? Sinon, "
                "on fait le quiz sur ce sujet ? (oui/non)"
            )

        print()
        continue

    intention, sujet_slug = classifier_message(message, db, debug=DEBUG)

    if DEBUG:
        print(f"(debug) intention={intention} | sujet={sujet_slug}")

    sujet_retourne = repondre(intention, sujet_slug)

    if sujet_retourne is not None:

        sujet_actuel = sujet_retourne
        mode = "apres_lecon"

    print()