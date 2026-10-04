from sklearn.feature_extraction.text import TfidfVectorizer
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
        "Donne-moi la leçon du jour"
    ],

    "ask_definition": [
        "Qu'est-ce qu'un embedding",
        "C'est quoi le machine learning",
        "Explique-moi le NLP",
        "Que signifie le mot overfitting",
        "Je veux comprendre cette notion"
    ],

    "quiz": [
        "Fais-moi un quiz",
        "Interroge-moi",
        "Teste mes connaissances",
        "Pose-moi des questions",
        "Je veux faire un quiz"
    ]
}


# ==========================================
# 2. PRÉPARERATION DES DONNÉES
# ==========================================

phrases = []
labels = []

for intent, exemples in intents.items():

    for exemple in exemples:

        phrases.append(exemple)
        labels.append(intent)


# ==========================================
# 3. TF-IDF
# ==========================================

vectorizer = TfidfVectorizer()

X = vectorizer.fit_transform(phrases)


# ==========================================
# 4. DÉTECTION DE L'INTENTION
# ==========================================

def detect_intent(message):

    message_vector = vectorizer.transform([message])

    scores = cosine_similarity(message_vector, X)

    best_index = scores.argmax()

    best_score = scores[0][best_index]
    print("Score:", best_score)

    if best_score < 0.30:
        return "unknown"

    return labels[best_index]


# ==========================================
# 5. RÉPONSE
# ==========================================

def respond(intent):

    if intent == "ask_lesson":

        return "Bien sûr ! Voici ta leçon du jour 📚"

    elif intent == "ask_definition":

        return "Bien sûr ! Donne-moi le terme que tu souhaites comprendre 🧠"

    elif intent == "quiz":

        return "Avec plaisir ! Préparons un petit quiz 🎯"

    elif intent == "unknown":

        return "Je ne suis pas encore sûr de comprendre ta demande."

    else:

        return "Je n'ai pas encore de réponse."


# ==========================================
# 6. CHATBOT
# ==========================================

print("🤖 Bonjour ! Je suis ton assistant d'apprentissage.")
print("🤖 Écris 'quitter' pour arrêter.\n")


while True:

    message = input("👤 Toi : ")

    if message.lower() == "quitter":

        print("🤖 À bientôt !")
        break

    intent = detect_intent(message)

    response = respond(intent)

    print("🤖", response)

    print("   [Intent détectée :", intent, "]")