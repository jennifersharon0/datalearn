# Fichier : tests/test_auth.py
#
# Teste la vérification des jetons de connexion (auth_jwt.py), sans Supabase.
# On fabrique une paire de clés comme celle de Supabase : la clé privée
# signe de faux jetons, la clé publique les vérifie. verifier_jeton_avec_cle
# a justement été séparée du téléchargement des clés pour permettre ce test.

import base64
import json
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

import main
from auth_jwt import verifier_jeton_avec_cle


# Deux paires de clés ES256 (l'algorithme utilisé par Supabase) : la bonne,
# et celle d'un faussaire.
CLE_PRIVEE = ec.generate_private_key(ec.SECP256R1())
CLE_PUBLIQUE = CLE_PRIVEE.public_key()
CLE_DU_FAUSSAIRE = ec.generate_private_key(ec.SECP256R1())


def fabriquer_jeton(cle=CLE_PRIVEE, audience="authenticated", expire_dans=3600):
    """Signe un jeton semblable à ceux de Supabase."""
    contenu = {
        "sub": "id-de-alice",
        "aud": audience,
        "exp": int(time.time()) + expire_dans,
    }
    return jwt.encode(contenu, cle, algorithm="ES256")


def test_jeton_valide():
    contenu = verifier_jeton_avec_cle(fabriquer_jeton(), CLE_PUBLIQUE)
    assert contenu["sub"] == "id-de-alice"


def test_jeton_expire_refuse():
    jeton = fabriquer_jeton(expire_dans=-60)
    with pytest.raises(jwt.ExpiredSignatureError):
        verifier_jeton_avec_cle(jeton, CLE_PUBLIQUE)


def test_jeton_signe_par_une_autre_cle_refuse():
    jeton = fabriquer_jeton(cle=CLE_DU_FAUSSAIRE)
    with pytest.raises(jwt.InvalidSignatureError):
        verifier_jeton_avec_cle(jeton, CLE_PUBLIQUE)


def test_jeton_prevu_pour_un_autre_usage_refuse():
    jeton = fabriquer_jeton(audience="anon")
    with pytest.raises(jwt.InvalidAudienceError):
        verifier_jeton_avec_cle(jeton, CLE_PUBLIQUE)


def test_jeton_modifie_refuse():
    # Quelqu'un récupère un vrai jeton et remplace l'identifiant par celui
    # d'un autre compte, en gardant la signature d'origine. La signature ne
    # correspond plus au contenu : le jeton doit être refusé.
    entete, _, signature = fabriquer_jeton().split(".")

    faux_contenu = {"sub": "id-de-bob", "aud": "authenticated", "exp": int(time.time()) + 3600}
    # Un jeton est fait de trois parties encodées en base64, séparées par des points.
    contenu_encode = base64.urlsafe_b64encode(json.dumps(faux_contenu).encode()).decode().rstrip("=")

    with pytest.raises(jwt.InvalidSignatureError):
        verifier_jeton_avec_cle(f"{entete}.{contenu_encode}.{signature}", CLE_PUBLIQUE)


# ---------------------------------------------------------------------------
# Les routes protégées, avec la vraie vérification
# ---------------------------------------------------------------------------
# Ici, pas de faux utilisateur : on vérifie que le serveur refuse bien
# l'accès sans jeton valide, avec la même réponse dans tous les cas.

ROUTES_PROTEGEES = [
    ("get", "/me"),
    ("get", "/topics"),
    ("get", "/progress"),
    ("get", "/dashboard"),
    ("get", "/lessons/regression_lineaire"),
    ("get", "/lessons/regression_lineaire/quiz"),
    ("get", "/lessons/regression_lineaire/definition"),
]


@pytest.mark.parametrize("methode, chemin", ROUTES_PROTEGEES)
def test_route_refusee_sans_jeton(methode, chemin):
    client = TestClient(main.app)
    reponse = getattr(client, methode)(chemin)
    assert reponse.status_code == 401


def test_route_refusee_avec_un_jeton_invalide():
    client = TestClient(main.app)
    reponse = client.get("/me", headers={"Authorization": "Bearer nimporte-quoi"})
    assert reponse.status_code == 401


def test_health_reste_publique():
    reponse = TestClient(main.app).get("/health")
    assert reponse.status_code == 200
    assert reponse.json() == {"statut": "ok"}