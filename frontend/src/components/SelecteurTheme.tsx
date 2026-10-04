// Fichier : src/components/SelecteurTheme.tsx
//
// Petit sélecteur à trois choix (Clair, Sombre, Auto), affiché dans le menu.
// Il lit et modifie le thème grâce à useTheme() (fichier ThemeContext.tsx).
// Ses styles sont dans Layout.css, puisqu'il fait partie du menu.

// Icônes : un soleil, une lune, et un écran pour "suivre l'appareil".
import { Monitor, Moon, Sun } from "lucide-react";

import { useTheme, type PreferenceTheme } from "../contexts/ThemeContext";

// Les trois options, décrites une fois puis affichées avec .map().
const OPTIONS: { valeur: PreferenceTheme; libelle: string; Icone: typeof Sun }[] = [
  { valeur: "clair", libelle: "Clair", Icone: Sun },
  { valeur: "sombre", libelle: "Sombre", Icone: Moon },
  { valeur: "auto", libelle: "Auto", Icone: Monitor },
];

export function SelecteurTheme() {
  const { preference, changerPreference } = useTheme();

  return (
    // role="radiogroup" et role="radio" indiquent aux lecteurs d'écran
    // qu'un seul choix est possible parmi les trois.
    <div className="selecteur-theme" role="radiogroup" aria-label="Thème de l'application">
      {OPTIONS.map(({ valeur, libelle, Icone }) => (
        <button
          key={valeur}
          type="button"
          role="radio"
          aria-checked={preference === valeur}
          className={preference === valeur ? "selecteur-theme-option actif" : "selecteur-theme-option"}
          onClick={() => changerPreference(valeur)}
          // Bulle au survol pour expliquer le choix "Auto".
          title={valeur === "auto" ? "Suit le réglage de ton appareil" : undefined}
        >
          <Icone size={16} aria-hidden="true" />
          {libelle}
        </button>
      ))}
    </div>
  );
}
