from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity


# ==========================================
# 1. INTENTIONS
# ==========================================

intents = {

    "ask_lesson": [
        "Je veux apprendre quelque chose",
        "Donne-moi une leçon",
        "Apprends-moi quelque chose",
        "Je veux découvrir une nouvelle notion",
        "Donne-moi la leçon du jour",
        "J'aimerais approfondir mes connaissances",
        "Je veux améliorer mes connaissances",
        "Je veux enrichir mes connaissances",
        "J'aimerais apprendre de nouvelles choses",
        "Je veux développer mes connaissances",
        "Je veux progresser dans mes connaissances"
    ],

    "ask_definition": [
        "Qu'est-ce qu'un embedding",
        "C'est quoi le machine learning",
        "Explique-moi le NLP",
        "Que signifie overfitting",
        "Je veux comprendre cette notion"
    ],

    "quizz": [
        "Fais-moi un quiz",
        "Interroge-moi",
        "Teste mes connaissances",
        "Pose-moi des questions",
        "Je veux faire un quizz"
    ]
}


# ==========================================
# 2. CHARGER LE MODÈLE
# ==========================================

model = SentenceTransformer("all-MiniLM-L6-v2")


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


# ==========================================
# 5. DÉTECTER L'INTENTION
# ==========================================

def detect_intent(message):

    message_embedding = model.encode([message])

    scores = cosine_similarity(
        message_embedding,
        embeddings
    )

    best_index = scores.argmax()

    best_score = scores[0][best_index]

    print("Score :", best_score)
    print("Phrase la plus proche :", phrases[best_index])
    print("Intention :", labels[best_index])

    if best_score < 0.40:
        return "unknown"

    return labels[best_index]


# ==========================================
# 6. RÉPONDRE
# ==========================================

def respond(intent):

    if intent == "ask_lesson":

        return "📚 Bien sûr ! Voici ta leçon du jour."

    elif intent == "ask_definition":

        return "🧠 Bien sûr ! Quel concept veux-tu que je t'explique ?"

    elif intent == "quizz":

        return "🎯 Avec plaisir ! Préparons un petit quiz."

    elif intent == "unknown":

        return "Je ne suis pas encore sûr de comprendre ta demande."

    return "Je n'ai pas encore appris à répondre à cette demande."


# ==========================================
# 7. CHATBOT
# ==========================================

print("🤖 Bonjour ! Je suis ton assistant.")
print("🤖 Tape 'quitter' pour arrêter.\n")


while True:

    message = input("👤 Toi : ")

    if message.lower() == "quitter":

        print("🤖 À bientôt !")
        break

    intent = detect_intent(message)

    response = respond(intent)

    print("🤖", response)

    print("   [Intent :", intent, "]")