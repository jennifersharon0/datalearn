# Fichier : tests/test_recherche.py
#
# Teste la recherche de passages de l'assistant global (recherche_lecons.py)
# sur quatre petites leçons écrites à la main. Ces tests ne mesurent pas la
# qualité de la recherche sur les 190 vraies leçons, c'est le rôle de
# l'évaluation : ils vérifient que chaque mécanisme fait bien ce qu'il
# promet (accents, fautes de frappe, sigles, découpage, limite par leçon).

from recherche_lecons import IndexLecons, decouper_lecon, normaliser


PARAGRAPHE = "Un paragraphe de remplissage sur un tout autre point. " * 6

BASE = {
    "regression_logistique": {
        "title": "La régression logistique",
        "category": "Machine Learning",
        "content": (
            "La régression logistique prédit une probabilité grâce à la fonction sigmoïde.\n\n"
            "Les coefficients sont estimés par maximum de vraisemblance."
        ),
    },
    "embeddings_definition": {
        "title": "Qu'est-ce qu'un embedding ?",
        "category": "Embeddings",
        "content": "Un embedding représente le sens d'un mot par une liste de nombres.",
    },
    "knn": {
        "title": "Les k plus proches voisins (k-NN)",
        "category": "Machine Learning",
        "content": "Le k-NN classe un point selon la classe majoritaire de ses voisins.",
    },
    "tf_idf": {
        "title": "TF-IDF",
        "category": "NLP",
        "content": "\n\n".join([PARAGRAPHE] * 6 + ["Le TF-IDF donne du poids aux mots rares."]),
    },
}


def premiere_lecon(index, question):
    resultats = index.rechercher(question)
    return resultats[0].slug if resultats else None


def test_question_simple():
    index = IndexLecons(BASE)
    assert premiere_lecon(index, "Comment marche la régression logistique ?") == "regression_logistique"


def test_question_sans_accents():
    index = IndexLecons(BASE)
    assert premiere_lecon(index, "a quoi sert la fonction sigmoide") == "regression_logistique"


def test_faute_de_frappe_corrigee():
    index = IndexLecons(BASE)
    assert index.corriger("embeding") == "embedding"
    assert premiere_lecon(index, "c'est quoi un embeding") == "embeddings_definition"


def test_sigles_avec_ou_sans_tiret():
    index = IndexLecons(BASE)
    assert normaliser("Le k-NN et le TF-IDF") == "le knn et le tfidf"
    assert premiere_lecon(index, "explique moi le knn") == "knn"
    assert premiere_lecon(index, "le tfidf") == "tf_idf"


def test_mot_inconnu_garde_tel_quel():
    index = IndexLecons(BASE)
    assert index.corriger("tartiflette") == "tartiflette"


def test_rien_ne_correspond():
    index = IndexLecons(BASE)
    assert index.rechercher("tartiflette savoyarde") == []
    assert index.rechercher("") == []


def test_decoupage_respecte_les_paragraphes():
    passages = decouper_lecon("tf_idf", BASE["tf_idf"], taille=700)

    assert len(passages) > 1
    # Aucun paragraphe n'est coupé en deux : chacun se retrouve entier dans un passage.
    assert all(PARAGRAPHE.strip() in p.texte or "TF-IDF donne" in p.texte for p in passages)
    assert all(p.slug == "tf_idf" and p.titre == "TF-IDF" for p in passages)


def test_au_plus_deux_passages_par_lecon():
    index = IndexLecons(BASE)
    resultats = index.rechercher("TF-IDF paragraphe remplissage point")
    assert [p.slug for p in resultats].count("tf_idf") <= 2
