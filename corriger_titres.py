# Fichier : corriger_titres.py
#
# Script à lancer une seule fois, pour remplacer les titres déjà enregistrés
# dans knowledge_db.json par les titres corrects de topics.py (avec accents
# et majuscules). Le contenu des leçons et les quiz ne sont pas touchés :
# aucun appel au LLM, donc aucun quota Groq consommé.
#
# Utilisation, à la racine du projet :
#   python corriger_titres.py --simulation   affiche les changements sans rien modifier
#   python corriger_titres.py                applique les changements
#
# Par précaution, le script enregistre d'abord une copie de sauvegarde du
# fichier d'origine, datée, avant de le modifier.

import argparse
import json
import os
import shutil
from datetime import datetime

from topics import titre_lisible

# Fichier à corriger, le même que celui lu par base_connaissances.py.
FICHIER_DB = "knowledge_db.json"


def main():
    # Lecture des options de la ligne de commande.
    parseur = argparse.ArgumentParser(description="Corrige les titres de knowledge_db.json.")
    parseur.add_argument(
        "--simulation",
        action="store_true",
        help="Affiche les changements prévus sans modifier le fichier.",
    )
    options = parseur.parse_args()

    # Vérifie que le fichier existe avant d'aller plus loin.
    if not os.path.exists(FICHIER_DB):
        print(f"Erreur : {FICHIER_DB} introuvable. Lance ce script à la racine du projet.")
        return

    with open(FICHIER_DB, "r", encoding="utf-8") as f:
        db = json.load(f)

    # Parcourt chaque sujet et compare son titre actuel au titre correct.
    changements = []
    for slug, infos in db.items():
        ancien = infos.get("title", "")
        nouveau = titre_lisible(slug)
        if ancien != nouveau:
            changements.append((slug, ancien, nouveau))
            infos["title"] = nouveau

    # Affiche chaque changement pour pouvoir vérifier ce qui va être fait.
    for slug, ancien, nouveau in changements:
        print(f"{slug} : {ancien}  devient  {nouveau}")
    print(f"\n{len(changements)} titre(s) à corriger sur {len(db)} sujet(s).")

    # En mode simulation, ou s'il n'y a rien à changer, on s'arrête là.
    if options.simulation:
        print("Mode simulation : aucun fichier n'a été modifié.")
        return
    if not changements:
        print("Rien à faire, les titres sont déjà à jour.")
        return

    # Copie de sauvegarde datée, par exemple knowledge_db.sauvegarde-20260929-2245.json.
    horodatage = datetime.now().strftime("%Y%m%d-%H%M")
    sauvegarde = f"knowledge_db.sauvegarde-{horodatage}.json"
    shutil.copy2(FICHIER_DB, sauvegarde)
    print(f"Sauvegarde créée : {sauvegarde}")

    # On écrit d'abord dans un fichier temporaire, puis on le met à la place
    # de l'original. Si l'écriture est interrompue en cours de route (coupure,
    # erreur), l'original reste intact au lieu d'être à moitié écrit.
    fichier_temporaire = FICHIER_DB + ".tmp"
    with open(fichier_temporaire, "w", encoding="utf-8") as f:
        # ensure_ascii=False garde les accents lisibles dans le fichier.
        json.dump(db, f, ensure_ascii=False, indent=2)
    os.replace(fichier_temporaire, FICHIER_DB)

    print(f"{FICHIER_DB} mis à jour. Redémarre le backend pour voir les nouveaux titres.")


# Lance main() seulement quand le fichier est exécuté directement.
if __name__ == "__main__":
    main()