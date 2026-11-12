// Fichier : src/components/assistant/Mascotte.tsx
//
// La mascotte de l'assistant : un petit personnage avec un casque micro,
// qui salue d'une main et tient une tablette de l'autre. Elle est dessinée
// en SVG, donc nette à toutes les tailles et sans fichier image à charger.
//
// Deux cadrages :
//   "tete"     la tête seule, dans un rond, pour l'en-tête et les messages ;
//   "lanceur"  le bouton qui ouvre l'assistant : le personnage dépasse du
//              cercle rouge par le haut, comme s'il passait la tête.

import { useId } from "react";

interface Proprietes {
  cadrage: "tete" | "lanceur";
  taille: number; // côté du carré pour "tete", diamètre du cercle pour "lanceur"
}

// Le dessin complet, dans un repère de 200 × 240. Chaque cadrage n'en
// montre qu'une partie grâce à son viewBox.
function Personnage({ idDegrade }: { idDegrade: string }) {
  const blanc = `url(#${idDegrade})`;
  const trait = "#e3dbd4";

  return (
    <>
      <defs>
        <linearGradient id={idDegrade} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#efe8e2" />
        </linearGradient>
      </defs>

      {/* Bras qui salue. */}
      <path d="M62 146 Q38 142 26 118" fill="none" stroke={trait} strokeWidth="24" strokeLinecap="round" />
      <path d="M62 146 Q38 142 26 118" fill="none" stroke="#fbf8f6" strokeWidth="20" strokeLinecap="round" />
      <circle cx="24" cy="111" r="12" fill="#fbf8f6" stroke={trait} strokeWidth="2" />

      {/* Corps, avec l'écusson DataLearn (la toque). */}
      <path
        d="M60 140 Q60 128 74 128 L126 128 Q140 128 140 140 L144 194 Q146 214 126 216 L74 216 Q54 214 56 194 Z"
        fill={blanc}
        stroke={trait}
        strokeWidth="2"
      />
      <rect x="80" y="146" width="40" height="40" rx="12" fill="#c62828" />
      <g transform="translate(88 154)" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10 12 5 2 10l10 5 10-5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </g>

      {/* Bras qui tient la tablette, avec un petit graphique en barres. */}
      <path d="M138 142 Q152 160 142 190" fill="none" stroke={trait} strokeWidth="24" strokeLinecap="round" />
      <path d="M138 142 Q152 160 142 190" fill="none" stroke="#fbf8f6" strokeWidth="20" strokeLinecap="round" />
      <g transform="rotate(-8 156 190)">
        <rect x="134" y="172" width="46" height="36" rx="7" fill="#2b1d14" />
        <rect x="150" y="191" width="6" height="10" rx="1.5" fill="#f5bcbc" />
        <rect x="159" y="185" width="6" height="16" rx="1.5" fill="#ef8a8a" />
        <rect x="168" y="178" width="6" height="23" rx="1.5" fill="#e53935" />
      </g>
      <circle cx="140" cy="196" r="9" fill="#fbf8f6" stroke={trait} strokeWidth="2" />

      {/* Cou et tête. */}
      <rect x="88" y="118" width="24" height="14" rx="5" fill={trait} />
      <rect x="42" y="34" width="116" height="90" rx="38" fill={blanc} stroke={trait} strokeWidth="2" />
      <rect x="56" y="50" width="88" height="58" rx="26" fill="#fdf2f2" />
      <ellipse cx="82" cy="77" rx="7" ry="9" fill="#2b1d14" />
      <ellipse cx="118" cy="77" rx="7" ry="9" fill="#2b1d14" />
      <circle cx="84.5" cy="73.5" r="2.4" fill="#ffffff" />
      <circle cx="120.5" cy="73.5" r="2.4" fill="#ffffff" />
      <path d="M91 93 Q100 99 109 93" fill="none" stroke="#2b1d14" strokeWidth="3.2" strokeLinecap="round" />

      {/* Casque micro : c'est lui qui dit "je suis là pour répondre". */}
      <path d="M46 70 Q46 18 100 18 Q154 18 154 70" fill="none" stroke="#c62828" strokeWidth="7" strokeLinecap="round" />
      <rect x="32" y="60" width="18" height="34" rx="9" fill="#c62828" />
      <rect x="150" y="60" width="18" height="34" rx="9" fill="#c62828" />
      <path d="M41 92 Q43 111 70 108" fill="none" stroke="#c62828" strokeWidth="4" strokeLinecap="round" />
      <circle cx="72" cy="107.5" r="5" fill="#c62828" />
    </>
  );
}

export function Mascotte({ cadrage, taille }: Proprietes) {
  // Identifiant unique du dégradé : plusieurs mascottes peuvent être
  // affichées en même temps, et deux dégradés ne doivent pas porter le
  // même id dans la page.
  const idDegrade = `mascotte-${useId().replace(/:/g, "")}`;

  if (cadrage === "tete") {
    return (
      <svg viewBox="26 -5 148 148" width={taille} height={taille} aria-hidden="true" focusable="false">
        <Personnage idDegrade={idDegrade} />
      </svg>
    );
  }

  // Lanceur : le cercle rouge en bas, le personnage par-dessus. Le
  // découpage (clip-path) garde tout ce qui dépasse en haut du cercle,
  // mais coupe le bas du corps en suivant l'arrondi du cercle.
  const hauteur = Math.round(taille * 1.32);
  const bas = hauteur - taille / 2;
  const decoupe = `path('M0 0 H${taille} V${bas} A${taille / 2} ${taille / 2} 0 0 1 0 ${bas} Z')`;

  return (
    <span className="mascotte-lanceur" style={{ width: taille, height: hauteur, clipPath: decoupe }} aria-hidden="true">
      <span className="mascotte-lanceur-cercle" style={{ width: taille, height: taille }} />
      <svg
        viewBox="20 12 160 200"
        width={Math.round(taille * 1.1)}
        height={Math.round(taille * 1.375)}
        style={{ position: "absolute", left: Math.round(-taille * 0.05), top: 0 }}
        focusable="false"
      >
        <Personnage idDegrade={idDegrade} />
      </svg>
    </span>
  );
}
