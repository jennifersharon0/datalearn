# ==========================================
# CHARGEMENT DE LA BASE DE CONNAISSANCES
# ==========================================
# Ce fichier a une seule responsabilité : lire
# knowledge_db.json et le rendre facile à utiliser
# pour le reste du chatbot. Il ne contient AUCUNE
# logique de conversation.

import json
import os


FICHIER_DB = "knowledge_db.json"


def charger_connaissances(fichier=FICHIER_DB):
    """
    Charge la base générée par generer_base_connaissances.py.

    Lève une erreur claire si le fichier n'existe pas encore,
    plutôt qu'un message Python cryptique — c'est un piège
    classique pour l'utilisateur qui lance chatbot.py avant
    d'avoir généré le contenu.
    """

    if not os.path.exists(fichier):

        raise FileNotFoundError(
            f"Le fichier '{fichier}' n'existe pas encore.\n"
            f"   Lance d'abord : python generer_base_connaissances.py"
        )

    with open(fichier, "r", encoding="utf-8") as f:
        return json.load(f)


def construire_catalogue_texte(db):
    """
    Transforme la base en une liste texte, lisible par un LLM,
    de la forme :
        - slug : Titre (catégorie : Catégorie)

    C'est ce texte qu'on enverra dans le prompt de classification
    (voir nlu_llm.py) pour que le LLM sache parmi quels sujets choisir.
    """

    lignes = []

    for slug, infos in db.items():

        lignes.append(
            f"- {slug} : {infos['title']} "
            f"(catégorie : {infos['category']})"
        )

    return "\n".join(lignes)