# ==========================================
# RECHERCHE WEB
# ==========================================
# Utilise "ddgs" (le nouveau nom du paquet
# duckduckgo_search) pour :
# 1. chercher des pages pertinentes sur un sujet
# 2. extraire le contenu texte de ces pages
#
# Pas besoin de clé API : DuckDuckGo ne demande
# pas d'authentification pour ces usages légers.

from ddgs import DDGS


def rechercher_sources(requete, max_resultats=4):
    """
    Cherche des pages web pour une requête donnée.

    Retourne une liste de dicts avec les clés :
    "title", "href" (l'URL), "body" (un extrait court).
    """

    with DDGS() as moteur:

        resultats = moteur.text(
            requete,
            region="fr-fr",
            safesearch="moderate",
            max_results=max_resultats,
        )

    return resultats


def extraire_contenu_page(url, max_caracteres=3000):
    """
    Récupère le contenu texte d'une page web.

    Retourne None si la page n'a pas pu être
    récupérée (site qui bloque, timeout, page
    supprimée, etc.) — c'est normal et fréquent
    avec le scraping, il faut toujours prévoir
    ce cas.
    """

    try:

        with DDGS() as moteur:

            resultat = moteur.extract(
                url,
                fmt="text_plain",
            )

        contenu = resultat["content"]

        return contenu[:max_caracteres]

    except Exception as erreur:

        print(f"   Impossible de récupérer {url} ({erreur})")

        return None


def rassembler_contexte(sujet_titre, nb_sources=3):
    """
    Fonction principale utilisée par le pipeline :
    cherche des sources sur un sujet, extrait leur
    contenu, et renvoie un texte combiné utilisable
    comme contexte pour le LLM.

    Renvoie aussi la liste des URLs utilisées, pour
    garder une trace de la provenance (bonne pratique :
    on doit toujours pouvoir dire d'où vient un contenu
    généré automatiquement).
    """

    requete = f"{sujet_titre} data science intelligence artificielle définition"

    resultats = rechercher_sources(requete, max_resultats=nb_sources + 2)

    morceaux_contexte = []
    urls_utilisees = []

    for resultat in resultats:

        if len(urls_utilisees) >= nb_sources:
            break

        url = resultat.get("href")

        if not url:
            continue

        contenu = extraire_contenu_page(url)

        if contenu is None or len(contenu.strip()) < 200:
            # Page vide, trop courte, ou non récupérable :
            # on utilise au moins le petit extrait ("body")
            # renvoyé par la recherche, mieux que rien.
            extrait_court = resultat.get("body", "")
            if extrait_court:
                morceaux_contexte.append(extrait_court)
                urls_utilisees.append(url)
            continue

        morceaux_contexte.append(contenu)
        urls_utilisees.append(url)

    contexte_final = "\n\n---\n\n".join(morceaux_contexte)

    return contexte_final, urls_utilisees