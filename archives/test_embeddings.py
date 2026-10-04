from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity


# 1. Charger le modèle
model = SentenceTransformer("all-MiniLM-L6-v2")


# 2. Nos phrases
phrases = [
    "Je veux apprendre Python",
    "Je souhaite me former en Python",
    "Je veux apprendre le machine learning",
    "Je voudrais réserver une chambre d'hôtel",
    "Le ciel est bleu aujourd'hui"
]


# 3. Créer les embeddings
embeddings = model.encode(phrases)


# 4. Afficher la dimension
print("Shape :", embeddings.shape)


# 5. Calculer les similarités
similarites = cosine_similarity(embeddings)


# 6. Afficher les résultats
for i in range(len(phrases)):

    for j in range(i + 1, len(phrases)):

        print()
        print("Phrase 1 :", phrases[i])
        print("Phrase 2 :", phrases[j])
        print("Score :", similarites[i][j])