# Fichier : tests/conftest.py
#
# pytest lit ce fichier avant tous les tests. Il prépare un environnement
# isolé, pour que les tests ne touchent jamais aux vrais services :
#
#   - aucune écriture dans la base Supabase : DATABASE_URL est remplacée
#     par une adresse invalide, et les fonctions de stockage utilisées par
#     le serveur sont remplacées par une version en mémoire ;
#   - aucun appel à Groq : une fausse clé est fournie, et chaque test qui
#     passe par le LLM remplace la fonction concernée ;
#   - aucune vraie connexion : l'identité de l'utilisateur est simulée.
#
# Les "fixtures" définies ici sont des préparations réutilisables : un test
# les demande simplement en les nommant dans ses paramètres.

import os

# Ces lignes s'exécutent avant tout import du projet. load_dotenv() ne
# remplace jamais une variable déjà définie : les valeurs ci-dessous gagnent
# donc sur celles du .env pendant les tests.
os.environ["DATABASE_URL"] = "postgresql://tests-sans-base.invalid/aucune"
os.environ["GROQ_API_KEY"] = "cle-de-test"
os.environ["SUPABASE_URL"] = "https://projet-de-test.invalid"

import pytest
from fastapi import Header, HTTPException
from fastapi.testclient import TestClient

import main
from auth_jwt import obtenir_utilisateur_courant


# ---------------------------------------------------------------------------
# Une petite base de connaissances connue d'avance
# ---------------------------------------------------------------------------
# Les tests n'utilisent pas knowledge_db.json : son contenu change à chaque
# régénération. Avec deux sujets écrits à la main, on sait exactement quelles
# réponses sont justes.

def question(texte, bonne_reponse):
    """Fabrique une question à 4 options, dont la bonne est à la position donnée (à partir de 1)."""
    return {
        "question": texte,
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "answer": bonne_reponse,
    }


FAUSSE_BASE = {
    "regression_lineaire": {
        "title": "Régression linéaire",
        "category": "Machine Learning",
        "content": "La régression linéaire modélise une relation affine.",
        "quiz": [question("Question 1", 1), question("Question 2", 2), question("Question 3", 3)],
    },
    "arbre_de_decision": {
        "title": "Arbre de décision",
        "category": "Machine Learning",
        "content": "Un arbre de décision découpe les données par questions successives.",
        "quiz": [question("Question 1", 4), question("Question 2", 4)],
    },
}


@pytest.fixture
def fausse_base(monkeypatch):
    """Remplace la base du serveur par FAUSSE_BASE, le temps d'un test."""
    monkeypatch.setattr(main, "db", FAUSSE_BASE)
    return FAUSSE_BASE


# ---------------------------------------------------------------------------
# Un stockage en mémoire à la place de la base Supabase
# ---------------------------------------------------------------------------

class FauxStockage:
    """
    Garde les événements dans une simple liste, en imitant les fonctions de
    stockage_progression.py dont le serveur se sert. Chaque événement garde
    son user_id, et chaque lecture filtre dessus, comme les vraies requêtes
    SQL : c'est ce qui permet de tester que deux comptes restent séparés.
    """

    def __init__(self):
        self.evenements = []

    def enregistrer_lecon_vue(self, user_id, slug):
        self.evenements.append({"user_id": user_id, "type": "lecon_vue", "slug": slug})

    def enregistrer_quiz(self, user_id, slug, score, total):
        self.evenements.append(
            {"user_id": user_id, "type": "quiz", "slug": slug, "score": score, "total": total}
        )

    def de(self, user_id, type_evenement):
        """Les événements d'un seul utilisateur, d'un type donné."""
        return [e for e in self.evenements if e["user_id"] == user_id and e["type"] == type_evenement]

    def sujets_vus(self, user_id):
        return sorted({e["slug"] for e in self.de(user_id, "lecon_vue")})

    def historique_quiz(self, user_id):
        from datetime import datetime, timezone

        return [
            {
                "sujet_slug": e["slug"],
                "score": e["score"],
                "total": e["total"],
                "horodatage": datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc),
            }
            for e in self.de(user_id, "quiz")
        ]

    def jours_actifs(self, user_id):
        return []

    def progression_par_sujet(self, user_id):
        return [{"sujet_slug": slug} for slug in self.sujets_vus(user_id)]

    def activite_par_jour(self, user_id):
        return []


@pytest.fixture(autouse=True)
def stockage(monkeypatch):
    """
    autouse=True : appliquée à tous les tests, sans qu'ils aient à la
    demander. Aucun test ne peut donc écrire dans la vraie base, même par
    oubli. On remplace les noms tels que main.py les a importés.
    """

    faux = FauxStockage()

    for nom in (
        "enregistrer_lecon_vue",
        "enregistrer_quiz",
        "sujets_vus",
        "historique_quiz",
        "jours_actifs",
        "progression_par_sujet",
        "activite_par_jour",
    ):
        monkeypatch.setattr(main, nom, getattr(faux, nom))

    # sujets_completes_par_categorie appelle sujets_vus dans son propre
    # module : on la remplace par une version qui passe par le faux stockage.
    def par_categorie(user_id, db):
        compteur = {}
        for slug in faux.sujets_vus(user_id):
            if slug in db:
                categorie = db[slug]["category"]
                compteur[categorie] = compteur.get(categorie, 0) + 1
        return compteur

    monkeypatch.setattr(main, "sujets_completes_par_categorie", par_categorie)

    return faux


@pytest.fixture(autouse=True)
def limites_remises_a_zero():
    """Vide les compteurs du limiteur avant chaque test, pour qu'ils ne se gênent pas."""
    main.LIMITE_QUESTIONS._appels.clear()
    main.LIMITE_DEFINITIONS._appels.clear()


# ---------------------------------------------------------------------------
# Un client HTTP avec des utilisateurs simulés
# ---------------------------------------------------------------------------

def faux_utilisateur(authorization: str | None = Header(default=None)):
    """
    Remplace la vérification du jeton Supabase. Le "jeton" est directement
    l'identifiant voulu : "Bearer alice" connecte alice. Sans en-tête, on
    répond 401 comme la vraie fonction.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentification requise.")
    return authorization.removeprefix("Bearer ")


@pytest.fixture
def client(fausse_base):
    """
    Client HTTP qui envoie des requêtes au serveur sans le lancer pour de
    vrai. dependency_overrides demande à FastAPI d'utiliser faux_utilisateur
    partout où obtenir_utilisateur_courant était prévu, y compris à
    l'intérieur du limiteur.
    """
    main.app.dependency_overrides[obtenir_utilisateur_courant] = faux_utilisateur
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def en_tant_que(nom):
    """En-tête de connexion pour l'utilisateur simulé `nom`."""
    return {"Authorization": f"Bearer {nom}"}