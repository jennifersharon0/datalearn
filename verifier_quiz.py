# Fichier : verifier_quiz.py
#
# Contrôle la qualité des 190 quiz de knowledge_db.json, et régénère
# uniquement ceux qui posent problème.
#
# Pourquoi ce script : les premiers quiz ont été générés avant que le prompt
# interdise la notation LaTeX. Certains contiennent donc des formules comme
# "\(c^{\top}x\)", qui s'affichent telles quelles dans l'application et sont
# illisibles. D'autres défauts peuvent exister : un quiz vide (génération
# ratée), moins de 8 questions, une réponse qui pointe vers une option qui
# n'existe pas, ou deux options identiques.
#
# Deux façons de l'utiliser, à lancer depuis la racine du projet :
#
#   python verifier_quiz.py
#       Vérifie tout et affiche la liste des sujets à corriger, sans rien
#       modifier. Aucun appel au LLM.
#
#   python verifier_quiz.py --corriger
#       Régénère le quiz de chaque sujet signalé, puis vérifie le nouveau.
#       Une sauvegarde datée de knowledge_db.json est faite avant toute
#       modification. Un nouveau quiz qui a encore un défaut est refusé :
#       l'ancien est gardé et le sujet est signalé.
#
# On peut relancer --corriger autant de fois que nécessaire : seuls les
# sujets encore en défaut sont traités.

import argparse
import re
import shutil
import time
from datetime import datetime

from generer_base_connaissances import (
    FICHIER_DB,
    NOMBRE_QUESTIONS_QUIZ,
    PAUSE_ENTRE_SUJETS_SECONDES,
    charger_db,
    generer_quiz,
    sauvegarder_db,
)
from llm_client import QuotaJournalierDepasse


# Repère la notation LaTeX : une commande comme \frac ou \top, des
# délimiteurs \( \) \[ \], ou une formule entre deux $ (par exemple $x^2$).
MOTIF_LATEX = re.compile(r"\\[a-zA-Z]+|\\[()\[\]]|\$[^$\n]+\$")


def contient_latex(texte):
    """Vrai si le texte contient de la notation LaTeX."""
    return bool(MOTIF_LATEX.search(texte or ""))


def problemes_du_quiz(quiz):
    """
    Renvoie la liste des défauts d'un quiz, en français. Une liste vide
    signifie que le quiz est correct.
    """

    if not quiz:
        return ["quiz vide"]

    defauts = []

    if len(quiz) < NOMBRE_QUESTIONS_QUIZ:
        defauts.append(f"{len(quiz)} questions au lieu de {NOMBRE_QUESTIONS_QUIZ}")

    for numero, q in enumerate(quiz, start=1):
        # Une question mal formée (champ manquant) : inutile d'aller plus loin.
        if not isinstance(q, dict) or "question" not in q or "options" not in q or "answer" not in q:
            defauts.append(f"question {numero} incomplète")
            continue

        options = q["options"]

        if len(options) != 4:
            defauts.append(f"question {numero} : {len(options)} options au lieu de 4")

        # "answer" est numéroté à partir de 1 : il doit désigner une option qui existe.
        if not isinstance(q["answer"], int) or not 1 <= q["answer"] <= len(options):
            defauts.append(f"question {numero} : réponse {q['answer']} hors des options")

        # Deux options identiques (en ignorant majuscules et espaces).
        normalisees = [str(o).strip().lower() for o in options]
        if len(set(normalisees)) != len(normalisees):
            defauts.append(f"question {numero} : options en double")

        if contient_latex(q["question"]) or any(contient_latex(str(o)) for o in options):
            defauts.append(f"question {numero} : notation LaTeX")

    return defauts


def sauvegarde_datee():
    """Copie knowledge_db.json avant toute modification, et renvoie le nom de la copie."""
    nom = f"knowledge_db.sauvegarde-{datetime.now():%Y%m%d-%H%M}.json"
    shutil.copyfile(FICHIER_DB, nom)
    return nom


def main():
    parser = argparse.ArgumentParser(description="Vérifie les quiz et régénère ceux qui ont un défaut.")
    parser.add_argument("--corriger", action="store_true", help="Régénère les quiz signalés")
    parser.add_argument("--limit", type=int, default=None, help="Nombre maximum de quiz à régénérer")
    args = parser.parse_args()

    db = charger_db()

    # 1. Vérification de tous les sujets.
    a_corriger = {}
    for slug, sujet in db.items():
        defauts = problemes_du_quiz(sujet.get("quiz", []))
        if defauts:
            a_corriger[slug] = defauts

    # On signale aussi les leçons qui contiennent du LaTeX : ce script ne
    # les modifie pas, mais il est utile de savoir combien il y en a.
    lecons_latex = [slug for slug, sujet in db.items() if contient_latex(sujet.get("content", ""))]

    print(f"{len(db)} sujets vérifiés.")
    print(f"Quiz à corriger : {len(a_corriger)}")
    for slug, defauts in a_corriger.items():
        # On n'affiche que les trois premiers défauts, pour garder la liste lisible.
        suite = f" (+{len(defauts) - 3} autres)" if len(defauts) > 3 else ""
        print(f"  - {slug} : {', '.join(defauts[:3])}{suite}")
    print(f"Leçons contenant du LaTeX (non modifiées) : {len(lecons_latex)}")
    for slug in lecons_latex:
        print(f"  - {slug}")

    if not args.corriger or not a_corriger:
        if a_corriger:
            print("\nPour les régénérer : python verifier_quiz.py --corriger")
        return

    # 2. Correction.
    cibles = list(a_corriger)[: args.limit] if args.limit else list(a_corriger)
    print(f"\nSauvegarde avant modification : {sauvegarde_datee()}")
    print(f"Régénération de {len(cibles)} quiz.\n")

    corriges, refuses = [], []

    for i, slug in enumerate(cibles, start=1):
        titre = db[slug]["title"]
        print(f"[{i}/{len(cibles)}] {titre}...")

        try:
            nouveau = generer_quiz(titre, db[slug]["content"])
        except QuotaJournalierDepasse:
            print(
                "\nQuota journalier Groq atteint : arrêt. Les quiz déjà corrigés sont "
                "enregistrés. Relance la même commande plus tard (ou avec "
                "GROQ_MODELE_FORCE dans le .env) pour continuer là où on s'est arrêté."
            )
            break
        except Exception as erreur:
            print(f"   échec de la génération ({erreur}), ancien quiz gardé")
            refuses.append(slug)
            continue

        # Le nouveau quiz n'est accepté que s'il n'a plus aucun défaut.
        defauts = problemes_du_quiz(nouveau)
        if defauts:
            print(f"   nouveau quiz refusé ({', '.join(defauts[:2])}), ancien quiz gardé")
            refuses.append(slug)
        else:
            db[slug]["quiz"] = nouveau
            # Enregistrement après chaque réussite : un arrêt en cours de
            # route ne fait perdre aucun quiz déjà corrigé.
            sauvegarder_db(db)
            corriges.append(slug)
            print("   corrigé")

        if i < len(cibles):
            time.sleep(PAUSE_ENTRE_SUJETS_SECONDES)

    print(f"\nTerminé : {len(corriges)} corrigé(s), {len(refuses)} refusé(s).")
    if refuses:
        print("Sujets à relancer : python verifier_quiz.py --corriger")
        for slug in refuses:
            print(f"  - {slug}")


if __name__ == "__main__":
    main()