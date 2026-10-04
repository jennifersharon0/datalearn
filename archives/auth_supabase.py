import os

from dotenv import load_dotenv
from supabase import create_client


load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY")


def obtenir_client():
    """
    Crée un client Supabase, utilisé UNIQUEMENT pour l'authentification
    (inscription, connexion). Ce client utilise la clé publiable, pas
    la chaîne de connexion PostgreSQL directe (DATABASE_URL) qu'on
    utilise dans stockage_progression.py — ce sont deux mécanismes
    différents : l'un parle à la base de données, l'autre au service
    d'authentification (GoTrue) de Supabase.
    """

    if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:

        raise ValueError(
            "Erreur : SUPABASE_URL et/ou SUPABASE_PUBLISHABLE_KEY "
            "manquants dans ton .env.\n"
            "Trouve-les dans Supabase, bouton 'Connect' en haut du "
            "projet : 'URL du projet' et 'Clé publiable'."
        )

    return create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)


def inscrire(email, mot_de_passe):
    """
    Tente de créer un compte.

    Renvoie un tuple (succes, valeur) :
    - si succes est True, valeur est le user_id (UUID) du nouveau compte
    - si succes est False, valeur est un message d'erreur affichable
    """

    client = obtenir_client()

    try:

        reponse = client.auth.sign_up({
            "email": email,
            "password": mot_de_passe,
        })

        if reponse.user is None:
            return False, "L'inscription a échoué, réessaie."

        return True, reponse.user.id

    except Exception as erreur:

        message = str(erreur)

        if "already registered" in message.lower() or "already exists" in message.lower():
            return False, "Un compte existe déjà avec cet email."

        if "password" in message.lower() and "6" in message:
            return False, "Le mot de passe doit faire au moins 6 caractères."

        return False, "L'inscription a échoué, vérifie ton email et ton mot de passe."


def connecter(email, mot_de_passe):
    """
    Tente de connecter un utilisateur existant.

    Renvoie un tuple (succes, valeur), même format que inscrire().

    Volontairement, le message d'erreur est TOUJOURS le même,
    que l'email n'existe pas ou que le mot de passe soit faux
    (protection contre l'énumération de comptes valides).
    """

    client = obtenir_client()

    message_erreur_generique = "Email ou mot de passe incorrect."

    try:

        reponse = client.auth.sign_in_with_password({
            "email": email,
            "password": mot_de_passe,
        })

        if reponse.user is None:
            return False, message_erreur_generique

        return True, reponse.user.id

    except Exception:

        return False, message_erreur_generique