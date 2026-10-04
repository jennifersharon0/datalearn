# Fichier : tests/test_streak.py
#
# Teste le calcul de la série de jours d'activité (calculer_streak, dans
# stockage_progression.py). La date du jour est fixée par le paramètre
# jour_courant : les résultats ne dépendent donc pas du jour où l'on lance
# les tests.

from datetime import date, timedelta

from stockage_progression import calculer_streak


# Un dimanche quelconque, qui sert de "aujourd'hui" dans tous les tests.
AUJOURD_HUI = date(2026, 10, 4)


def il_y_a(jours):
    """La date d'il y a `jours` jours."""
    return AUJOURD_HUI - timedelta(days=jours)


def test_aucune_activite():
    assert calculer_streak([], jour_courant=AUJOURD_HUI) == 0


def test_actif_seulement_aujourd_hui():
    assert calculer_streak([AUJOURD_HUI], jour_courant=AUJOURD_HUI) == 1


def test_trois_jours_de_suite():
    jours = [il_y_a(2), il_y_a(1), il_y_a(0)]
    assert calculer_streak(jours, jour_courant=AUJOURD_HUI) == 3


def test_la_serie_tient_encore_si_le_dernier_jour_est_hier():
    # Le matin, avant de s'être connecté, la série d'hier n'est pas perdue.
    jours = [il_y_a(3), il_y_a(2), il_y_a(1)]
    assert calculer_streak(jours, jour_courant=AUJOURD_HUI) == 3


def test_la_serie_est_perdue_apres_un_jour_sans_activite():
    jours = [il_y_a(4), il_y_a(3), il_y_a(2)]
    assert calculer_streak(jours, jour_courant=AUJOURD_HUI) == 0


def test_un_trou_coupe_la_serie():
    # Actif il y a 5 et 4 jours, puis une pause, puis les 2 derniers jours :
    # seule la partie qui touche aujourd'hui compte.
    jours = [il_y_a(5), il_y_a(4), il_y_a(1), il_y_a(0)]
    assert calculer_streak(jours, jour_courant=AUJOURD_HUI) == 2


def test_l_ordre_et_les_doublons_ne_changent_rien():
    jours = [il_y_a(0), il_y_a(1), il_y_a(0), il_y_a(1)]
    assert calculer_streak(jours, jour_courant=AUJOURD_HUI) == 2


def test_passage_d_un_mois_a_l_autre():
    jours = [date(2026, 9, 29), date(2026, 9, 30), date(2026, 10, 1)]
    assert calculer_streak(jours, jour_courant=date(2026, 10, 1)) == 3