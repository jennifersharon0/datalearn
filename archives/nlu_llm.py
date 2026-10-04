# ==========================================
# COMPRÉHENSION DU MESSAGE (via LLM)
# ==========================================
# Remplace l'ancien système par embeddings
# (comprendre() / comprendre_sujet() dans
# l'ancien chatbot.py).
#
# Pourquoi ce changement : avec 190 sujets,
# comparer le message à une moyenne de quelques
# phrases d'exemple par sujet devient peu fiable
# (trop de sujets proches sémantiquement).
#
# Le catalogue (190 titres) tient largement dans
# le contexte d'un LLM : on lui demande donc
# directement de choisir, plutôt que de refaire
# nous-mêmes une présélection par similarité.

from llm_client import generer_json
from base_connaissances import construire_catalogue_texte


INTENTIONS_VALIDES = ["ask_lesson", "quiz", "definition", "autre"]


def classifier_message(message, db, debug=False):
    """
    Envoie le message de l'utilisateur + le catalogue complet
    des sujets au LLM, et lui demande de renvoyer :
      - l'intention (ask_lesson / quiz / definition / autre)
      - le sujet correspondant (son "slug" exact), ou null

    Renvoie un tuple (intention, sujet_slug).
    En cas de problème (JSON invalide, slug halluciné qui
    n'existe pas dans la base...), on retombe sur des valeurs
    sûres ("autre", None) plutôt que de planter.
    """

    catalogue = construire_catalogue_texte(db)

    prompt = f"""Voici le catalogue des sujets disponibles dans un chatbot éducatif de data science :

{catalogue}

Message de l'utilisateur : "{message}"

Détermine deux choses :

1. "intention" : une valeur PARMI EXACTEMENT :
   - "ask_lesson" : l'utilisateur veut apprendre/étudier un sujet (une leçon complète)
   - "quiz" : l'utilisateur veut être testé/interrogé sur un sujet
   - "definition" : l'utilisateur veut une définition rapide d'un terme précis
   - "autre" : salutation, remerciement, hors-sujet, ou rien de précis

2. "sujet_slug" : le slug EXACT (copié tel quel depuis la liste ci-dessus,
   avant les ":") qui correspond le mieux à la demande. Mets null si aucun
   sujet de la liste ne correspond clairement.

Réponds UNIQUEMENT avec un JSON de cette forme exacte, sans aucun texte autour,
sans balises markdown :
{{"intention": "...", "sujet_slug": "..." ou null}}
"""

    system = (
        "Tu es un classifieur précis. Tu réponds UNIQUEMENT en JSON valide, "
        "jamais de texte explicatif, jamais de balises ```."
    )

    resultat = generer_json(prompt, system=system)

    if debug:
        print(f"(debug) classification brute : {resultat}")

    if resultat is None:
        return "autre", None

    intention = resultat.get("intention", "autre")
    sujet_slug = resultat.get("sujet_slug")

    # Garde-fou : si le LLM invente une intention qui n'existe
    # pas dans notre liste, on retombe sur "autre".
    if intention not in INTENTIONS_VALIDES:
        intention = "autre"

    # Garde-fou : si le LLM "hallucine" un slug qui n'existe pas
    # réellement dans notre base, on le traite comme absent plutôt
    # que de planter en cherchant une clé inexistante plus tard.
    if sujet_slug not in db:
        sujet_slug = None

    return intention, sujet_slug