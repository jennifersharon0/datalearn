from transformers import AutoTokenizer, AutoModel
import torch


# ==========================================
# 1. Charger le modèle
# ==========================================

model_name = "sentence-transformers/all-MiniLM-L6-v2"

tokenizer = AutoTokenizer.from_pretrained(model_name)

model = AutoModel.from_pretrained(
    model_name,
    output_attentions=True
)


# ==========================================
# 2. Notre phrase
# ==========================================

phrase = "Je veux apprendre Python"


# ==========================================
# 3. Tokenisation
# ==========================================

inputs = tokenizer(
    phrase,
    return_tensors="pt"
)


tokens = tokenizer.convert_ids_to_tokens(
    inputs["input_ids"][0]
)


print("\n===== TOKENS =====")

for i, token in enumerate(tokens):
    print(i, "→", token)


# ==========================================
# 4. Faire passer la phrase dans le modèle
# ==========================================

with torch.no_grad():

    outputs = model(**inputs)


# ==========================================
# 5. Récupérer les attentions
# ==========================================

attentions = outputs.attentions


print("\n===== ATTENTION =====")

print("Nombre de couches :", len(attentions))

print(
    "Shape d'une couche :",
    attentions[0].shape
)

# ==========================================
# 6. Regarder une tête d'attention
# ==========================================

attention = attentions[0][0, 0]

print("\n===== MATRICE D'ATTENTION =====")
print(attention)


# ==========================================
# 7. Regarder l'attention de "python"
# ==========================================

index_python = tokens.index("python")

attention_python = attention[index_python]

print("\n===== ATTENTION DE PYTHON =====")

for token, score in zip(tokens, attention_python):
    print(f"{token:8} → {score.item():.4f}")