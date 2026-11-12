# Fichier : recherche_lecons.py
#
# La partie "recherche" de l'assistant global (le R de RAG, Retrieval
# Augmented Generation). Avant de demander une réponse au LLM, on cherche
# dans les 190 leçons les quelques passages qui parlent de la question. Le
# LLM ne reçoit que ces passages, pas tout le catalogue : c'est moins cher,
# plus rapide, et il ne peut s'appuyer que sur ce qui est dans le cours.
#
# Tout est préparé une seule fois, au démarrage du serveur :
#
#   1. Découpage (chunking). Chaque leçon est coupée en passages d'environ
#      700 caractères, en respectant les paragraphes. Un passage court et
#      ciblé se retrouve mieux qu'une leçon entière, et coûte moins cher à
#      envoyer au LLM.
#
#   2. Un index des mots, comme l'index à la fin d'un livre : pour chaque
#      mot, la liste des passages qui le contiennent. Chaque passage est
#      noté avec BM25, une version améliorée de TF-IDF : un mot rare dans
#      le cours ("sigmoïde") pèse plus qu'un mot courant ("modèle"), et un
#      passage n'est pas avantagé juste parce qu'il est long.
#
#   3. Un correcteur de fautes de frappe. L'évaluation de l'étape 1 l'avait
#      montré : la recherche par mots était la meilleure sur les questions
#      propres, mais s'effondrait sur les fautes ("embeding" n'est pas
#      "embedding"). Avant de chercher, chaque mot inconnu du cours est donc
#      remplacé par le mot du cours qui lui ressemble le plus, s'il est
#      assez proche.
#
# Les mots sont aussi ramenés à leurs 7 premières lettres, pour que
# "normaliser" et "normalisation", ou "classifier" et "classification",
# soient reconnus comme le même mot. C'est une version très simple de ce
# qu'on appelle la racinisation (stemming).
#
# Pourquoi pas d'embeddings ici ? Ils détectaient mieux les questions hors
# sujet lors de l'évaluation, mais un modèle d'embeddings demande plusieurs
# centaines de Mo de mémoire, et le serveur gratuit de Render n'en a que
# 512. Le tri entre "dans le cours" et "hors sujet" est donc confié au LLM,
# qui était parfait sur ce point dans l'évaluation. Ce module n'utilise que
# Python, sans bibliothèque à installer.

import difflib
import math
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass


TAILLE_PASSAGE = 700          # longueur visée d'un passage, en caractères
NB_PASSAGES = 6               # passages envoyés au LLM
MAX_PASSAGES_PAR_LECON = 2    # pour ne pas remplir le contexte avec une seule leçon
LONGUEUR_RACINE = 7           # lettres gardées par mot pour la racinisation
PROXIMITE_MIN = 0.85          # ressemblance minimale pour corriger un mot (0 à 1)

# Paramètres habituels de BM25. k1 règle l'effet des répétitions d'un mot
# dans un passage (au-delà de quelques occurrences, ça n'aide plus
# beaucoup) ; b règle la pénalité donnée aux passages longs.
K1 = 1.5
B = 0.75


# Mots trop courants pour aider à trouver un passage. Sans accents, car le
# texte est normalisé avant d'être comparé.
MOTS_VIDES = set("""
a ai as au aux avec ce ces cela celle celui cet cette ci comme comment dans de des
du elle elles en entre est et etre eux il ils je la le les leur leurs lui ma mais
me meme mes moi mon ne ni nos notre nous on ou par pas pour qu que quel quelle
quelles quels qui quoi sa sans se ses si son sont sur ta te tes toi ton tu un une
vos votre vous y c d j l m n s t ca cest quest quoi fait faire peut peux veut
dire explique expliquer moi difference entre quand donc alors aussi tres plus
bien bon tout tous toute toutes autre autres car leur sert servir utiliser
""".split())


@dataclass
class Passage:
    """Un morceau de leçon, avec la leçon d'où il vient."""

    slug: str
    titre: str
    texte: str          # tel qu'il sera montré au LLM
    score: float = 0.0  # score de fusion, rempli au moment d'une recherche


# ---------------------------------------------------------------------------
# Préparation du texte
# ---------------------------------------------------------------------------

def normaliser(texte):
    """
    Met le texte sous une forme comparable : minuscules, sans accents, sans
    ponctuation. "Régression" et "regression" deviennent identiques, ce qui
    rattrape les questions tapées sans accents.
    """
    texte = unicodedata.normalize("NFD", texte.lower())
    texte = "".join(c for c in texte if unicodedata.category(c) != "Mn")
    # Les sigles à tiret sont collés : "k-NN" devient "knn", "TF-IDF"
    # "tfidf", comme on les tape le plus souvent.
    texte = re.sub(r"\b([a-z0-9]{1,4})[-\u2011]([a-z0-9]{1,4})\b", r"\1\2", texte)
    return re.sub(r"[^a-z0-9]+", " ", texte).strip()


def mots(texte):
    """Les mots utiles d'un texte, sans les mots vides ni les lettres isolées."""
    return [m for m in normaliser(texte).split() if len(m) > 1 and m not in MOTS_VIDES]


def racine(mot):
    """Les premières lettres du mot : "normalisation" et "normaliser" donnent "normali"."""
    return mot[:LONGUEUR_RACINE]


def nettoyer_markdown(texte):
    """Retire le gras et les espaces superflus des leçons, inutiles au LLM."""
    texte = texte.replace("**", "").replace("‑", "-")
    return re.sub(r"[ \t]+", " ", texte).strip()


def decouper_lecon(slug, lecon, taille=TAILLE_PASSAGE):
    """
    Coupe une leçon en passages d'environ `taille` caractères, sans jamais
    couper au milieu d'un paragraphe. Un intertitre reste collé au
    paragraphe qui le suit, sinon il formerait un passage vide de sens.
    """
    paragraphes = [nettoyer_markdown(p) for p in re.split(r"\n\s*\n", lecon["content"])]
    paragraphes = [p for p in paragraphes if p]

    passages = []
    courant = ""

    for paragraphe in paragraphes:
        if courant and len(courant) + len(paragraphe) > taille:
            passages.append(courant)
            courant = ""
        courant = f"{courant}\n{paragraphe}".strip()

    if courant:
        # Un dernier morceau très court est rattaché au précédent.
        if passages and len(courant) < taille / 3:
            passages[-1] = f"{passages[-1]}\n{courant}"
        else:
            passages.append(courant)

    return [Passage(slug=slug, titre=lecon["title"], texte=p) for p in passages]


# ---------------------------------------------------------------------------
# Un index BM25
# ---------------------------------------------------------------------------

class IndexBM25:
    """
    Index inversé : pour chaque terme, la liste des passages qui le
    contiennent et combien de fois. Une recherche ne parcourt que les
    passages qui partagent au moins un terme avec la question.
    """

    def __init__(self, documents):
        # documents : une liste de listes de termes, une par passage.
        self.nb_documents = len(documents)
        self.longueurs = [len(doc) for doc in documents]
        self.longueur_moyenne = sum(self.longueurs) / max(self.nb_documents, 1)
        self.postings = defaultdict(list)

        for numero, doc in enumerate(documents):
            for terme, nombre in Counter(doc).items():
                self.postings[terme].append((numero, nombre))

        # IDF : un terme présent dans peu de passages est plus informatif.
        self.idf = {
            terme: math.log(1 + (self.nb_documents - len(liste) + 0.5) / (len(liste) + 0.5))
            for terme, liste in self.postings.items()
        }

    def scores(self, termes_question):
        """Score BM25 de chaque passage qui contient au moins un terme de la question."""
        scores = defaultdict(float)

        for terme in set(termes_question):
            for numero, nombre in self.postings.get(terme, ()):
                longueur = self.longueurs[numero] / self.longueur_moyenne
                frequence = nombre * (K1 + 1) / (nombre + K1 * (1 - B + B * longueur))
                scores[numero] += self.idf[terme] * frequence

        return scores


# ---------------------------------------------------------------------------
# L'index complet des leçons
# ---------------------------------------------------------------------------

class IndexLecons:
    """Tous les passages des leçons, leur index et le vocabulaire du cours."""

    def __init__(self, db):
        self.passages = []
        for slug, lecon in db.items():
            self.passages.extend(decouper_lecon(slug, lecon))

        # Le titre est ajouté à chaque passage indexé : un passage du milieu
        # de la leçon "Le reranking" doit ressortir pour une question sur le
        # reranking, même s'il n'emploie pas le mot.
        textes = [f"{p.titre} {p.titre} {p.texte}" for p in self.passages]
        mots_par_passage = [mots(t) for t in textes]

        self.index = IndexBM25([[racine(m) for m in liste] for liste in mots_par_passage])

        # Le vocabulaire du cours, rangé par longueur de mot : le correcteur
        # ne compare un mot qu'aux mots de longueur proche, ce qui va vite.
        self.vocabulaire = {m for liste in mots_par_passage for m in liste}
        self.par_longueur = defaultdict(list)
        for mot in self.vocabulaire:
            self.par_longueur[len(mot)].append(mot)

    def corriger(self, mot):
        """
        Le mot lui-même s'il existe dans le cours, sinon le mot du cours le
        plus ressemblant ("embeding" donne "embedding"). Un mot qui ne
        ressemble à rien ("tartiflette") est gardé tel quel : il ne
        trouvera simplement aucun passage.
        """
        if mot in self.vocabulaire or len(mot) < 4:
            return mot

        candidats = [m for n in range(len(mot) - 2, len(mot) + 3) for m in self.par_longueur.get(n, ())]
        proches = difflib.get_close_matches(mot, candidats, n=1, cutoff=PROXIMITE_MIN)
        return proches[0] if proches else mot

    def termes(self, question):
        """Les termes de la question tels que l'index les attend : corrigés puis racinisés."""
        return [racine(self.corriger(m)) for m in mots(question)]

    def rechercher(self, question, nb_passages=NB_PASSAGES):
        """
        Renvoie les passages les plus proches de la question, au plus
        MAX_PASSAGES_PAR_LECON par leçon. Liste vide si rien ne correspond.
        """
        scores = self.index.scores(self.termes(question))

        resultats = []
        par_lecon = Counter()

        for numero in sorted(scores, key=scores.get, reverse=True):
            passage = self.passages[numero]
            if par_lecon[passage.slug] >= MAX_PASSAGES_PAR_LECON:
                continue
            par_lecon[passage.slug] += 1
            resultats.append(Passage(passage.slug, passage.titre, passage.texte, round(scores[numero], 3)))
            if len(resultats) == nb_passages:
                break

        return resultats

    def lecons_proches(self, question, nombre=3):
        """Les leçons (slug, titre) des meilleurs passages, sans doublon."""
        vues = []
        for passage in self.rechercher(question, nb_passages=nombre * MAX_PASSAGES_PAR_LECON):
            if passage.slug not in [slug for slug, _ in vues]:
                vues.append((passage.slug, passage.titre))
        return vues[:nombre]
