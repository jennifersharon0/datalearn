import os

from dotenv import load_dotenv
import jwt
from jwt import PyJWKClient
from fastapi import Header, HTTPException


load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")


def construire_url_jwks():

    if not SUPABASE_URL:
        raise ValueError(
            "Erreur : SUPABASE_URL manquant dans le .env."
        )

    return f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"


_jwks_client = None


def obtenir_jwks_client():
    """
    Le PyJWKClient télécharge et met en cache les clés publiques
    de Supabase (celles qui servent à vérifier les jetons). On ne
    le recrée qu'une seule fois par démarrage du serveur.
    """

    global _jwks_client

    if _jwks_client is None:
        _jwks_client = PyJWKClient(construire_url_jwks())

    return _jwks_client


def verifier_jeton_avec_cle(token, cle_publique):
    """
    Fonction volontairement séparée de la récupération de la clé :
    ici, on ne fait QUE la vérification cryptographique, à partir
    d'une clé déjà obtenue. Ça permet de la tester facilement avec
    une fausse clé, sans dépendre du réseau.

    "audience='authenticated'" : Supabase inscrit cette valeur dans
    tous les jetons qu'il émet pour des utilisateurs connectés.
    La vérifier empêche qu'un jeton prévu pour un autre usage soit
    accepté ici par erreur.
    """

    return jwt.decode(
        token,
        cle_publique,
        algorithms=["ES256", "RS256"],
        audience="authenticated",
    )


def verifier_jeton(token):
    """
    Version complète, utilisée en vrai : récupère la bonne clé
    publique depuis Supabase (en fonction du jeton), puis vérifie.
    Renvoie l'identifiant (user_id) de l'utilisateur si tout est valide.
    """

    client = obtenir_jwks_client()

    cle_signature = client.get_signing_key_from_jwt(token)

    payload = verifier_jeton_avec_cle(token, cle_signature.key)

    return payload["sub"]


def obtenir_utilisateur_courant(authorization: str | None = Header(default=None)):
    """
    Dépendance FastAPI : à ajouter sur chaque route qui doit être
    protégée (réservée aux utilisateurs connectés). FastAPI lit
    automatiquement l'en-tête HTTP "Authorization" et le passe ici.

    "Header(default=None)" plutôt que "Header(...)" : on veut gérer
    nous-mêmes le cas où l'en-tête est absent, pour renvoyer notre
    propre 401 cohérent — sinon FastAPI renverrait une erreur 422
    différente avant même d'exécuter cette fonction, ce qui donnerait
    un comportement incohérent selon le type d'erreur.

    En cas de jeton absent, mal formé, expiré ou invalide : on renvoie
    toujours une erreur HTTP 401 (Non autorisé), sans jamais préciser
    LAQUELLE de ces raisons s'applique — même logique de prudence que
    pour la connexion (ne pas donner d'indice exploitable).
    """

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Authentification requise.",
        )

    token = authorization.removeprefix("Bearer ").strip()

    try:
        return verifier_jeton(token)
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Authentification requise.",
        )