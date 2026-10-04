# Fichier : tests/test_quiz.py
#
# Teste la correction des quiz (moteur_lecons.py). Ce sont des fonctions
# pures : on leur donne une base et des réponses, et on vérifie le résultat,
# sans serveur ni base de données.
#
# Rappel : les réponses sont numérotées à partir de 1, comme dans tout le projet.

from conftest import FAUSSE_BASE
from moteur_lecons import corriger_quiz, obtenir_quiz_sans_reponses


def test_toutes_les_reponses_justes():
    score, total, _ = corriger_quiz(FAUSSE_BASE, "regression_lineaire", [1, 2, 3])
    assert (score, total) == (3, 3)


def test_aucune_reponse_juste():
    score, total, _ = corriger_quiz(FAUSSE_BASE, "regression_lineaire", [4, 4, 4])
    assert (score, total) == (0, 3)


def test_score_partiel_et_detail_des_corrections():
    score, _, corrections = corriger_quiz(FAUSSE_BASE, "regression_lineaire", [1, 3, 3])

    assert score == 2
    # Le corrigé indique, question par question, la réponse donnée et la bonne.
    assert [c["correct"] for c in corrections] == [True, False, True]
    assert corrections[1]["ta_reponse"] == 3
    assert corrections[1]["bonne_reponse"] == 2


def test_reponses_manquantes_comptees_fausses():
    # Une seule réponse envoyée pour trois questions : les deux autres
    # comptent comme fausses, sans faire planter la correction.
    score, total, corrections = corriger_quiz(FAUSSE_BASE, "regression_lineaire", [1])

    assert (score, total) == (1, 3)
    assert corrections[2]["ta_reponse"] is None


def test_reponses_en_trop_ignorees():
    # Des réponses supplémentaires ne doivent pas permettre de dépasser le total.
    score, total, _ = corriger_quiz(FAUSSE_BASE, "regression_lineaire", [1, 2, 3, 1, 2, 3])
    assert (score, total) == (3, 3)


def test_quiz_envoye_sans_les_bonnes_reponses():
    # Protection contre la triche : le navigateur ne reçoit jamais "answer".
    quiz = obtenir_quiz_sans_reponses(FAUSSE_BASE, "regression_lineaire")

    assert len(quiz) == 3
    for q in quiz:
        assert set(q) == {"question", "options"}


def test_quiz_d_un_sujet_inconnu():
    assert obtenir_quiz_sans_reponses(FAUSSE_BASE, "sujet_qui_n_existe_pas") is None