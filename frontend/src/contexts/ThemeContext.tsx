// Fichier : src/contexts/ThemeContext.tsx
//
// Gère le thème de l'application : clair ou sombre.


import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

// Le choix de l'utilisateur, et le thème réellement affiché.
export type PreferenceTheme = "clair" | "sombre" | "auto";
export type Theme = "clair" | "sombre";

// Nom sous lequel le choix est rangé dans le navigateur. Le petit script de
// index.html lit la même clé : les deux doivent rester identiques.
const CLE_STOCKAGE = "datalearn-theme";

// Condition CSS qui est vraie quand l'appareil est réglé en mode sombre.
const REQUETE_SOMBRE = "(prefers-color-scheme: dark)";

// Couleur de la barre du navigateur sur téléphone, selon le thème.
// Elles correspondent au fond des cartes dans chaque mode (index.css).
const COULEUR_BARRE: Record<Theme, string> = {
  clair: "#ffffff",
  sombre: "#1a1816",
};

// Ce que le contexte met à disposition des composants.
interface ValeurTheme {
  preference: PreferenceTheme; // le choix de l'utilisateur
  theme: Theme; // le thème réellement affiché (le résultat du choix)
  changerPreference: (preference: PreferenceTheme) => void;
}

const ThemeContext = createContext<ValeurTheme | undefined>(undefined);

// Lit le choix enregistré. Le navigateur peut refuser l'accès à
// localStorage (navigation privée, réglages stricts) : dans ce cas, ou si
// la valeur enregistrée n'est pas l'une des trois prévues, on revient à "auto".
function lirePreference(): PreferenceTheme {
  try {
    const valeur = localStorage.getItem(CLE_STOCKAGE);
    if (valeur === "clair" || valeur === "sombre" || valeur === "auto") {
      return valeur;
    }
  } catch {
    // Accès refusé : on garde la valeur par défaut.
  }
  return "auto";
}

// Dit si l'appareil est en mode sombre, et se met à jour quand il change.
// Même technique que useGrandEcran dans Layout.tsx.
function useAppareilSombre(): boolean {
  return useSyncExternalStore(
    (prevenir) => {
      const requete = window.matchMedia(REQUETE_SOMBRE);
      requete.addEventListener("change", prevenir);
      return () => requete.removeEventListener("change", prevenir);
    },
    () => window.matchMedia(REQUETE_SOMBRE).matches
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Le choix de l'utilisateur, lu une seule fois au démarrage.
  // Passer une fonction à useState (et non son résultat) évite de relire
  // localStorage à chaque nouvel affichage du composant.
  const [preference, setPreference] = useState<PreferenceTheme>(lirePreference);

  const appareilSombre = useAppareilSombre();

  // Le thème affiché : celui choisi, ou celui de l'appareil en mode "auto".
  const theme: Theme = preference === "auto" ? (appareilSombre ? "sombre" : "clair") : preference;

  // À chaque changement de thème, on met à jour la page.
  useEffect(() => {
    // L'attribut data-theme sur <html> déclenche les couleurs du mode choisi.
    document.documentElement.dataset.theme = theme;

    // La barre du navigateur sur téléphone prend la couleur du thème.
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COULEUR_BARRE[theme]);
  }, [theme]);

  // Enregistre un nouveau choix et le mémorise dans le navigateur.
  function changerPreference(nouvelle: PreferenceTheme) {
    setPreference(nouvelle);
    try {
      localStorage.setItem(CLE_STOCKAGE, nouvelle);
    } catch {
      // Si le navigateur refuse, le choix vaut quand même pour cette visite.
    }
  }

  return (
    <ThemeContext.Provider value={{ preference, theme, changerPreference }}>{children}</ThemeContext.Provider>
  );
}

// Le hook utilisé par les composants : const { preference, changerPreference } = useTheme();
export function useTheme(): ValeurTheme {
  const valeur = useContext(ThemeContext);
  if (valeur === undefined) {
    throw new Error("useTheme doit être utilisé à l'intérieur de ThemeProvider");
  }
  return valeur;
}
