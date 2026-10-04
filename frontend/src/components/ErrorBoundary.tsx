// Fichier : src/components/ErrorBoundary.tsx
/* Ce composant sert de filet de sécurité. Quand une erreur survient pendant
 l'affichage d'un composant, React retire toute l'application de l'écran,
 ce qui donne une page blanche (c'est ce qui t'est arrivé avec Topics.tsx).
 Placé autour de l'application, ce composant intercepte l'erreur et affiche
 à la place un message propre avec un bouton pour repartir.

 C'est le seul fichier du projet écrit sous forme de classe : React ne
 propose cette fonctionnalité que pour les composants de type classe.

 Component est la classe de base des composants React écrits en classe.
 ErrorInfo contient des détails sur l'endroit où l'erreur s'est produite.*/
import { Component, type ErrorInfo, type ReactNode } from "react";

// Icônes (librairie lucide-react) : un triangle d'alerte et une flèche circulaire.
import { RotateCcw, TriangleAlert } from "lucide-react";

// Ce que le composant reçoit : le contenu à protéger.
interface Proprietes {
  children: ReactNode;
}

// Ce que le composant mémorise : une erreur a-t-elle eu lieu ou non.
interface Etat {
  aUneErreur: boolean;
}

export class ErrorBoundary extends Component<Proprietes, Etat> {
  // État de départ : aucune erreur.
  state: Etat = { aUneErreur: false };

  // React appelle cette méthode dès qu'un composant enfant plante.
  // Elle renvoie le nouvel état, ce qui déclenche l'affichage de secours.
  static getDerivedStateFromError(): Etat {
    return { aUneErreur: true };
  }

  // Appelée juste après, avec le détail de l'erreur.
  // On l'écrit dans la console pour pouvoir comprendre ce qui s'est passé.
  componentDidCatch(erreur: Error, infos: ErrorInfo) {
    console.error("Erreur d'affichage interceptée :", erreur, infos.componentStack);
  }

  // Recharge l'application depuis la page d'accueil, ce qui remet tout à zéro.
  revenirAlAccueil = () => {
    window.location.assign("/");
  };

  // Ce qui s'affiche à l'écran.
  render() {
    // Tant qu'il n'y a pas d'erreur, on affiche normalement le contenu protégé.
    if (!this.state.aUneErreur) {
      return this.props.children;
    }

    // En cas d'erreur, on affiche l'écran de secours.
    // role="alert" signale aux lecteurs d'écran qu'un message important est apparu.
    return (
      <div className="ecran-secours" role="alert">
        <div className="ecran-secours-carte">
          <div className="ecran-secours-icone">
            <TriangleAlert size={28} aria-hidden="true" />
          </div>
          <h1>Un problème est survenu</h1>
          <p>
            Cette page n'a pas pu s'afficher correctement. Tes données ne sont pas perdues, tu peux
            reprendre depuis l'accueil.
          </p>
          <button type="button" className="bouton bouton-primaire" onClick={this.revenirAlAccueil}>
            <RotateCcw size={18} aria-hidden="true" />
            Revenir à l'accueil
          </button>
        </div>
      </div>
    );
  }
}
