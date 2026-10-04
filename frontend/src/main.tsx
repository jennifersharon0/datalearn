// Fichier : src/main.tsx
//
// Point de départ de l'application : c'est le premier fichier exécuté par le
// navigateur (index.html le charge). Il importe la police et les styles,
// puis affiche le composant App dans la balise <div id="root"> de index.html.

// StrictMode active des vérifications supplémentaires pendant le
// développement (il signale certaines erreurs courantes). Il n'a aucun
// effet sur la version mise en ligne.
import { StrictMode } from "react";

// createRoot relie React à un élément de la page HTML.
import { createRoot } from "react-dom/client";

// Police Inter, installée avec npm et servie par notre propre application.
// Aucune requête n'est envoyée à un service extérieur comme Google Fonts.
import "@fontsource-variable/inter";

// Styles de toute l'application (fichier 13).
import "./index.css";

// Le composant racine qui contient toutes les pages (fichier 12).
import App from "./App";

// On cherche la balise qui doit accueillir l'application.
const racine = document.getElementById("root");

// Si elle n'existe pas, index.html a été modifié par erreur : on le signale.
if (!racine) {
  throw new Error("Élément #root introuvable dans index.html");
}

// Affichage de l'application.
createRoot(racine).render(
  <StrictMode>
    <App />
  </StrictMode>
);
