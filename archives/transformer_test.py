from sentence_transformers import SentenceTransformer
import torch


# ==========================================
# 1. Charger le modèle
# ==========================================

model = SentenceTransformer("all-MiniLM-L6-v2")


# ==========================================
# 2. Notre phrase
# ==========================================

phrase = "Je veux apprendre Python"


# ==========================================
# 3. Tokenizer
# ==========================================

tokenizer = model.tokenizer


# ==========================================
# 4. Transformer la phrase en IDs
# ==========================================

features = tokenizer(
    phrase,
    return_tensors="pt"
)

print("\n===== INPUT IDs =====")
print(features["input_ids"])


# ==========================================
# 5. Embeddings initiaux
# ==========================================

with torch.no_grad():

    embeddings_initials = model[0].auto_model.embeddings(
        features["input_ids"]
    )


print("\n===== EMBEDDINGS INITIAUX =====")
print("Shape :", embeddings_initials.shape)


# ==========================================
# 6. Passer dans le Transformer
# ==========================================

with torch.no_grad():

    outputs = model[0].auto_model(
        **features
    )


# ==========================================
# 7. Représentations après Transformer
# ==========================================

representations = outputs.last_hidden_state


print("\n===== APRÈS TRANSFORMER =====")
print("Shape :", representations.shape)


# ==========================================
# 8. Comparer le token Python
# ==========================================

tokens = tokenizer.convert_ids_to_tokens(
    features["input_ids"][0]
)

print("\n===== TOKENS =====")

for i, token in enumerate(tokens):

    print(i, "→", token)


# ==========================================
# 9. Trouver Python
# ==========================================

python_index = tokens.index("python")


avant = embeddings_initials[0][python_index]

apres = representations[0][python_index]


print("\n===== TOKEN PYTHON =====")

print("Avant Transformer :")
print(avant)

print("\nAprès Transformer :")
print(apres)