# Fichier : tests/test_stockage.py
#
# Teste les vraies requêtes SQL de stockage_progression.py, sur une base
# PostgreSQL de test. Les autres tests utilisent un stockage en mémoire :
# celui-ci vérifie la partie qu'ils ne peuvent pas voir, c'est-à-dire que
# chaque requête filtre bien sur le user_id et que les jours sont comptés
# à l'heure de Paris.
#
# Ce fichier ne s'exécute que si TEST_DATABASE_URL est définie, et elle ne
# doit JAMAIS pointer vers la base Supabase de l'application : les tests y
# écrivent et y effacent des données. Sans cette variable, pytest le marque
# "skipped" (ignoré), ce qui est normal.
#
# La base de test doit contenir une table auth.users, comme Supabase :
#     CREATE SCHEMA auth;
#     CREATE TABLE auth.users (id UUID PRIMARY KEY);

import os

import pytest

URL_TEST = os.getenv("TEST_DATABASE_URL")

# pytestmark s'applique à tous les tests du fichier.
pytestmark = pytest.mark.skipif(not URL_TEST, reason="TEST_DATABASE_URL non définie")

import stockage_progression as stockage

ALICE = "11111111-1111-1111-1111-111111111111"
BOB = "22222222-2222-2222-2222-222222222222"


@pytest.fixture(autouse=True)
def base_de_test(monkeypatch):
    """Dirige le stockage vers la base de test, et y repart d'une table vide."""
    monkeypatch.setenv("DATABASE_URL", URL_TEST)

    stockage.initialiser_schema()

    conn = stockage.obtenir_connexion()
    with conn, conn.cursor() as cur:
        cur.execute("DELETE FROM evenements")
        cur.execute(
            "INSERT INTO auth.users (id) VALUES (%s), (%s) ON CONFLICT DO NOTHING",
            (ALICE, BOB),
        )
    conn.close()


def inserer_a(user_id, horodatage_utc):
    """Ajoute une leçon vue à une heure UTC précise ('AAAA-MM-JJ HH:MM')."""
    conn = stockage.obtenir_connexion()
    with conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO evenements (user_id, sujet_slug, type_evenement, horodatage) "
            "VALUES (%s, 'sujet', 'lecon_vue', %s)",
            (user_id, horodatage_utc),
        )
    conn.close()


def test_les_donnees_d_alice_restent_chez_alice():
    stockage.enregistrer_lecon_vue(ALICE, "regression_lineaire")
    stockage.enregistrer_quiz(ALICE, "regression_lineaire", 7, 8)

    assert stockage.sujets_vus(ALICE) == ["regression_lineaire"]
    assert len(stockage.historique_quiz(ALICE)) == 1

    assert stockage.sujets_vus(BOB) == []
    assert stockage.historique_quiz(BOB) == []
    assert stockage.jours_actifs(BOB) == []
    assert stockage.progression_par_sujet(BOB) == []
    assert stockage.activite_par_jour(BOB) == []


def test_minuit_et_demi_en_france_compte_pour_le_bon_jour():
    # 22 h 30 UTC le 3 octobre = 0 h 30 à Paris le 4 octobre (heure d'été).
    inserer_a(ALICE, "2026-10-03 22:30")
    assert [j.isoformat() for j in stockage.jours_actifs(ALICE)] == ["2026-10-04"]
    assert stockage.activite_par_jour(ALICE, nombre_de_jours=100_000)[0]["date"] == "2026-10-04"


def test_dates_envoyees_avec_leur_fuseau():
    # "+00:00" indique au navigateur que l'heure est en UTC : il la
    # convertit alors correctement à l'heure locale.
    stockage.enregistrer_quiz(ALICE, "regression_lineaire", 7, 8)

    (quiz,) = stockage.historique_quiz(ALICE)
    assert quiz["horodatage"].isoformat().endswith("+00:00")
    assert stockage.progression_par_sujet(ALICE)[0]["derniere_activite"].endswith("+00:00")


def test_meilleur_pourcentage_par_sujet():
    stockage.enregistrer_quiz(ALICE, "regression_lineaire", 4, 8)
    stockage.enregistrer_quiz(ALICE, "regression_lineaire", 7, 8)

    (sujet,) = stockage.progression_par_sujet(ALICE)
    assert sujet["meilleur_pourcentage"] == 88  # 7 / 8 = 87,5 %, arrondi
    assert sujet["lue"] is False