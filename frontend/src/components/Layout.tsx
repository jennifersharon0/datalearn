// Fichier : src/components/Layout.tsx


// useEffect réagit à l'ouverture du tiroir, useRef garde une référence vers
// un bouton, useState mémorise si le tiroir est ouvert, et
// useSyncExternalStore permet de suivre la largeur de l'écran.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Link et NavLink créent des liens internes (NavLink sait en plus si son lien
// correspond à la page affichée). Outlet est l'emplacement de la page en cours.
import { Link, NavLink, Outlet } from "react-router-dom";

// Icônes du menu.
import { BookOpen, ChartColumn, GraduationCap, House, LogOut, Menu, Sparkles, UserRound, X } from "lucide-react";

// Utilisateur connecté et déconnexion (fichier AuthContext.tsx).
import { useAuth } from "../contexts/AuthContext";

// Prénom et initiale de l'utilisateur (fichier utilisateur.ts).
import { initialeUtilisateur, prenomUtilisateur } from "../lib/utilisateur";

// Sélecteur du thème clair, sombre ou automatique.
import { SelecteurTheme } from "./SelecteurTheme";

// Styles propres à ce composant.
import "./Layout.css";

// Largeur à partir de laquelle le menu reste affiché en permanence.
// Elle doit correspondre à la valeur utilisée dans Layout.css.
const REQUETE_GRAND_ECRAN = "(min-width: 900px)";

// Entrées du menu, écrites une seule fois.
const LIENS = [
  { chemin: "/", libelle: "Accueil", Icone: House },
  { chemin: "/cours", libelle: "Mes cours", Icone: BookOpen },
  { chemin: "/notion-du-jour", libelle: "Notion du jour", Icone: Sparkles },
  { chemin: "/tableau-de-bord", libelle: "Ma progression", Icone: ChartColumn },
  { chemin: "/profil", libelle: "Mon profil", Icone: UserRound },
];

// Dit si l'écran est actuellement large, et se met à jour quand il change
// (rotation d'une tablette, fenêtre redimensionnée...).
// window.matchMedia évalue une condition CSS depuis JavaScript.
// useSyncExternalStore est la façon recommandée par React de lire une valeur
// qui vit en dehors de React : il s'abonne aux changements et redessine le
// composant quand la valeur change.
function useGrandEcran(): boolean {
  return useSyncExternalStore(
    // Abonnement : appelle "prevenir" à chaque changement de largeur.
    (prevenir) => {
      const requete = window.matchMedia(REQUETE_GRAND_ECRAN);
      requete.addEventListener("change", prevenir);
      return () => requete.removeEventListener("change", prevenir);
    },
    // Lecture de la valeur actuelle.
    () => window.matchMedia(REQUETE_GRAND_ECRAN).matches,
  );
}

export function Layout() {
  const { utilisateur, deconnecter } = useAuth();

  // Vrai quand le tiroir est ouvert (n'a d'effet que sur petit écran).
  const [ouvert, setOuvert] = useState(false);

  const grandEcran = useGrandEcran();

  // Références vers les deux boutons, pour déplacer le focus clavier :
  // à l'ouverture, on le place sur le bouton de fermeture du tiroir ;
  // à la fermeture, on le rend au bouton à trois barres.
  const boutonOuvrir = useRef<HTMLButtonElement>(null);
  const boutonFermer = useRef<HTMLButtonElement>(null);

  // Prénom (ou null) et initiale de l'utilisateur.
  const prenom = prenomUtilisateur(utilisateur);
  const initiale = initialeUtilisateur(utilisateur);

  // Le tiroir n'existe que sur petit écran : on le considère ouvert
  // seulement dans ce cas.
  const tiroirOuvert = ouvert && !grandEcran;

  // Tant que le tiroir est ouvert : la page derrière ne défile plus, et la
  // touche Échap le referme. La fonction de nettoyage annule tout ça à la
  // fermeture.
  useEffect(() => {
    if (!tiroirOuvert) return;

    boutonFermer.current?.focus();

    const debordementInitial = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function surTouche(evenement: KeyboardEvent) {
      if (evenement.key === "Escape") {
        fermer();
      }
    }
    document.addEventListener("keydown", surTouche);

    return () => {
      document.body.style.overflow = debordementInitial;
      document.removeEventListener("keydown", surTouche);
    };
  }, [tiroirOuvert]);

  // Ferme le tiroir et rend le focus au bouton qui l'a ouvert.
  function fermer() {
    setOuvert(false);
    boutonOuvrir.current?.focus();
  }

  return (
    <div className="cadre">
      {/* Barre du haut, visible seulement sur petit écran. */}
      <header className="barre-haut">
        <button
          ref={boutonOuvrir}
          type="button"
          className="bouton-icone"
          onClick={() => setOuvert(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={tiroirOuvert}
          aria-controls="menu-principal"
        >
          <Menu size={22} aria-hidden="true" />
        </button>

        <Link to="/" className="marque">
          <span className="marque-logo" aria-hidden="true">
            <GraduationCap size={20} />
          </span>
          <span className="marque-nom">DataLearn</span>
        </Link>

        <span className="avatar" aria-hidden="true">
          {initiale}
        </span>
      </header>

      {/* Voile sombre derrière le tiroir ouvert. Le toucher referme le menu. */}
      {tiroirOuvert && <div className="voile" onClick={fermer} aria-hidden="true" />}

      {/* Le menu. Sur petit écran et tiroir fermé, "inert" le rend
          inaccessible au clavier et aux lecteurs d'écran : sans ça, la touche
          Tab irait sur des liens invisibles, cachés hors de l'écran. */}
      <aside
        id="menu-principal"
        className={tiroirOuvert ? "menu ouvert" : "menu"}
        aria-label="Menu principal"
        inert={!grandEcran && !ouvert}
      >
        <div className="menu-entete">
          <Link to="/" className="marque" onClick={() => setOuvert(false)}>
            <span className="marque-logo" aria-hidden="true">
              <GraduationCap size={20} />
            </span>
            <span className="marque-nom">DataLearn</span>
          </Link>

          {/* Bouton de fermeture, masqué sur grand écran par le CSS. */}
          <button
            ref={boutonFermer}
            type="button"
            className="bouton-icone menu-fermer"
            onClick={fermer}
            aria-label="Fermer le menu"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        {/* Liens de navigation. Cliquer sur un lien referme le tiroir. */}
        <nav className="menu-liens">
          {LIENS.map(({ chemin, libelle, Icone }) => (
            <NavLink
              key={chemin}
              to={chemin}
              // "end" évite que "/" soit actif sur toutes les pages.
              end={chemin === "/"}
              className={({ isActive }) => (isActive ? "menu-lien actif" : "menu-lien")}
              onClick={() => setOuvert(false)}
            >
              <Icone size={20} aria-hidden="true" />
              {libelle}
            </NavLink>
          ))}
        </nav>

        {/* Choix du thème, juste au-dessus du compte. */}
        <SelecteurTheme />

        {/* Compte de l'utilisateur, en bas du menu. */}
        <div className="menu-compte">
          {/* La pastille et le nom mènent aussi à "Mon profil". */}
          <Link to="/profil" className="menu-compte-lien" onClick={() => setOuvert(false)}>
            <span className="avatar" aria-hidden="true">
              {initiale}
            </span>
            <span className="menu-compte-texte">
              <span className="menu-compte-nom">{prenom ?? "Mon compte"}</span>
              <span className="menu-compte-email">{utilisateur?.email}</span>
            </span>
          </Link>
          <button
            type="button"
            className="bouton-icone"
            onClick={deconnecter}
            aria-label="Se déconnecter"
            title="Se déconnecter"
          >
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
      </aside>

      {/* Zone de la page en cours. */}
      <main className="zone-page">
        <Outlet />
      </main>
    </div>
  );
}
