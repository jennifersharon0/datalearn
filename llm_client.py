# ==========================================
# CLIENT LLM (abstraction)
# ==========================================
# But de ce fichier : isoler tout le code qui
# parle à Groq dans un seul endroit. Si un jour
# tu ajoutes Ollama en local, tu n'auras qu'à
# modifier CE fichier — le reste du projet
# (generer_base_connaissances.py, chatbot.py)
# n'aura jamais besoin de savoir quel LLM
# tourne derrière.

import os
import time
import json
import re

from dotenv import load_dotenv
from groq import Groq


load_dotenv()

_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

_modele_selectionne = None


PREFERENCES_MODELES = [
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "llama-3.1-8b-instant",
]


def obtenir_modele():
    """
    Renvoie le meilleur modèle disponible parmi les
    préférences, en interrogeant l'API (donc toujours
    à jour, même si Groq change sa gamme de modèles).

    GROQ_MODELE_FORCE dans le .env permet de forcer un
    modèle précis (utile pour basculer manuellement sur
    un autre modèle si celui utilisé par défaut atteint
    son quota journalier — les quotas Groq sont comptés
    PAR MODÈLE, donc un autre modèle a son propre quota,
    encore intact).
    """

    global _modele_selectionne

    if _modele_selectionne is not None:
        return _modele_selectionne

    modele_force = os.getenv("GROQ_MODELE_FORCE")

    if modele_force:
        _modele_selectionne = modele_force
        print(f"(llm_client) Modèle forcé via .env : {_modele_selectionne}")
        return _modele_selectionne

    modeles_disponibles = [m.id for m in _client.models.list().data]

    for modele_prefere in PREFERENCES_MODELES:
        if modele_prefere in modeles_disponibles:
            _modele_selectionne = modele_prefere
            break

    if _modele_selectionne is None:
        _modele_selectionne = modeles_disponibles[0]

    print(f"(llm_client) Modèle utilisé : {_modele_selectionne}")

    return _modele_selectionne


class QuotaJournalierDepasse(Exception):
    """
    Levée quand Groq signale une limite JOURNALIÈRE dépassée
    (TPD, "tokens per day"), par opposition à une limite par
    minute (TPM). Contrairement à une limite par minute,
    attendre 5 ou 10 secondes ne sert strictement à rien ici :
    le quota se renouvelle en dizaines de minutes, parfois le
    lendemain. Continuer à réessayer dans cette situation ne
    fait que gaspiller du temps (et potentiellement un peu de
    quota supplémentaire) sur des appels voués à l'échec.
    """
    pass


def generer(prompt, system=None, temperature=0.4, max_tentatives=3):
    """
    Envoie un prompt au LLM et renvoie sa réponse en texte.

    Réessaie automatiquement en cas d'erreur temporaire
    (ex: limite de requêtes PAR MINUTE atteinte), avec
    une pause qui s'allonge à chaque tentative
    ("backoff exponentiel" : 5s, puis 10s, puis 20s...).

    En revanche, une limite JOURNALIÈRE n'est PAS réessayée :
    elle lève immédiatement QuotaJournalierDepasse, à charger
    au code appelant de décider quoi faire (typiquement :
    arrêter proprement plutôt que de s'acharner sur les sujets
    suivants, qui échoueraient tous pour la même raison).
    """

    messages = []

    if system:
        messages.append({"role": "system", "content": system})

    messages.append({"role": "user", "content": prompt})

    for tentative in range(1, max_tentatives + 1):

        try:

            reponse = _client.chat.completions.create(
                model=obtenir_modele(),
                messages=messages,
                temperature=temperature,
            )

            return reponse.choices[0].message.content

        except Exception as erreur:

            message_erreur = str(erreur)

            if "tokens per day" in message_erreur or "(TPD)" in message_erreur:
                raise QuotaJournalierDepasse(message_erreur) from erreur

            if tentative == max_tentatives:
                raise

            pause = 5 * (2 ** (tentative - 1))

            print(
                f"   Avertissement : erreur LLM ({erreur}). "
                f"Nouvelle tentative dans {pause}s "
                f"({tentative}/{max_tentatives})..."
            )

            time.sleep(pause)


def _reparer_backslashes_perdus(texte):
    r"""
    Corrige un problème JSON fréquent avec du contenu mathématique :
    le LLM écrit parfois des formules en notation LaTeX (\top, \times,
    \(...\)), dont les barres obliques inversées ne sont PAS des
    séquences d'échappement JSON valides (seules \", \\, \/, \b, \f,
    \n, \r, \t, \u le sont). On double ces barres obliques "nues"
    pour obtenir du JSON valide, sans toucher aux échappements déjà
    corrects.
    """

    return re.sub(r'\\(?!["\\/bfnrtu])', r"\\\\", texte)


def generer_json(prompt, system=None, temperature=0.3, max_tentatives=3):
    """
    Comme generer(), mais s'attend à ce que le LLM renvoie
    du JSON, et le parse pour toi. Utile pour les quiz
    (on veut une liste de questions structurées, pas du
    texte libre).

    Nettoie les ```json ... ``` que les LLM ajoutent parfois
    autour du JSON, même quand on leur demande de ne pas le faire.
    """

    for tentative in range(1, max_tentatives + 1):

        texte = generer(prompt, system=system, temperature=temperature)

        texte_nettoye = (
            texte.strip()
            .removeprefix("```json")
            .removeprefix("```")
            .removesuffix("```")
            .strip()
        )

        try:
            return json.loads(texte_nettoye)

        except json.JSONDecodeError:

            # Avant d'abandonner cette tentative, on essaie de réparer
            # les backslashes non échappés (cause la plus fréquente
            # d'échec sur du contenu mathématique).
            try:
                texte_repare = _reparer_backslashes_perdus(texte_nettoye)
                resultat = json.loads(texte_repare)

                print(
                    "   Avertissement : JSON réparé automatiquement "
                    "(barres obliques inversées non échappées détectées)."
                )

                return resultat

            except json.JSONDecodeError:
                pass

            if tentative == max_tentatives:
                print(
                    "   Avertissement : le LLM n'a pas renvoyé un JSON valide "
                    "après plusieurs tentatives. Réponse brute :"
                )
                print(texte)
                return None

            print(
                f"   Avertissement : JSON invalide, nouvelle tentative "
                f"({tentative}/{max_tentatives})..."
            )