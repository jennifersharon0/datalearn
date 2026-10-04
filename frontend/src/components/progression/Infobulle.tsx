// Fichier : src/components/progression/Infobulle.tsx
//
// Deux outils partagés par tous les graphiques du tableau de bord.
//
// useInfobulle et Infobulle affichent la petite bulle qui apparaît au survol
// (ou au focus clavier) d'un élément d'un graphique 

import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

// Marge minimale entre la bulle et les bords de son conteneur, en pixels.
const MARGE_BORD = 4;

// Écart entre le haut de l'élément survolé et le bas de la bulle.
const ECART_VERTICAL = 10;

// Ce qu'il faut pour afficher une bulle : où (dans le repère du conteneur)
// et quoi.
export interface EtatInfobulle {
  x: number; // centre horizontal de l'élément visé
  y: number; // haut de l'élément visé
  contenu: ReactNode;
}

/**
 * Gère la bulle d'un graphique. Renvoie :
 *   conteneur : la référence à poser sur l'élément qui entoure le graphique
 *               (il doit être en position: relative, voir Dashboard.css) ;
 *   etat : la bulle à afficher, ou null ;
 *   montrerSur : affiche la bulle au-dessus d'un élément de la page ;
 *   montrerA : affiche la bulle à une position précise du conteneur ;
 *   cacher : masque la bulle.
 */
export function useInfobulle() {
  const conteneur = useRef<HTMLDivElement>(null);
  const [etat, setEtat] = useState<EtatInfobulle | null>(null);

  // getBoundingClientRect donne la position d'un élément dans la fenêtre.
  // En soustrayant celle du conteneur, on obtient la position de l'élément
  // dans le conteneur, là où la bulle doit être placée.
  function montrerSur(element: Element, contenu: ReactNode) {
    const zone = conteneur.current?.getBoundingClientRect();
    if (!zone) return;
    const cible = element.getBoundingClientRect();
    setEtat({
      x: cible.left + cible.width / 2 - zone.left,
      y: cible.top - zone.top,
      contenu,
    });
  }

  function montrerA(x: number, y: number, contenu: ReactNode) {
    setEtat({ x, y, contenu });
  }

  function cacher() {
    setEtat(null);
  }

  return { conteneur, etat, montrerSur, montrerA, cacher };
}

/**
 * La bulle elle-même. Elle se place au-dessus du point visé, centrée, et
 * se décale si elle risque de dépasser à gauche ou à droite du conteneur.
 */
export function Infobulle({ etat }: { etat: EtatInfobulle | null }) {
  const bulle = useRef<HTMLDivElement>(null);

  // useLayoutEffect s'exécute juste après le dessin de la bulle, mais avant
  // que l'écran ne soit rafraîchi. On peut donc mesurer sa largeur réelle et
  // la recaler sans qu'on la voie sauter d'une position à l'autre.
  useLayoutEffect(() => {
    const element = bulle.current;
    if (!element || !etat) return;

    // offsetParent est le conteneur positionné (celui du graphique).
    const largeurZone = (element.offsetParent as HTMLElement | null)?.clientWidth ?? 0;
    const largeurBulle = element.offsetWidth;

    // Position idéale : centrée sur le point. Math.min et Math.max la
    // ramènent ensuite à l'intérieur du conteneur.
    const gauche = Math.max(MARGE_BORD, Math.min(etat.x - largeurBulle / 2, largeurZone - largeurBulle - MARGE_BORD));

    element.style.left = `${gauche}px`;
    element.style.top = `${etat.y - element.offsetHeight - ECART_VERTICAL}px`;
  }, [etat]);

  if (!etat) return null;

  // aria-hidden : chaque élément survolable porte déjà un aria-label avec
  // la même information, que les lecteurs d'écran annoncent au focus.
  return (
    <div ref={bulle} className="infobulle" aria-hidden="true">
      {etat.contenu}
    </div>
  );
}

/**
 * Renvoie la largeur actuelle de l'élément pointé par la référence, en
 * pixels, et se met à jour à chaque changement de taille.
 * ResizeObserver prévient dès que l'élément change de dimensions, que ce
 * soit à cause de la fenêtre, d'une rotation ou du menu qui apparaît.
 */
export function useLargeur(reference: RefObject<HTMLElement | null>): number {
  const [largeur, setLargeur] = useState(0);

  useLayoutEffect(() => {
    const element = reference.current;
    if (!element) return;

    // Première mesure immédiate, puis une à chaque changement.
    setLargeur(element.clientWidth);
    const observateur = new ResizeObserver(([entree]) => {
      setLargeur(Math.round(entree.contentRect.width));
    });
    observateur.observe(element);

    // Nettoyage : on arrête d'observer quand le graphique disparaît.
    return () => observateur.disconnect();
  }, [reference]);

  return largeur;
}
