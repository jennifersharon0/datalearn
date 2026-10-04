from sentence_transformers import SentenceTransformer
import torch


# --------------------------------------------------
# 1. Charger le modèle
# --------------------------------------------------

model = SentenceTransformer("all-MiniLM-L6-v2")


# --------------------------------------------------
# 2. Notre phrase
# --------------------------------------------------

phrase = "Je veux apprendre Python"


# --------------------------------------------------
# 3. Récupérer le tokenizer
# --------------------------------------------------

tokenizer = model.tokenizer


# --------------------------------------------------
# 4. Tokeniser la phrase
# --------------------------------------------------

tokens = tokenizer.tokenize(phrase)

print("\n① TOKENS")
print(tokens)


# --------------------------------------------------
# 5. Transformer les tokens en IDs
# --------------------------------------------------

token_ids = tokenizer.convert_tokens_to_ids(tokens)

print("\n② TOKEN IDs")
print(token_ids)


# --------------------------------------------------
# 6. Obtenir les token embeddings
# --------------------------------------------------

features = tokenizer(
    phrase,
    return_tensors="pt"
)

with torch.no_grad():

    token_embeddings = model[0].auto_model.embeddings(
        features["input_ids"]
    )


print("\n③ TOKEN EMBEDDINGS")
print("Shape :", token_embeddings.shape)


# --------------------------------------------------
# 7. Obtenir l'embedding de la phrase
# --------------------------------------------------

sentence_embedding = model.encode(phrase)

print("\n④ SENTENCE EMBEDDING")
print("Shape :", sentence_embedding.shape)

print(sentence_embedding)