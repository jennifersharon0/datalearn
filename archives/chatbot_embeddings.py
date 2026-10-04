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
# 4. CRÉER LES EMBEDDINGS
# ==========================================

embeddings = model.encode(phrases)


print("Nombre de phrases :", len(phrases))
print("Shape des embeddings :", embeddings.shape)


# ==========================================
# 5. FONCTION DE PRÉDICTION
# ==========================================

def comprendre(message):

    # Transformer le message en embedding
    message_embedding = model.encode([message])

    # Calculer les similarités
    scores = cosine_similarity(
        message_embedding,
        embeddings
    )[0]

    # Trouver le meilleur score
    meilleur_index = scores.argmax()

    meilleur_score = scores[meilleur_index]

    meilleure_intention = labels[meilleur_index]

    phrase_proche = phrases[meilleur_index]

    return (
        meilleure_intention,
        meilleur_score,
        phrase_proche
    )


# ==========================================
# 6. CHATBOT
# ==========================================

SEUIL = 0.70

print("\n🤖 Chatbot démarré !")
print("Écris 'quit' pour quitter.\n")


while True:

    message = input("👤 Toi : ")

    if message.lower() == "quit":
        print("🤖 À bientôt !")
        break

    intention, score, phrase_proche = comprendre(message)

    print("\nScore :", round(score, 4))
    print("Phrase la plus proche :", phrase_proche)
    print("Intention :", intention)

    if score >= SEUIL:

        if intention == "ask_lesson":
            print("🤖 📚 Bien sûr ! Voici ta leçon du jour.")

        elif intention == "quiz":
            print("🤖 🧠 Bien sûr ! Préparons un petit quiz.")

        elif intention == "definition":
            print("🤖 📖 Je vais t'expliquer cette notion.")

    else:

        print("🤖 Je n'ai pas encore appris à répondre à cette demande.")

    print()