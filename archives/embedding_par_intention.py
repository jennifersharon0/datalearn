from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity


# ==========================================
# 1. CHARGER LE MODÈLE
# ==========================================

model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")


# ==========================================
# 2. NOS INTENTIONS
# ==========================================

intents = {

    "ask_lesson": [
        "Je veux apprendre une nouvelle notion",
        "Je veux découvrir quelque chose",
        "Apprends-moi quelque chose",
        "Je voudrais faire une leçon",
        "Je veux approfondir mes connaissances"
    ],

    "quiz": [
        "Teste mes connaissances",
        "Je veux faire un quiz",
        "Interroge-moi",
        "Pose-moi des questions",
        "Je veux tester mes connaissances"
    ],

    "definition": [
        "Qu'est-ce que le machine learning ?",
        "Donne-moi la définition de l'IA",
        "Que signifie le mot embedding ?",
        "Explique-moi le deep learning",
        "C'est quoi le NLP ?"
    ]
}


# ==========================================
# 3. PRÉPARER LES PHRASES
# ==========================================

phrases = []
labels = []

for intent, exemples in intents.items():

    for exemple in exemples:

        phrases.append(exemple)
        labels.append(intent)


# ==========================================
# 4. CRÉER UN EMBEDDING MOYEN PAR INTENTION
# ==========================================

intent_embeddings = {}

for intent, exemples in intents.items():

    # Transformer les exemples de l'intention
    # en embeddings
    exemples_embeddings = model.encode(exemples)

    # Calculer la moyenne des embeddings
    intent_embedding = exemples_embeddings.mean(axis=0)

    # Stocker l'embedding moyen
    intent_embeddings[intent] = intent_embedding


print("Nombre de phrases :", len(phrases))

print("\n===== EMBEDDINGS PAR INTENTION =====")

for intent, embedding in intent_embeddings.items():

    print(
        intent,
        "→ Shape :",
        embedding.shape
    )


# ==========================================
# 5. FONCTION DE PRÉDICTION
# ==========================================

def comprendre(message):

    # Transformer le message utilisateur
    # en embedding
    message_embedding = model.encode([message])

    scores = {}

    # Comparer le message à chaque intention
    for intent, intent_embedding in intent_embeddings.items():

        score = cosine_similarity(
            message_embedding,
            [intent_embedding]
        )[0][0]

        scores[intent] = score


    # Trouver l'intention avec
    # le meilleur score
    meilleure_intention = max(
        scores,
        key=scores.get
    )

    meilleur_score = scores[meilleure_intention]


    # ======================================
    # Trouver la phrase d'entraînement
    # la plus proche
    # ======================================

    meilleure_phrase = None
    meilleur_score_phrase = -1

    for phrase in phrases:

        phrase_embedding = model.encode([phrase])

        score_phrase = cosine_similarity(
            message_embedding,
            phrase_embedding
        )[0][0]

        if score_phrase > meilleur_score_phrase:

            meilleur_score_phrase = score_phrase
            meilleure_phrase = phrase


    return (
        meilleure_intention,
        meilleur_score,
        scores,
        meilleure_phrase
    )


# ==========================================
# 6. CHATBOT
# ==========================================

SEUIL = 0.70


print("\n🤖 Chatbot démarré !")
print("Écris 'quit' pour quitter.\n")


while True:

    message = input("👤 Toi : ")


    # Quitter le programme
    if message.lower() == "quit":

        print("🤖 À bientôt !")
        break


    # Comprendre le message
    intention, score, scores, phrase_proche = comprendre(message)


    # Afficher les résultats
    print("\n===== ANALYSE =====")

    print(
        "Score :",
        round(score, 4)
    )

    print(
        "Phrase la plus proche :",
        phrase_proche
    )

    print(
        "Intention :",
        intention
    )

    print("\nScores par intention :")

    for intent, score_intent in scores.items():

        print(
            f"  {intent} : {score_intent:.4f}"
        )


    # ======================================
    # RÉPONSE DU CHATBOT
    # ======================================

    if score >= SEUIL:

        if intention == "ask_lesson":

            print(
                "🤖 📚 Bien sûr ! "
                "Voici ta leçon du jour."
            )


        elif intention == "quiz":

            print(
                "🤖 🧠 Bien sûr ! "
                "Préparons un petit quiz."
            )


        elif intention == "definition":

            print(
                "🤖 📖 Je vais t'expliquer "
                "cette notion."
            )


    else:

        print(
            "🤖 Je n'ai pas encore appris "
            "à répondre à cette demande."
        )


    print()