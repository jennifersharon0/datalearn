# ==========================================
# RÉPONSES LLM (questions libres, définitions)
# ==========================================
# Logique partagée entre chatbot.py (terminal) et main.py (API) :
# écrite une seule fois ici, utilisée aux deux endroits, pour ne
# jamais avoir deux versions du même prompt qui divergent avec
# le temps.

from threading import Lock

from llm_client import generer


# Définitions déjà obtenues, rangées par sujet. La définition d'un sujet est
# la même pour tout le monde : une fois demandée au LLM, on la garde en
# mémoire et les visiteurs suivants la reçoivent instantanément, sans
# consommer de quota Groq. Le cache se vide quand le serveur redémarre.
_definitions_en_cache = {}
_verrou_cache = Lock()


def repondre_question_libre(db, sujet_slug, question):

    lecon = db[sujet_slug]

    prompt = f"""Voici une leçon sur "{lecon['title']}" :

---
{lecon['content']}
---

L'étudiant(e) te dit : "{question}"

Consignes :
- Si ce n'est pas vraiment une question mais juste une annonce
  (par exemple "j'ai une question", "je voudrais te demander un truc"),
  réponds simplement "Vas-y, je t'écoute !" et rien d'autre.
- Si c'est une vraie question sur le sujet, réponds en te basant sur
  la leçon ci-dessus, en reformulant clairement avec tes propres mots.
  Si la leçon ne suffit pas pour répondre complètement, tu peux
  compléter avec tes connaissances générales, mais précise dans ce
  cas que ce complément ne vient pas directement du cours.
- Réponds en français, de façon concise (3 à 5 phrases maximum).
- Ne mets aucune formule de politesse inutile ("Bonjour", "N'hésitez pas...").
"""

    system = (
        "Tu es un pédagogue patient et clair, spécialisé en data science. "
        "Tu réponds toujours en français."
    )

    return generer(prompt, system=system)


def obtenir_definition_courte(db, sujet_slug):

    # Déjà demandée : on renvoie la version gardée en mémoire.
    with _verrou_cache:
        if sujet_slug in _definitions_en_cache:
            return _definitions_en_cache[sujet_slug]

    lecon = db[sujet_slug]

    prompt = f"""Voici une leçon sur "{lecon['title']}" :

---
{lecon['content'][:1200]}
---

Donne une définition simple et courte (1 à 2 phrases maximum) de
"{lecon['title']}", à partir de ce contenu. Réponds directement par
la définition, sans introduction du type "Voici la définition".
"""

    system = "Tu réponds en français, de façon très concise."

    definition = generer(prompt, system=system)

    # On ne garde que les vraies réponses : si generer() échoue, il lève une
    # erreur et on n'arrive pas jusqu'ici, donc rien de faux n'est mis en cache.
    if definition:
        with _verrou_cache:
            _definitions_en_cache[sujet_slug] = definition

    return definition