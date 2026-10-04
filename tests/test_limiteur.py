# Fichier : tests/test_limiteur.py
#
# Teste le limiteur d'appels au LLM (limiteur.py). Attendre une vraie heure
# serait impossible dans un test : on remplace donc l'horloge du limiteur
# par une horloge factice, qu'on avance à la main.

import pytest
from fastapi import HTTPException

import limiteur
from limiteur import LimiteurDebit


class HorlogeFactice:
    """Remplace time.monotonic() : renvoie l'heure qu'on lui a fixée."""

    def __init__(self):
        self.maintenant = 1000.0

    def __call__(self):
        return self.maintenant

    def avancer(self, secondes):
        self.maintenant += secondes


@pytest.fixture
def horloge(monkeypatch):
    factice = HorlogeFactice()
    # Le limiteur appelle time.monotonic() : on remplace cette fonction-là.
    monkeypatch.setattr(limiteur.time, "monotonic", factice)
    return factice


def test_accepte_jusqu_a_la_limite(horloge):
    limite = LimiteurDebit(nombre_max=3, fenetre_secondes=60)
    for _ in range(3):
        limite.verifier("alice")  # aucune erreur attendue


def test_refuse_au_dela_avec_un_delai_d_attente(horloge):
    limite = LimiteurDebit(nombre_max=3, fenetre_secondes=60)
    for _ in range(3):
        limite.verifier("alice")
        horloge.avancer(10)

    # pytest.raises vérifie que l'appel lève bien l'erreur attendue.
    with pytest.raises(HTTPException) as erreur:
        limite.verifier("alice")

    assert erreur.value.status_code == 429
    # Premier appel à t = 1000, fenêtre de 60 s, on est à t = 1030 :
    # une place se libère dans 30 secondes.
    assert erreur.value.headers["Retry-After"] == "30"


def test_accepte_de_nouveau_quand_la_fenetre_est_passee(horloge):
    limite = LimiteurDebit(nombre_max=2, fenetre_secondes=60)
    limite.verifier("alice")
    limite.verifier("alice")

    horloge.avancer(61)
    limite.verifier("alice")  # les deux anciens appels sont oubliés


def test_chaque_utilisateur_a_son_propre_compteur(horloge):
    limite = LimiteurDebit(nombre_max=1, fenetre_secondes=60)
    limite.verifier("alice")

    # alice a atteint sa limite, mais bob n'est pas concerné.
    limite.verifier("bob")
    with pytest.raises(HTTPException):
        limite.verifier("alice")