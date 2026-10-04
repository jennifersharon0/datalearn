# ==========================================
# TEST DE CONNEXION À L'API GROQ
# ==========================================
# But : vérifier que ta clé API fonctionne
# avant de construire quoi que ce soit dessus.

import os
from dotenv import load_dotenv
from groq import Groq


# ------------------------------------------
# 1. Charger la clé depuis le fichier .env
# ------------------------------------------

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    raise ValueError(
        "❌ GROQ_API_KEY introuvable. "
        "Vérifie que ton fichier .env existe bien "
        "et contient GROQ_API_KEY=gsk_..."
    )

print("✅ Clé API trouvée (elle commence par : "
      f"{api_key[:7]}...)")


# ------------------------------------------
# 2. Créer le client Groq
# ------------------------------------------

client = Groq(api_key=api_key)


# ------------------------------------------
# 2bis. Demander à l'API la liste des modèles
#       disponibles MAINTENANT, plutôt que de
#       coder en dur un nom qui peut changer
#       (Groq fait évoluer sa gamme régulièrement).
# ------------------------------------------

print("📋 Récupération des modèles disponibles...\n")

modeles_disponibles = [m.id for m in client.models.list().data]

for m in modeles_disponibles:
    print("-", m)

# On préfère un modèle "generaliste" costaud si possible,
# sinon on prend le premier disponible.

PREFERENCES = [
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "llama-3.1-8b-instant",
    "openai/gpt-oss-20b",
]

modele_choisi = None

for pref in PREFERENCES:
    if pref in modeles_disponibles:
        modele_choisi = pref
        break

if modele_choisi is None:
    modele_choisi = modeles_disponibles[0]

print(f"\n✅ Modèle sélectionné : {modele_choisi}\n")


# ------------------------------------------
# 3. Envoyer une première question au modèle
# ------------------------------------------

print("🤖 Envoi d'une question test au modèle...\n")

reponse = client.chat.completions.create(
    model=modele_choisi,
    messages=[
        {
            "role": "user",
            "content": (
                "En une phrase simple, explique ce "
                "qu'est un embedding en Data Science."
            )
        }
    ],
    temperature=0.5,
)


# ------------------------------------------
# 4. Afficher la réponse
# ------------------------------------------
# La réponse du modèle se trouve dans :
# reponse.choices[0].message.content
# (structure identique à l'API OpenAI, très
# répandue chez les fournisseurs de LLM)

texte_reponse = reponse.choices[0].message.content

print("📖 Réponse du modèle :")
print(texte_reponse)

print("\n✅ Tout fonctionne ! Tu es prête pour la suite.")