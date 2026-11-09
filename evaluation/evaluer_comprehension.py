# Fichier : evaluation/evaluer_comprehension.py
#
# Mesure, avec des chiffres, la capacité de plusieurs méthodes à retrouver
# le bon sujet à partir d'une question écrite librement. C'est la question
# que se posait la première version du chatbot : "de quel sujet parle
# l'utilisateur ?".
#
# Les méthodes comparées, dans l'ordre de l'histoire du projet :
#   - tfidf                  : ressemblance de mots (scikit-learn) ;
#   - embeddings_minilm      : ressemblance de sens, avec le modèle utilisé à
#                              l'époque, all-MiniLM-L6-v2 (entraîné surtout
#                              sur de l'anglais) ;
#   - embeddings_multilingue : même principe, avec un modèle entraîné sur
#                              plus de 50 langues ;
#   - llm                    : le LLM reçoit le catalogue des 190 sujets et
#                              choisit lui-même. Plusieurs modèles peuvent
#                              être comparés (option --llm).
#
# Quatre questions sont mesurées pour chaque méthode :
#   1. La qualité : le bon sujet est-il en 1re position (top 1), ou parmi
#      les 3 premiers (top 3) ? Sur le jeu principal, puis par difficulté.
#   2. La robustesse aux fautes : des questions du jeu principal sont
#      réécrites avec des fautes de frappe et d'orthographe. On compare le
#      score sur les versions propres et sur les versions avec fautes.
#   3. La détection du hors-sujet : une question qui ne correspond à aucun
#      sujet (recette de crêpes, CSS, Bitcoin...) doit être reconnue comme
#      telle, au lieu de recevoir une leçon au hasard.
#   4. Le coût : temps de réponse par question, et pour le LLM, nombre de
#      tokens consommés et prix estimé.
#
# Format du fichier de questions (questions_test.xlsx, ou .csv avec ";") :
#   id ; question ; sujet_attendu ; difficulte ; id_original (facultatif)
#   - difficulte : facile, moyen, difficile, fautes, hors_sujet_loin ou
#     hors_sujet_proche ;
#   - sujet_attendu : un slug de la base, ou "hors_sujet" ;
#   - id_original : pour une question "fautes", l'id de sa version propre.
#
# Lancement, depuis la racine du projet :
#     python evaluation/evaluer_comprehension.py
#     python evaluation/evaluer_comprehension.py --methodes tfidf embeddings_minilm
#     python evaluation/evaluer_comprehension.py --llm openai/gpt-oss-120b openai/gpt-oss-20b
#
# Les réponses de chaque LLM sont enregistrées au fur et à mesure dans
# evaluation/resultats/cache_llm_<modele>.json. Si le quota Groq est
# atteint, il suffit de relancer la même commande plus tard : les questions
# déjà traitées ne sont pas renvoyées au LLM.

import argparse
import csv
import hashlib
import json
import re
import sys
import time
from pathlib import Path

import numpy as np


# ---------------------------------------------------------------------------
# Chemins
# ---------------------------------------------------------------------------

# Dossier de ce script (evaluation/) et racine du projet (son parent).
DOSSIER = Path(__file__).resolve().parent
RACINE = DOSSIER.parent

# On ajoute la racine aux chemins d'import, pour pouvoir réutiliser
# llm_client.py sans le copier.
sys.path.insert(0, str(RACINE))

# Le fichier de questions peut être enregistré depuis Excel (.xlsx) ou en
# CSV. Si les deux existent, la version Excel est prise en priorité.
FICHIER_QUESTIONS_EXCEL = DOSSIER / "questions_test.xlsx"
FICHIER_QUESTIONS_CSV = DOSSIER / "questions_test.csv"
FICHIER_BASE = RACINE / "knowledge_db.json"
DOSSIER_RESULTATS = DOSSIER / "resultats"


# ---------------------------------------------------------------------------
# Réglages
# ---------------------------------------------------------------------------

# Nombre de caractères de la leçon ajoutés au titre pour décrire un sujet.
# Le modèle MiniLM ne lit de toute façon que les 256 premiers tokens.
LONGUEUR_REFERENCE = 600

# Nombre de propositions gardées par méthode et par question.
NOMBRE_PROPOSITIONS = 3

# Pause entre deux appels au LLM. L'offre gratuite de Groq limite le nombre
# de tokens par minute (par exemple 8 000), et chaque appel en consomme
# 3 000 à 4 500, catalogue compris : on ne peut donc pas dépasser environ deux
# appels par minute. 30 secondes de pause évitent de buter sur cette limite.
PAUSE_LLM_SECONDES = 30

# Prix Groq en dollars par million de tokens : (entrée, sortie).
# Relevés le 9 novembre 2026 ; à revérifier sur console.groq.com avant de
# citer un chiffre, car les tarifs changent souvent.
# Sur l'offre gratuite, on ne paie rien : ces prix servent à estimer ce que
# coûterait le même usage en production, sur l'offre payante.
PRIX_PAR_MILLION_DE_TOKENS = {
    "openai/gpt-oss-120b": (0.15, 0.60),
    "openai/gpt-oss-20b": (0.075, 0.30),
    "llama-3.3-70b-versatile": (0.59, 0.79),  # dernier tarif public connu
}

# Part des questions du catalogue qu'on accepte de refuser à tort quand on
# fixe un seuil de similarité pour détecter le hors-sujet (voir plus bas).
FAUX_REFUS_TOLERES = 0.05

# Les modèles d'embeddings comparés. Le nom à gauche est celui utilisé dans
# les résultats ; celui de droite est le nom du modèle à télécharger.
MODELES_EMBEDDINGS = {
    "embeddings_minilm": "sentence-transformers/all-MiniLM-L6-v2",
    "embeddings_multilingue": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
}

TOUTES_LES_METHODES = ["tfidf", "embeddings_minilm", "embeddings_multilingue", "llm"]

# Nom affiché sur les graphiques, et couleur fixe de chaque méthode : une
# méthode garde la même couleur sur tous les graphiques.
NOMS_AFFICHES = {
    "tfidf": "TF-IDF",
    "embeddings_minilm": "Embeddings\n(MiniLM, anglais)",
    "embeddings_multilingue": "Embeddings\n(multilingue)",
}

COULEURS = {
    "tfidf": "#D9730D",                  # orange
    "embeddings_minilm": "#1F8A5B",      # vert
    "embeddings_multilingue": "#7A3E9D", # violet
}

# Une couleur par LLM, dans l'ordre où ils sont donnés à --llm.
COULEURS_LLM = ["#C62828", "#AD1457", "#827717"]  # rouge, framboise, olive

# Couleurs du texte et des lignes de fond : un brun très foncé et un beige
# clair, plutôt que du noir et du gris.
ENCRE = "#2B1D14"
QUADRILLAGE = "#EFE2D2"

# Les niveaux des questions qui ont une bonne réponse dans le catalogue.
NIVEAUX_PRINCIPAUX = ["facile", "moyen", "difficile"]
NIVEAU_FAUTES = "fautes"
# Les deux familles de questions hors sujet.
NIVEAUX_HORS_SUJET = ["hors_sujet_loin", "hors_sujet_proche"]
TOUS_LES_NIVEAUX = NIVEAUX_PRINCIPAUX + [NIVEAU_FAUTES] + NIVEAUX_HORS_SUJET

# Valeur de sujet_attendu pour une question sans leçon correspondante, et
# réponse que le LLM doit donner dans ce cas.
HORS_SUJET = "hors_sujet"


# ---------------------------------------------------------------------------
# Le prompt du LLM
# ---------------------------------------------------------------------------

# Le texte exact envoyé au LLM. {catalogue} et {question} sont remplacés à
# chaque appel. Si ce texte change, les réponses en cache ne sont plus
# valables (elles ont été obtenues avec un autre prompt) : le script le
# détecte grâce à une empreinte du texte, enregistrée dans le cache.
PROMPT_LLM = """Voici le catalogue des sujets d'une application d'apprentissage de la data science :

{catalogue}

Question d'un utilisateur : "{question}"

Donne les 3 sujets du catalogue qui correspondent le mieux à cette question,
du plus probable au moins probable. Recopie les slugs exactement (le texte
avant les deux-points).

Si la question ne porte sur aucun sujet du catalogue (autre domaine, simple
conversation, ou thème technique qui n'a pas de leçon), ne force pas une
correspondance : réponds seulement {{"sujets": ["hors_sujet"]}}.

Réponds uniquement avec ce JSON, sans aucun texte autour :
{{"sujets": ["slug1", "slug2", "slug3"]}}"""

# L'empreinte : 12 caractères calculés à partir du texte du prompt. Le
# moindre changement dans le texte donne une empreinte différente.
VERSION_PROMPT = hashlib.sha256(PROMPT_LLM.encode("utf-8")).hexdigest()[:12]


# ---------------------------------------------------------------------------
# Chargement des données
# ---------------------------------------------------------------------------

def charger_base():
    """Charge les 190 sujets (titre, catégorie, contenu de la leçon)."""
    with open(FICHIER_BASE, encoding="utf-8") as f:
        return json.load(f)


def lire_excel(chemin):
    """
    Lit la première feuille du classeur. La première ligne donne les noms
    des colonnes, chaque ligne suivante devient un dictionnaire. Les lignes
    vides sont ignorées.
    """
    from openpyxl import load_workbook

    feuille = load_workbook(chemin, read_only=True, data_only=True).active
    lignes = feuille.iter_rows(values_only=True)
    entetes = [str(cellule).strip() for cellule in next(lignes) if cellule is not None]

    questions = []
    for ligne in lignes:
        if all(cellule is None for cellule in ligne):
            continue
        # str() partout : Excel peut renvoyer l'id comme un nombre (1 au lieu de "1").
        questions.append({
            nom: "" if valeur is None else str(valeur).strip()
            for nom, valeur in zip(entetes, ligne)
        })
    return questions


def charger_questions(db):
    """
    Lit le fichier de questions, en Excel ou en CSV (séparateur ";"), et
    vérifie sa cohérence : une faute de frappe dans sujet_attendu ou dans
    difficulte fausserait le résultat sans prévenir.
    """
    if FICHIER_QUESTIONS_EXCEL.exists():
        questions = lire_excel(FICHIER_QUESTIONS_EXCEL)
    elif FICHIER_QUESTIONS_CSV.exists():
        with open(FICHIER_QUESTIONS_CSV, encoding="utf-8-sig", newline="") as f:
            questions = list(csv.DictReader(f, delimiter=";"))
    else:
        sys.exit("Erreur : aucun fichier questions_test.xlsx ou questions_test.csv dans evaluation/.")

    colonnes = {"id", "question", "sujet_attendu", "difficulte"}
    if questions and not colonnes <= set(questions[0]):
        sys.exit(f"Erreur : colonnes attendues {sorted(colonnes)}, trouvées {sorted(questions[0])}")

    for q in questions:
        # Un id lu comme 1.0 par Excel devient "1", pour rester stable dans le cache.
        q["id"] = q["id"].removesuffix(".0")
        q["id_original"] = (q.get("id_original") or "").removesuffix(".0")
        q["difficulte"] = q["difficulte"].strip().lower()

    erreurs = []
    ids = [q["id"] for q in questions]
    doublons = sorted({i for i in ids if ids.count(i) > 1})
    if doublons:
        erreurs.append(f"ids en double : {doublons}")

    for q in questions:
        if not q["question"].strip():
            erreurs.append(f"question {q['id']} : texte vide")
        if q["difficulte"] not in TOUS_LES_NIVEAUX:
            erreurs.append(f"question {q['id']} : difficulté inconnue « {q['difficulte']} »")
        if q["sujet_attendu"] != HORS_SUJET and q["sujet_attendu"] not in db:
            erreurs.append(f"question {q['id']} : sujet « {q['sujet_attendu']} » absent de la base")
        # Une question hors sujet doit avoir sujet_attendu = hors_sujet, et inversement.
        if (q["difficulte"] in NIVEAUX_HORS_SUJET) != (q["sujet_attendu"] == HORS_SUJET):
            erreurs.append(f"question {q['id']} : difficulté et sujet attendu incohérents")
        if q["id_original"]:
            original = next((o for o in questions if o["id"] == q["id_original"]), None)
            if original is None:
                erreurs.append(f"question {q['id']} : id_original {q['id_original']} introuvable")
            elif original["sujet_attendu"] != q["sujet_attendu"]:
                erreurs.append(f"question {q['id']} : sujet différent de sa version propre")

    if erreurs:
        sys.exit("Erreurs dans le fichier de questions :\n   " + "\n   ".join(erreurs))

    return questions


def nettoyer_markdown(texte):
    """Retire la mise en forme Markdown (titres, gras, liens) pour garder le texte seul."""
    texte = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", texte)  # [texte](lien) -> texte
    texte = re.sub(r"[#*_`>|]", " ", texte)                  # symboles de mise en forme
    return re.sub(r"\s+", " ", texte).strip()                # espaces multiples


def construire_references(db):
    """
    Décrit chaque sujet par un court texte : son titre, suivi du début de sa
    leçon. C'est à ces 190 textes que les méthodes TF-IDF et embeddings
    comparent chaque question. Les deux méthodes reçoivent exactement les
    mêmes textes, pour que la comparaison soit équitable.
    """
    slugs = list(db)
    textes = [
        f"{db[s]['title']}. {nettoyer_markdown(db[s]['content'])[:LONGUEUR_REFERENCE]}"
        for s in slugs
    ]
    return slugs, textes


def meilleurs_sujets(scores, slugs):
    """Renvoie les slugs des NOMBRE_PROPOSITIONS meilleurs scores, du plus haut au plus bas."""
    # argsort trie du plus petit au plus grand : on trie donc les scores
    # négatifs pour obtenir l'ordre décroissant.
    indices = np.argsort(-scores)[:NOMBRE_PROPOSITIONS]
    return [slugs[i] for i in indices]


# ---------------------------------------------------------------------------
# Les méthodes
# ---------------------------------------------------------------------------
#
# Chaque méthode renvoie un dictionnaire :
#   "preparation_s" : temps passé une seule fois avant la première question
#                     (apprendre le vocabulaire, charger un modèle...) ;
#   "reponses"      : une réponse par question, ou None si la question n'a
#                     pas encore été traitée (quota LLM atteint). Une réponse
#                     contient :
#                       "sujets"        : les 3 slugs proposés ;
#                       "score"         : la plus forte similarité trouvée
#                                         (None pour le LLM) ;
#                       "duree_s"       : le temps de traitement de la question ;
#                       "tokens_entree" et "tokens_sortie" : pour le LLM.
#
# Le temps est mesuré question par question, comme dans l'application, où
# les utilisateurs posent leurs questions une à une. Traiter les 96
# questions d'un bloc irait plus vite, mais ne refléterait pas l'usage réel.

def chronometre():
    """Horloge précise, faite pour mesurer des durées (pas l'heure qu'il est)."""
    return time.perf_counter()


def methode_tfidf(questions, slugs, textes):
    """
    TF-IDF appris sur nos 190 textes de référence : le vocabulaire et les
    poids viennent de nos propres données, comme dans la version 2 du
    chatbot. Chaque question devient un vecteur de mots pondérés, comparé à
    chaque sujet par similarité cosinus.
    """
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    debut = chronometre()
    vectoriseur = TfidfVectorizer()  # mêmes réglages par défaut qu'à l'époque
    matrice_sujets = vectoriseur.fit_transform(textes)  # apprend le vocabulaire
    preparation = chronometre() - debut

    reponses = []
    for q in questions:
        debut = chronometre()
        vecteur = vectoriseur.transform([q["question"]])
        similarites = cosine_similarity(vecteur, matrice_sujets)[0]  # une valeur par sujet
        sujets = meilleurs_sujets(similarites, slugs)
        reponses.append({"sujets": sujets, "score": float(similarites.max()),
                         "duree_s": chronometre() - debut})

    return {"preparation_s": preparation, "reponses": reponses}


def methode_embeddings(questions, slugs, textes, nom_modele):
    """
    Embeddings préentraînés : chaque question et chaque sujet deviennent un
    vecteur qui représente leur sens. On ne réentraîne rien : on utilise le
    modèle tel quel.
    """
    from sentence_transformers import SentenceTransformer

    print(f"   Chargement du modèle {nom_modele} (téléchargé la première fois)...")
    debut = chronometre()
    modele = SentenceTransformer(nom_modele)
    # normalize_embeddings=True ramène chaque vecteur à une longueur de 1 :
    # le produit scalaire devient alors exactement la similarité cosinus.
    vecteurs_sujets = modele.encode(textes, normalize_embeddings=True)
    preparation = chronometre() - debut

    # Échauffement : le tout premier encodage est plus lent (initialisations
    # internes de PyTorch). On le fait une fois hors chronomètre, pour ne pas
    # pénaliser la première question.
    modele.encode(["échauffement"], normalize_embeddings=True)

    reponses = []
    for q in questions:
        debut = chronometre()
        vecteur = modele.encode([q["question"]], normalize_embeddings=True)[0]
        # Produit scalaire avec les 190 sujets : (190 x 384) . (384) = 190 valeurs.
        similarites = vecteurs_sujets @ vecteur
        sujets = meilleurs_sujets(similarites, slugs)
        reponses.append({"sujets": sujets, "score": float(similarites.max()),
                         "duree_s": chronometre() - debut})

    return {"preparation_s": preparation, "reponses": reponses}


def fichier_cache(modele):
    """Un fichier de cache par modèle : openai/gpt-oss-120b -> cache_llm_openai_gpt-oss-120b.json."""
    return DOSSIER_RESULTATS / f"cache_llm_{re.sub(r'[^A-Za-z0-9.-]', '_', modele)}.json"


def methode_llm(questions, db, modele):
    """
    Le LLM reçoit le catalogue complet et renvoie les 3 sujets les plus
    probables, ou "hors_sujet". Chaque réponse est enregistrée dans le cache
    dès qu'elle arrive : un arrêt en cours de route ne fait rien perdre.
    """
    import llm_client
    from llm_client import QuotaJournalierDepasse, generer_json

    print(f"   Modèle évalué : {modele}")
    chemin_cache = fichier_cache(modele)

    # Catalogue compact (slug et titre), pour économiser des tokens.
    catalogue = "\n".join(f"- {slug} : {db[slug]['title']}" for slug in db)

    cache = {}
    if chemin_cache.exists():
        cache = json.loads(chemin_cache.read_text(encoding="utf-8"))

    # Les réponses en cache n'ont de valeur que si elles ont été obtenues avec
    # le même prompt. Sinon, on mélangerait deux expériences différentes.
    if cache and cache.get("_version_prompt") != VERSION_PROMPT:
        sys.exit(
            f"Erreur : {chemin_cache.name} contient des réponses obtenues avec un autre prompt.\n"
            f"   Supprime ce fichier pour relancer l'évaluation de {modele} avec le prompt actuel."
        )
    cache["_modele"] = modele
    cache["_version_prompt"] = VERSION_PROMPT

    def deja_traitee(q):
        # Le texte de la question est gardé dans le cache : si la question a
        # été reformulée depuis, l'ancienne réponse ne compte plus.
        entree = cache.get(q["id"])
        return isinstance(entree, dict) and entree.get("question") == q["question"]

    a_traiter = [q for q in questions if not deja_traitee(q)]
    duree_estimee = len(a_traiter) * (PAUSE_LLM_SECONDES + 3) / 60
    print(f"   {len(questions) - len(a_traiter)} réponses déjà en cache, {len(a_traiter)} à demander "
          f"(environ {duree_estimee:.0f} min).")

    for numero, q in enumerate(a_traiter, start=1):
        prompt = PROMPT_LLM.format(catalogue=catalogue, question=q["question"])

        # On note la consommation avant l'appel : la différence après l'appel
        # donne les tokens de cette question, réessais éventuels compris.
        avant = dict(llm_client.consommation)
        debut = chronometre()
        try:
            # Température 0 : la réponse la plus probable, sans hasard, pour
            # que le test soit reproductible.
            reponse = generer_json(prompt, temperature=0, modele=modele)
        except QuotaJournalierDepasse:
            print("   Quota journalier Groq atteint : arrêt. Relance la commande plus tard pour continuer.")
            break
        except Exception as erreur:
            # Une autre erreur qui persiste après les nouvelles tentatives de
            # llm_client (limite par minute, panne passagère) : on s'arrête
            # proprement. Les réponses déjà obtenues sont dans le cache.
            print(f"   Erreur persistante ({erreur}) : arrêt. Relance la même commande pour continuer.")
            break
        duree = chronometre() - debut

        propositions = (reponse or {}).get("sujets", [])
        # Un slug inventé par le LLM n'existe pas dans la base : on l'écarte,
        # ce qui revient à le compter comme une erreur. On enlève aussi les
        # doublons, en gardant l'ordre.
        valides = [s for s in dict.fromkeys(propositions) if s in db or s == HORS_SUJET]

        cache[q["id"]] = {
            "question": q["question"],
            "sujets": valides[:NOMBRE_PROPOSITIONS],
            "duree_s": round(duree, 3),
            "tokens_entree": llm_client.consommation["tokens_entree"] - avant["tokens_entree"],
            "tokens_sortie": llm_client.consommation["tokens_sortie"] - avant["tokens_sortie"],
        }

        chemin_cache.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"   [{numero}/{len(a_traiter)}] question {q['id']} : {duree:.1f} s, "
              f"{cache[q['id']]['tokens_entree']} + {cache[q['id']]['tokens_sortie']} tokens")
        if numero < len(a_traiter):
            time.sleep(PAUSE_LLM_SECONDES)

    reponses = []
    for q in questions:
        entree = cache.get(q["id"]) if deja_traitee(q) else None
        reponses.append(None if entree is None else {**entree, "score": None})

    # Pas de préparation pour le LLM : le catalogue est envoyé à chaque question.
    return {"preparation_s": 0.0, "reponses": reponses}


# ---------------------------------------------------------------------------
# Calcul des scores
# ---------------------------------------------------------------------------

def est_bonne(q, reponse, rang_max):
    """Le bon sujet figure-t-il dans les rang_max premières propositions ?"""
    return q["sujet_attendu"] in reponse["sujets"][:rang_max]


def pourcentages(couples):
    """Top 1 et top 3, en %, sur une liste de couples (question, réponse)."""
    if not couples:
        return None
    return {
        "n": len(couples),
        "top1": 100 * sum(est_bonne(q, r, 1) for q, r in couples) / len(couples),
        "top3": 100 * sum(est_bonne(q, r, 3) for q, r in couples) / len(couples),
    }


def calculer_scores(questions, reponses):
    """
    Pour une méthode, le top 1 et le top 3 :
      - "principal" : toutes les questions facile + moyen + difficile ;
      - par niveau, dont "fautes" ;
      - "originaux_des_fautes" : les versions propres des questions avec
        fautes. Comparer cette ligne à "fautes" mesure l'effet des fautes
        seules, puisque le sens des questions est le même.
    """
    couples = [(q, r) for q, r in zip(questions, reponses) if r is not None]
    par_id = {q["id"]: (q, r) for q, r in couples}

    groupes = {
        "principal": [(q, r) for q, r in couples if q["difficulte"] in NIVEAUX_PRINCIPAUX],
        **{n: [(q, r) for q, r in couples if q["difficulte"] == n]
           for n in NIVEAUX_PRINCIPAUX + [NIVEAU_FAUTES]},
    }

    # Les paires (version propre, version avec fautes), quand les deux ont une réponse.
    paires = [(par_id[q["id_original"]], (q, r)) for q, r in couples
              if q["difficulte"] == NIVEAU_FAUTES and q["id_original"] in par_id]
    if paires:
        groupes["originaux_des_fautes"] = [propre for propre, _ in paires]
        groupes[NIVEAU_FAUTES] = [faute for _, faute in paires]

    return {nom: p for nom, c in groupes.items() if (p := pourcentages(c))}


def auc(scores_positifs, scores_negatifs):
    """
    Aire sous la courbe ROC, calculée par sa définition la plus parlante :
    la probabilité qu'une question du catalogue, tirée au hasard, ait une
    similarité plus haute qu'une question hors sujet tirée au hasard.
    1 = séparation parfaite, 0,5 = pas mieux qu'une pièce de monnaie.
    Les égalités comptent pour moitié.
    """
    if not scores_positifs or not scores_negatifs:
        return None
    gagnes = sum((p > n) + 0.5 * (p == n) for p in scores_positifs for n in scores_negatifs)
    return gagnes / (len(scores_positifs) * len(scores_negatifs))


def evaluer_hors_sujet(questions, reponses):
    """
    Capacité à reconnaître une question sans leçon correspondante.

    TF-IDF et embeddings ne savent pas dire "hors sujet" : ils renvoient
    toujours les 3 sujets les plus proches. Mais leur score de similarité
    devrait être plus bas pour une question hors sujet. On mesure donc :
      - l'AUC : le score sépare-t-il bien les deux familles de questions ?
      - la détection avec un seuil : on place le seuil pour ne refuser à tort
        que 5 % des questions du catalogue, et on regarde quelle part des
        questions hors sujet passe sous ce seuil.

    Le LLM, lui, répond "hors_sujet" de lui-même. On mesure :
      - la détection : part des questions hors sujet reconnues ;
      - les faux refus : part des questions du catalogue rejetées à tort.
    """
    couples = [(q, r) for q, r in zip(questions, reponses) if r is not None]
    catalogue = [r for q, r in couples if q["difficulte"] in NIVEAUX_PRINCIPAUX]
    hors = {n: [r for q, r in couples if q["difficulte"] == n] for n in NIVEAUX_HORS_SUJET}
    tous_hors = hors["hors_sujet_loin"] + hors["hors_sujet_proche"]
    if not catalogue or not tous_hors:
        return None

    resultat = {"n_catalogue": len(catalogue), "n_hors_sujet": len(tous_hors)}

    if catalogue[0]["score"] is not None:
        positifs = [r["score"] for r in catalogue]
        resultat["auc"] = auc(positifs, [r["score"] for r in tous_hors])
        for n in NIVEAUX_HORS_SUJET:
            resultat[f"auc_{n}"] = auc(positifs, [r["score"] for r in hors[n]])
        # Le seuil laisse passer 95 % des questions du catalogue.
        # method="lower" : le seuil est une des similarités observées, pas une
        # valeur interpolée entre deux questions.
        seuil = float(np.quantile(positifs, FAUX_REFUS_TOLERES, method="lower"))
        resultat["seuil"] = seuil
        resultat["detection"] = 100 * np.mean([r["score"] < seuil for r in tous_hors])
        resultat["faux_refus"] = 100 * np.mean([s < seuil for s in positifs])
    else:
        refuse = lambda r: bool(r["sujets"]) and r["sujets"][0] == HORS_SUJET
        resultat["detection"] = 100 * np.mean([refuse(r) for r in tous_hors])
        resultat["faux_refus"] = 100 * np.mean([refuse(r) for r in catalogue])
        for n in NIVEAUX_HORS_SUJET:
            if hors[n]:
                resultat[f"detection_{n}"] = 100 * np.mean([refuse(r) for r in hors[n]])

    return resultat


def evaluer_cout(methode, resultat, modele=None):
    """Temps par question (médiane et 90e centile), et pour le LLM, tokens et prix."""
    reponses = [r for r in resultat["reponses"] if r is not None]
    if not reponses:
        return None
    durees = np.array([r["duree_s"] for r in reponses])
    cout = {
        "n": len(reponses),
        "preparation_s": resultat["preparation_s"],
        # La médiane plutôt que la moyenne : une seule question ralentie par
        # un réessai (pause de 5 s ou plus) ferait grimper la moyenne, pas la médiane.
        "latence_mediane_ms": 1000 * float(np.median(durees)),
        # 90e centile : 9 questions sur 10 sont traitées en moins de ce temps.
        "latence_p90_ms": 1000 * float(np.quantile(durees, 0.9)),
    }
    if modele is not None:
        entree = np.mean([r["tokens_entree"] for r in reponses])
        sortie = np.mean([r["tokens_sortie"] for r in reponses])
        cout["tokens_entree_moyens"] = float(entree)
        cout["tokens_sortie_moyens"] = float(sortie)
        prix = PRIX_PAR_MILLION_DE_TOKENS.get(modele)
        if prix:
            cout["cout_par_question_usd"] = (entree * prix[0] + sortie * prix[1]) / 1_000_000
    return cout


# ---------------------------------------------------------------------------
# Enregistrement
# ---------------------------------------------------------------------------

def ouvrir_csv(nom):
    return open(DOSSIER_RESULTATS / nom, "w", encoding="utf-8-sig", newline="")


def arrondi(valeur, chiffres=1):
    return "" if valeur is None else round(valeur, chiffres)


def enregistrer_predictions(questions, resultats):
    """Une ligne par question et par méthode : utile pour étudier les erreurs une à une."""
    with ouvrir_csv("predictions.csv") as f:
        ecrivain = csv.writer(f, delimiter=";")
        ecrivain.writerow(["id", "difficulte", "question", "sujet_attendu", "methode",
                           "proposition_1", "proposition_2", "proposition_3",
                           "correct_top1", "correct_top3", "score_similarite",
                           "duree_ms", "tokens_entree", "tokens_sortie"])
        for methode, resultat in resultats.items():
            for q, r in zip(questions, resultat["reponses"]):
                if r is None:
                    continue
                propositions = (r["sujets"] + ["", "", ""])[:3]
                ecrivain.writerow([q["id"], q["difficulte"], q["question"], q["sujet_attendu"],
                                   methode, *propositions,
                                   int(est_bonne(q, r, 1)), int(est_bonne(q, r, 3)),
                                   arrondi(r["score"], 4), arrondi(1000 * r["duree_s"], 2),
                                   r.get("tokens_entree", ""), r.get("tokens_sortie", "")])


def enregistrer_scores(tous_scores):
    """Le tableau récapitulatif de la qualité : une ligne par méthode et par groupe."""
    with ouvrir_csv("scores.csv") as f:
        ecrivain = csv.writer(f, delimiter=";")
        ecrivain.writerow(["methode", "groupe", "nombre_questions", "top1_pourcent", "top3_pourcent"])
        for methode, scores in tous_scores.items():
            for groupe, s in scores.items():
                ecrivain.writerow([methode, groupe, s["n"], arrondi(s["top1"]), arrondi(s["top3"])])


def enregistrer_hors_sujet(tous_hors):
    with ouvrir_csv("hors_sujet.csv") as f:
        ecrivain = csv.writer(f, delimiter=";")
        colonnes = ["auc", "auc_hors_sujet_loin", "auc_hors_sujet_proche", "seuil",
                    "detection", "detection_hors_sujet_loin", "detection_hors_sujet_proche",
                    "faux_refus"]
        ecrivain.writerow(["methode", "n_catalogue", "n_hors_sujet", "auc", "auc_loin",
                           "auc_proche", "seuil_similarite", "detection_pourcent",
                           "detection_loin_pourcent", "detection_proche_pourcent",
                           "faux_refus_pourcent"])
        for methode, h in tous_hors.items():
            ecrivain.writerow([methode, h["n_catalogue"], h["n_hors_sujet"]] +
                              [arrondi(h.get(c), 3 if c.startswith(("auc", "seuil")) else 1)
                               for c in colonnes])


def enregistrer_couts(tous_couts):
    with ouvrir_csv("couts_latences.csv") as f:
        ecrivain = csv.writer(f, delimiter=";")
        ecrivain.writerow(["methode", "nombre_questions", "preparation_s", "latence_mediane_ms",
                           "latence_p90_ms", "tokens_entree_moyens", "tokens_sortie_moyens",
                           "cout_par_question_usd", "cout_1000_questions_usd"])
        for methode, c in tous_couts.items():
            par_question = c.get("cout_par_question_usd")
            ecrivain.writerow([methode, c["n"], arrondi(c["preparation_s"], 2),
                               arrondi(c["latence_mediane_ms"], 2), arrondi(c["latence_p90_ms"], 2),
                               arrondi(c.get("tokens_entree_moyens"), 0),
                               arrondi(c.get("tokens_sortie_moyens"), 0),
                               arrondi(par_question, 6),
                               arrondi(None if par_question is None else 1000 * par_question, 3)])


# ---------------------------------------------------------------------------
# Graphiques
# ---------------------------------------------------------------------------

def style_axes(ax, etiquette_y=None, pourcentage=True):
    """Style commun : quadrillage horizontal discret, pas de cadre inutile."""
    if pourcentage:
        ax.set_ylim(0, 105)
    ax.yaxis.grid(True, color=QUADRILLAGE, linewidth=1)
    ax.set_axisbelow(True)
    for cote in ["top", "right", "left"]:
        ax.spines[cote].set_visible(False)
    ax.spines["bottom"].set_color(ENCRE)
    ax.tick_params(colors=ENCRE, length=0)
    if etiquette_y:
        ax.set_ylabel(etiquette_y, color=ENCRE)


def titre(ax, texte, sous_titre=None):
    ax.set_title(texte, loc="left", color=ENCRE, fontsize=13, fontweight="bold",
                 pad=26 if sous_titre else 12)
    if sous_titre:
        ax.text(0, 1.02, sous_titre, transform=ax.transAxes, color=ENCRE, fontsize=9.5)


def graphique_global(tous_scores):
    """
    Pour chaque méthode, deux barres côte à côte : le top 1 (couleur pleine)
    et le top 3 (même couleur, plus claire). L'écart entre les deux montre à
    quel point une méthode hésite entre des sujets voisins.
    """
    import matplotlib.pyplot as plt

    methodes = [m for m in tous_scores if "principal" in tous_scores[m]]
    if not methodes:
        return
    x = np.arange(len(methodes))
    largeur = 0.36

    fig, ax = plt.subplots(figsize=(max(10, 2.3 * len(methodes)), 5.6), dpi=150)
    style_axes(ax, "Questions bien classées (%)")

    for i, m in enumerate(methodes):
        s = tous_scores[m]["principal"]
        barres = [
            ax.bar(x[i] - largeur / 2 - 0.01, s["top1"], largeur, color=COULEURS[m]),
            ax.bar(x[i] + largeur / 2 + 0.01, s["top3"], largeur, color=COULEURS[m],
                   alpha=0.38, edgecolor=COULEURS[m], linewidth=1.2),
        ]
        for barre, valeur in zip(barres, [s["top1"], s["top3"]]):
            ax.text(barre[0].get_x() + barre[0].get_width() / 2, valeur + 1.5,
                    f"{valeur:.0f} %", ha="center", va="bottom", color=ENCRE, fontsize=10)

    ax.set_xticks(x, [NOMS_AFFICHES[m] for m in methodes], color=ENCRE)
    n = tous_scores[methodes[0]]["principal"]["n"]
    titre(ax, f"Part des {n} questions du jeu principal où chaque méthode retrouve le bon sujet",
          "Barre foncée : bon sujet en 1re position (top 1).   "
          "Barre claire : bon sujet parmi les 3 premiers (top 3).")

    fig.tight_layout()
    fig.savefig(DOSSIER_RESULTATS / "graphique_scores_globaux.png")
    plt.close(fig)


def graphique_par_difficulte(tous_scores):
    """
    Le top 1 de chaque méthode selon le niveau de la question, plus le groupe
    "fautes" à côté de ses versions propres : la marche entre les deux est
    l'effet des fautes seules.
    """
    import matplotlib.pyplot as plt

    methodes = list(tous_scores)
    groupes = NIVEAUX_PRINCIPAUX + ["originaux_des_fautes", NIVEAU_FAUTES]
    groupes = [g for g in groupes if any(g in tous_scores[m] for m in methodes)]
    noms = {"facile": "Facile", "moyen": "Moyen", "difficile": "Difficile",
            "originaux_des_fautes": "Mêmes questions\nsans fautes", NIVEAU_FAUTES: "Avec fautes"}

    x = np.arange(len(groupes))
    largeur = 0.8 / len(methodes)
    fig, ax = plt.subplots(figsize=(12, 5.8), dpi=150)
    style_axes(ax, "Top 1 (%)")

    for i, m in enumerate(methodes):
        valeurs = [tous_scores[m].get(g, {}).get("top1", 0) for g in groupes]
        decalage = (i - (len(methodes) - 1) / 2) * largeur
        barres = ax.bar(x + decalage, valeurs, largeur * 0.92, color=COULEURS[m],
                        label=NOMS_AFFICHES[m].replace("\n", " "))
        for barre, valeur in zip(barres, valeurs):
            ax.text(barre.get_x() + barre.get_width() / 2, valeur + 1.5, f"{valeur:.0f}",
                    ha="center", va="bottom", color=ENCRE, fontsize=8)

    # Une fine séparation entre les niveaux de difficulté et l'expérience sur les fautes.
    if "originaux_des_fautes" in groupes:
        separation = groupes.index("originaux_des_fautes") - 0.5
        ax.axvline(separation, color=QUADRILLAGE, linewidth=2)

    nombres = {g: max(tous_scores[m].get(g, {}).get("n", 0) for m in methodes) for g in groupes}
    ax.set_xticks(x, [f"{noms[g]}\n({nombres[g]} questions)" for g in groupes], color=ENCRE)
    titre(ax, "Top 1 selon la difficulté de la question, et effet des fautes de frappe")
    ax.legend(frameon=False, labelcolor=ENCRE, ncol=min(len(methodes), 5), loc="upper center",
              bbox_to_anchor=(0.5, -0.2), fontsize=9)

    fig.tight_layout()
    fig.savefig(DOSSIER_RESULTATS / "graphique_par_difficulte.png")
    plt.close(fig)


def graphique_compromis(tous_scores, tous_couts):
    """
    Le compromis qualité / rapidité : chaque méthode est un point, placé
    selon son temps de réponse médian (horizontal) et son top 1 (vertical).
    L'axe du temps est logarithmique : chaque graduation vaut 10 fois la
    précédente, sinon TF-IDF (environ 1 ms) et le LLM (environ 1 s) ne
    tiendraient pas sur le même dessin.
    """
    import matplotlib.pyplot as plt
    from matplotlib.ticker import FuncFormatter

    methodes = [m for m in tous_scores if "principal" in tous_scores[m] and m in tous_couts]
    if not methodes:
        return

    fig, ax = plt.subplots(figsize=(10, 5.8), dpi=150)
    style_axes(ax, "Top 1 sur le jeu principal (%)")
    ax.set_xscale("log")
    ax.xaxis.grid(True, color=QUADRILLAGE, linewidth=1)
    ax.xaxis.set_major_formatter(FuncFormatter(
        lambda v, _: f"{v:g} ms" if v < 1000 else f"{v / 1000:g} s"))
    ax.set_xlabel("Temps de réponse médian par question (échelle logarithmique)", color=ENCRE)

    latences = [max(tous_couts[m]["latence_mediane_ms"], 0.01) for m in methodes]
    ax.set_xlim(min(latences) / 4, max(latences) * 6)

    points = {}
    for m in methodes:
        lat = max(tous_couts[m]["latence_mediane_ms"], 0.01)
        top1 = tous_scores[m]["principal"]["top1"]
        points[m] = (lat, top1)
        ax.scatter(lat, top1, s=140, color=COULEURS[m], edgecolor="white", linewidth=2, zorder=3)

    # Les étiquettes sont posées une à une : pour chacune, on essaie quatre
    # positions autour du point et on garde la première qui ne chevauche ni
    # une étiquette déjà posée, ni un autre point.
    rendu = fig.canvas.get_renderer()
    occupe = [ax.transData.transform(p) for p in points.values()]
    boites = []
    positions = [((10, -4), "left", "top"), ((10, 6), "left", "bottom"),
                 ((-10, -4), "right", "top"), ((-10, 6), "right", "bottom")]
    for m, (lat, top1) in sorted(points.items(), key=lambda e: e[1][0]):
        etiquette = f"{NOMS_AFFICHES[m].replace(chr(10), ' ')} : {top1:.0f} %"
        cout = tous_couts[m].get("cout_par_question_usd")
        if cout is not None:
            etiquette += f"\n{1000 * cout:.2f} $ pour 1 000 questions"
        for decalage, ha, va in positions:
            texte = ax.annotate(etiquette, (lat, top1), xytext=decalage, textcoords="offset points",
                                color=ENCRE, fontsize=9, ha=ha, va=va)
            boite = texte.get_window_extent(rendu).expanded(1.04, 1.1)
            libre = (not any(boite.overlaps(b) for b in boites)
                     and not any(boite.contains(x, y) for x, y in occupe))
            if libre or (decalage, ha, va) == positions[-1]:
                boites.append(boite)
                break
            texte.remove()

    titre(ax, "Qualité et rapidité : ce que coûte chaque point de précision",
          "En haut à gauche : précis et rapide. Le coût en dollars ne concerne que les LLM.")

    fig.tight_layout()
    fig.savefig(DOSSIER_RESULTATS / "graphique_compromis.png")
    plt.close(fig)


def graphique_hors_sujet(questions, resultats, tous_hors):
    """
    Un panneau par méthode à score (TF-IDF, embeddings) : chaque point est
    une question, placée selon sa plus forte similarité avec un sujet. Si la
    méthode sait reconnaître le hors-sujet, les points "hors sujet" sont à
    gauche (similarité faible) et ceux du catalogue à droite. Le trait
    pointillé est le seuil qui ne refuse à tort que 5 % du catalogue.

    Pour chaque LLM, un dernier panneau : questions hors sujet reconnues, et
    questions du catalogue refusées à tort.
    """
    import matplotlib.pyplot as plt

    a_score = [m for m in tous_hors if "auc" in tous_hors[m]]
    llms = [m for m in tous_hors if "auc" not in tous_hors[m]]
    panneaux = len(a_score) + (1 if llms else 0)
    if panneaux == 0:
        return

    fig, axes = plt.subplots(panneaux, 1, figsize=(10, 2.5 * panneaux + 1.2), dpi=150, squeeze=False)
    axes = axes[:, 0]
    lignes = [("Catalogue", NIVEAUX_PRINCIPAUX), ("Hors sujet\nproche", ["hors_sujet_proche"]),
              ("Hors sujet\nloin", ["hors_sujet_loin"])]
    hasard = np.random.default_rng(0)  # petit décalage vertical, pour que les points ne se cachent pas

    for ax, m in zip(axes, a_score):
        for y, (_, niveaux) in enumerate(lignes):
            scores = [r["score"] for q, r in zip(questions, resultats[m]["reponses"])
                      if r is not None and q["difficulte"] in niveaux]
            plein = y == 0
            ax.scatter(scores, y + hasard.uniform(-0.15, 0.15, len(scores)), s=26,
                       color=COULEURS[m] if plein else "white", edgecolor=COULEURS[m],
                       linewidth=1.3, zorder=3)
        h = tous_hors[m]
        ax.axvline(h["seuil"], color=ENCRE, linestyle=(0, (4, 3)), linewidth=1)
        ax.set_yticks(range(len(lignes)), [nom for nom, _ in lignes], color=ENCRE)
        ax.set_ylim(len(lignes) - 0.5, -0.5)
        ax.tick_params(colors=ENCRE, length=0)
        for cote in ["top", "right", "left"]:
            ax.spines[cote].set_visible(False)
        ax.xaxis.grid(True, color=QUADRILLAGE)
        ax.set_axisbelow(True)
        ax.set_title(f"{NOMS_AFFICHES[m].replace(chr(10), ' ')} : AUC {h['auc']:.2f}, "
                     f"{h['detection']:.0f} % du hors-sujet détecté au seuil {h['seuil']:.2f}",
                     loc="left", color=ENCRE, fontsize=10.5, fontweight="bold")
    if a_score:
        axes[len(a_score) - 1].set_xlabel("Plus forte similarité entre la question et un sujet",
                                          color=ENCRE)

    if llms:
        ax = axes[-1]
        y = np.arange(len(llms))
        for i, m in enumerate(llms):
            h = tous_hors[m]
            ax.barh(i - 0.18, h["detection"], 0.34, color=COULEURS[m])
            ax.barh(i + 0.18, h["faux_refus"], 0.34, color=COULEURS[m], alpha=0.38,
                    edgecolor=COULEURS[m])
            ax.text(h["detection"] + 1, i - 0.18, f"{h['detection']:.0f} % du hors-sujet reconnu",
                    va="center", color=ENCRE, fontsize=9)
            ax.text(h["faux_refus"] + 1, i + 0.18,
                    f"{h['faux_refus']:.0f} % du catalogue refusé à tort",
                    va="center", color=ENCRE, fontsize=9)
        ax.set_yticks(y, [NOMS_AFFICHES[m].replace("\n", " ") for m in llms], color=ENCRE)
        ax.set_xlim(0, 135)
        ax.set_ylim(len(llms) - 0.5, -0.5)
        ax.tick_params(colors=ENCRE, length=0)
        ax.set_xticks([0, 25, 50, 75, 100])
        for cote in ["top", "right", "left"]:
            ax.spines[cote].set_visible(False)
        ax.xaxis.grid(True, color=QUADRILLAGE)
        ax.set_axisbelow(True)
        ax.set_title("LLM : il répond « hors_sujet » de lui-même", loc="left", color=ENCRE,
                     fontsize=10.5, fontweight="bold")

    fig.suptitle("Reconnaître une question qui n'a pas de leçon", x=0.01, ha="left",
                 color=ENCRE, fontsize=13, fontweight="bold")
    fig.tight_layout()
    fig.savefig(DOSSIER_RESULTATS / "graphique_hors_sujet.png")
    plt.close(fig)


# ---------------------------------------------------------------------------
# Programme principal
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Compare les méthodes de compréhension sur le jeu de test.")
    parser.add_argument("--methodes", nargs="+", choices=TOUTES_LES_METHODES,
                        default=TOUTES_LES_METHODES, help="Méthodes à évaluer (toutes par défaut)")
    parser.add_argument("--llm", nargs="+", metavar="MODELE",
                        help="Modèle(s) Groq à évaluer (par défaut : celui de l'application)")
    args = parser.parse_args()

    DOSSIER_RESULTATS.mkdir(exist_ok=True)

    db = charger_base()
    questions = charger_questions(db)
    slugs, textes = construire_references(db)
    effectifs = {n: sum(q["difficulte"] == n for q in questions) for n in TOUS_LES_NIVEAUX}
    print(f"{len(questions)} questions ({', '.join(f'{v} {n}' for n, v in effectifs.items() if v)}), "
          f"{len(slugs)} sujets.\n")

    # La liste des méthodes à lancer, avec un nom unique par LLM ("llm:modele").
    a_lancer = [m for m in args.methodes if m != "llm"]
    modeles_llm = {}
    if "llm" in args.methodes:
        from llm_client import obtenir_modele
        for i, modele in enumerate(args.llm or [obtenir_modele()]):
            nom = f"llm:{modele}"
            modeles_llm[nom] = modele
            NOMS_AFFICHES[nom] = f"LLM\n({modele.split('/')[-1]})"
            COULEURS[nom] = COULEURS_LLM[i % len(COULEURS_LLM)]
            a_lancer.append(nom)

    resultats = {}
    for methode in a_lancer:
        print(f"Méthode : {methode}")
        if methode == "tfidf":
            resultats[methode] = methode_tfidf(questions, slugs, textes)
        elif methode in MODELES_EMBEDDINGS:
            resultats[methode] = methode_embeddings(questions, slugs, textes, MODELES_EMBEDDINGS[methode])
        else:
            resultats[methode] = methode_llm(questions, db, modeles_llm[methode])

    tous_scores, tous_hors, tous_couts = {}, {}, {}
    for m, r in resultats.items():
        if (s := calculer_scores(questions, r["reponses"])):
            tous_scores[m] = s
        if (h := evaluer_hors_sujet(questions, r["reponses"])):
            tous_hors[m] = h
        if (c := evaluer_cout(m, r, modeles_llm.get(m))):
            tous_couts[m] = c

    enregistrer_predictions(questions, resultats)
    enregistrer_scores(tous_scores)
    enregistrer_hors_sujet(tous_hors)
    enregistrer_couts(tous_couts)
    graphique_global(tous_scores)
    graphique_par_difficulte(tous_scores)
    graphique_compromis(tous_scores, tous_couts)
    graphique_hors_sujet(questions, resultats, tous_hors)

    print("\nQualité (top 1 / top 3) :")
    for m, s in tous_scores.items():
        ligne = f"   {m:<32} principal {s['principal']['top1']:5.1f} / {s['principal']['top3']:5.1f} %" \
            if "principal" in s else f"   {m:<32}"
        if NIVEAU_FAUTES in s and "originaux_des_fautes" in s:
            ligne += (f"   fautes : {s['originaux_des_fautes']['top1']:.0f} % sans, "
                      f"{s[NIVEAU_FAUTES]['top1']:.0f} % avec")
        print(ligne)

    if tous_hors:
        print("\nHors sujet :")
        for m, h in tous_hors.items():
            debut = f"   {m:<32} "
            if "auc" in h:
                print(debut + f"AUC {h['auc']:.2f}, détection {h['detection']:.0f} % "
                      f"pour {h['faux_refus']:.0f} % de faux refus")
            else:
                print(debut + f"détection {h['detection']:.0f} %, faux refus {h['faux_refus']:.0f} %")

    print("\nTemps et coût :")
    for m, c in tous_couts.items():
        ligne = (f"   {m:<32} médiane {c['latence_mediane_ms']:8.1f} ms, "
                 f"préparation {c['preparation_s']:.1f} s")
        if "tokens_entree_moyens" in c:
            ligne += f", {c['tokens_entree_moyens']:.0f} + {c['tokens_sortie_moyens']:.0f} tokens"
        if "cout_par_question_usd" in c:
            ligne += f", {1000 * c['cout_par_question_usd']:.2f} $ / 1 000 questions"
        print(ligne)

    print(f"\nFichiers enregistrés dans {DOSSIER_RESULTATS}")


if __name__ == "__main__":
    main()