# Fichier : limiteur.py
#
# Limite le nombre d'appels au LLM que chaque utilisateur peut faire dans
# un temps donné. Sans cette limite, une seule personne (ou un script)
# pourrait envoyer des centaines de questions d'affilée et épuiser en
# quelques minutes le quota Groq de tout le site.
#
# Le principe est celui d'une "fenêtre glissante" : pour chaque utilisateur,
# on garde l'heure de ses derniers appels. À chaque nouvel appel, on oublie
# ceux qui sont plus vieux que la fenêtre (par exemple une heure), puis on
# compte ceux qui restent. Au-delà de la limite, l'appel est refusé avec le
# code HTTP 429 ("trop de requêtes"), que le frontend sait déjà afficher.
#
# Les compteurs sont gardés en mémoire, dans le processus du serveur. C'est
# suffisant pour un seul serveur, comme sur Render en version gratuite. Ils
# repartent de zéro quand le serveur redémarre, ce qui n'est pas gênant pour
# une limite de ce type. Avec plusieurs serveurs en parallèle, il faudrait
# les ranger dans une base partagée (Redis, par exemple).

import math
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import Depends, HTTPException

from auth_jwt import obtenir_utilisateur_courant


class LimiteurDebit:
    """Autorise au plus `nombre_max` appels par utilisateur sur `fenetre_secondes`."""

    def __init__(self, nombre_max, fenetre_secondes):
        self.nombre_max = nombre_max
        self.fenetre_secondes = fenetre_secondes

        # Pour chaque utilisateur, la liste des heures de ses appels récents.
        # deque est une liste qui permet de retirer très vite les éléments
        # du début, ici les appels les plus anciens.
        self._appels = defaultdict(deque)

        # FastAPI peut traiter plusieurs requêtes en même temps, dans
        # plusieurs fils d'exécution. Le verrou garantit qu'un seul à la
        # fois modifie les compteurs, pour ne jamais en perdre un.
        self._verrou = Lock()

    def verifier(self, cle):
        """
        Enregistre un appel pour `cle` (l'identifiant de l'utilisateur), ou
        lève une erreur 429 si la limite est déjà atteinte.
        """

        # time.monotonic() avance toujours, même si l'heure de l'ordinateur
        # est changée : c'est la bonne horloge pour mesurer des durées.
        maintenant = time.monotonic()

        with self._verrou:
            appels = self._appels[cle]

            # On oublie les appels sortis de la fenêtre.
            while appels and appels[0] <= maintenant - self.fenetre_secondes:
                appels.popleft()

            if len(appels) >= self.nombre_max:
                # Temps à attendre avant que le plus ancien appel sorte de
                # la fenêtre et libère une place, arrondi à la seconde au-dessus.
                attente = math.ceil(appels[0] + self.fenetre_secondes - maintenant)
                raise HTTPException(
                    status_code=429,
                    detail="Trop de demandes en peu de temps.",
                    # L'en-tête standard Retry-After indique ce délai au client.
                    headers={"Retry-After": str(max(attente, 1))},
                )

            appels.append(maintenant)


def limite(limiteur):
    """
    Crée une dépendance FastAPI qui vérifie d'abord le jeton de connexion,
    puis la limite d'appels, et renvoie l'identifiant de l'utilisateur.

    S'utilise à la place de Depends(obtenir_utilisateur_courant) :
        user_id: str = Depends(limite(LIMITE_QUESTIONS))
    """

    def dependance(user_id: str = Depends(obtenir_utilisateur_courant)):
        limiteur.verifier(user_id)
        return user_id

    return dependance