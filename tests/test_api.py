# Fichier : tests/test_api.py
#
# Teste les routes du serveur (main.py) comme le ferait le frontend : on
# envoie de vraies requêtes HTTP au serveur, sans le lancer pour de vrai,
# grâce au client de test de FastAPI.
#
# Les fixtures de conftest.py s'occupent du reste : base de connaissances
# connue d'avance, stockage en mémoire, utilisateurs simulés. Aucun test
# ne touche à Supabase ni à Groq.

from conftest import en_tant_que
from llm_client import QuotaJournalierDepasse

import main


# ---------------------------------------------------------------------------
# Leçons et quiz
# ---------------------------------------------------------------------------

def test_lecon_renvoyee_et_enregistree_comme_vue(client, stockage):
    reponse = client.get("/lessons/regression_lineaire", headers=en_tant_que("alice"))

    assert reponse.status_code == 200
    assert reponse.json()["titre"] == "Régression linéaire"
    assert stockage.sujets_vus("alice") == ["regression_lineaire"]


def test_sujet_inconnu(client):
    reponse = client.get("/lessons/sujet_qui_n_existe_pas", headers=en_tant_que("alice"))
    assert reponse.status_code == 404


def test_le_quiz_ne_contient_pas_les_reponses(client):
    reponse = client.get("/lessons/regression_lineaire/quiz", headers=en_tant_que("alice"))

    assert reponse.status_code == 200
    # On cherche "answer" dans tout le texte de la réponse : il ne doit
    # apparaître nulle part, sous aucune forme.
    assert "answer" not in reponse.text


def test_quiz_corrige_par_le_serveur_et_enregistre(client, stockage):
    reponse = client.post(
        "/lessons/regression_lineaire/quiz/submit",
        json={"reponses": [1, 2, 4]},
        headers=en_tant_que("alice"),
    )

    assert reponse.status_code == 200
    assert reponse.json()["score"] == 2
    assert reponse.json()["total"] == 3

    # Le score enregistré est celui calculé par le serveur.
    quiz = stockage.de("alice", "quiz")
    assert len(quiz) == 1
    assert (quiz[0]["score"], quiz[0]["total"]) == (2, 3)


def test_reponses_mal_formees_refusees(client):
    # Du texte à la place des numéros de réponse : FastAPI refuse avec 422.
    reponse = client.post(
        "/lessons/regression_lineaire/quiz/submit",
        json={"reponses": ["la bonne"]},
        headers=en_tant_que("alice"),
    )
    assert reponse.status_code == 422


def test_trop_de_reponses_refusees(client):
    reponse = client.post(
        "/lessons/regression_lineaire/quiz/submit",
        json={"reponses": [1] * (main.NOMBRE_MAX_REPONSES + 1)},
        headers=en_tant_que("alice"),
    )
    assert reponse.status_code == 422


# ---------------------------------------------------------------------------
# Séparation des comptes
# ---------------------------------------------------------------------------

def test_chaque_utilisateur_ne_voit_que_sa_progression(client):
    # alice lit une leçon et réussit un quiz ; bob ne fait rien.
    client.get("/lessons/regression_lineaire", headers=en_tant_que("alice"))
    client.post(
        "/lessons/regression_lineaire/quiz/submit",
        json={"reponses": [1, 2, 3]},
        headers=en_tant_que("alice"),
    )

    alice = client.get("/dashboard", headers=en_tant_que("alice")).json()
    bob = client.get("/dashboard", headers=en_tant_que("bob")).json()

    assert alice["sujets_completes"] == 1
    assert len(alice["historique_quiz"]) == 1

    # Rien de ce qu'a fait alice n'apparaît chez bob.
    assert bob["sujets_completes"] == 0
    assert bob["historique_quiz"] == []
    assert client.get("/progress", headers=en_tant_que("bob")).json() == []


# ---------------------------------------------------------------------------
# Questions à l'assistant
# ---------------------------------------------------------------------------

def test_question_transmise_au_llm(client, monkeypatch):
    # On remplace la fonction qui appelle Groq par une réponse fixe.
    monkeypatch.setattr(main, "repondre_question_libre", lambda db, slug, question: "Réponse de test")

    reponse = client.post(
        "/questions",
        json={"sujet_slug": "regression_lineaire", "question": "C'est quoi ?"},
        headers=en_tant_que("alice"),
    )

    assert reponse.status_code == 200
    assert reponse.json() == {"reponse": "Réponse de test"}


def test_question_trop_longue_refusee(client):
    reponse = client.post(
        "/questions",
        json={"sujet_slug": "regression_lineaire", "question": "a" * (main.LONGUEUR_MAX_QUESTION + 1)},
        headers=en_tant_que("alice"),
    )
    assert reponse.status_code == 422


def test_quota_groq_epuise_donne_503(client, monkeypatch):
    def quota_epuise(*arguments):
        raise QuotaJournalierDepasse("quota atteint")

    monkeypatch.setattr(main, "repondre_question_libre", quota_epuise)

    reponse = client.post(
        "/questions",
        json={"sujet_slug": "regression_lineaire", "question": "C'est quoi ?"},
        headers=en_tant_que("alice"),
    )
    assert reponse.status_code == 503


def test_panne_du_llm_donne_502_sans_detail_technique(client, monkeypatch):
    def panne(*arguments):
        raise RuntimeError("connexion refusée par api.groq.com")

    monkeypatch.setattr(main, "repondre_question_libre", panne)

    reponse = client.post(
        "/questions",
        json={"sujet_slug": "regression_lineaire", "question": "C'est quoi ?"},
        headers=en_tant_que("alice"),
    )

    assert reponse.status_code == 502
    # Le message d'erreur interne ne doit jamais être envoyé au navigateur.
    assert "groq" not in reponse.text.lower()


def test_trop_de_questions_donne_429(client, monkeypatch):
    monkeypatch.setattr(main, "repondre_question_libre", lambda db, slug, question: "ok")
    # Limite abaissée à 2 pour ce test, au lieu de 30 par heure.
    monkeypatch.setattr(main.LIMITE_QUESTIONS, "nombre_max", 2)

    corps = {"sujet_slug": "regression_lineaire", "question": "C'est quoi ?"}
    codes = [client.post("/questions", json=corps, headers=en_tant_que("alice")).status_code for _ in range(3)]

    assert codes == [200, 200, 429]
    # bob, lui, peut encore poser sa question.
    assert client.post("/questions", json=corps, headers=en_tant_que("bob")).status_code == 200