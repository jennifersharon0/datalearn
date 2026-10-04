

import type { ReactNode } from "react";

import "./VignetteCategorie.css";

// Les quatre familles et les trois variantes possibles.
export type Famille = "fondations" | "modeles" | "langage" | "data";
type Variante = "sombre" | "clair" | "couleur";

// Ce qu'il faut savoir pour dessiner la vignette d'une catégorie.
interface Style {
  famille: Famille;
  variante: Variante;
  motif: () => ReactNode;
}

// ---------------------------------------------------------------------------
// Les motifs
//
// Tous sont dessinés dans un rectangle de 320 sur 120 (le viewBox du SVG).
// Les classes indiquent le rôle de chaque élément :
//   v-trait        lignes et contours discrets
//   v-neutre       points et blocs ordinaires
//   v-fort         éléments pleins mis en avant
//   v-trait-fort   lignes mises en avant
// ---------------------------------------------------------------------------

// Fondamentaux : le cycle de vie d'un projet, des étapes réparties en boucle.
// Les cinq étapes sont placées sur un cercle de rayon 44 centré en (160, 60),
// tous les 72 degrés (360 / 5), en partant du haut.
function MotifCycle() {
  const etapes = [
    [160, 16],
    [201.8, 46.4],
    [185.9, 95.6],
    [134.1, 95.6],
    [118.2, 46.4],
  ];
  return (
    <>
      <circle cx="160" cy="60" r="44" className="v-trait" />
      {/* Arc mis en avant entre la première et la deuxième étape. */}
      <path d="M160 16 A44 44 0 0 1 201.8 46.4" className="v-trait-fort" />
      {etapes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 0 ? 8 : 6} className={i === 0 ? "v-fort" : "v-neutre"} />
      ))}
    </>
  );
}

// Mathématiques : une matrice entre crochets.
function MotifMatrice() {
  const cases = [
    [130, 36], [160, 36], [190, 36],
    [130, 60], [190, 60],
    [160, 84], [190, 84],
  ];
  return (
    <>
      <path d="M114 20h-10v80h10M206 20h10v80h-10" className="v-trait" />
      {cases.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="5" className="v-neutre" />
      ))}
      <circle cx="160" cy="60" r="6.5" className="v-fort" />
      <circle cx="130" cy="84" r="6.5" className="v-fort" />
    </>
  );
}

// Programmation : des lignes de code de longueurs différentes.
function MotifCode() {
  const lignes = [
    [96, 30, 80], [112, 46, 96], [112, 62, 60], [128, 78, 70], [96, 94, 40],
  ];
  return (
    <>
      <path d="M78 44 L64 60 L78 76 M242 44 L256 60 L242 76" className="v-trait-fort" />
      {lignes.map(([x, y, largeur], i) => (
        <rect key={i} x={x} y={y - 4} width={largeur} height="8" rx="4" className={i === 2 ? "v-fort" : "v-neutre"} />
      ))}
    </>
  );
}

// Machine learning : un nuage de points et sa droite de régression.
function MotifRegression() {
  const points = [
    [70, 92], [92, 80], [110, 86], [128, 70], [150, 66],
    [168, 58], [186, 60], [206, 44], [226, 40], [246, 30],
  ];
  return (
    <>
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" className="v-neutre" />
      ))}
      <circle cx="140" cy="50" r="4.5" className="v-fort" />
      <circle cx="196" cy="74" r="4.5" className="v-fort" />
      <line x1="55" y1="100" x2="265" y2="24" className="v-trait-fort" />
    </>
  );
}

// Deep learning : trois couches de neurones et un chemin qui les traverse.
function MotifNeurones() {
  const entree = [30, 60, 90];
  const cachee = [20, 50, 80, 100];
  const sortie = [45, 75];
  const liens: string[] = [];
  entree.forEach((a) => cachee.forEach((b) => liens.push(`M100 ${a}L160 ${b}`)));
  cachee.forEach((a) => sortie.forEach((b) => liens.push(`M160 ${a}L220 ${b}`)));
  return (
    <>
      <path d={liens.join("")} className="v-trait" />
      <path d="M100 60L160 50L220 75" className="v-trait-fort" />
      {entree.map((y) => (
        <circle key={`e${y}`} cx="100" cy={y} r="6" className={y === 60 ? "v-fort" : "v-neutre"} />
      ))}
      {cachee.map((y) => (
        <circle key={`c${y}`} cx="160" cy={y} r="6" className={y === 50 ? "v-fort" : "v-neutre"} />
      ))}
      {sortie.map((y) => (
        <circle key={`s${y}`} cx="220" cy={y} r="6" className={y === 75 ? "v-fort" : "v-neutre"} />
      ))}
    </>
  );
}

// NLP : une phrase découpée en tokens.
function MotifTokens() {
  const tokens = [
    [56, 32, 54], [118, 32, 34], [160, 32, 64], [232, 32, 34],
    [84, 66, 44], [136, 66, 46], [190, 66, 70],
  ];
  return (
    <>
      {tokens.map(([x, y, largeur], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={largeur}
          height="22"
          rx="11"
          className={i === 3 || i === 5 ? "v-fort" : "v-neutre"}
        />
      ))}
    </>
  );
}

// LLM : un échange de messages, comme dans une conversation.
function MotifConversation() {
  return (
    <>
      <rect x="70" y="20" width="120" height="36" rx="14" className="v-neutre" />
      <rect x="130" y="66" width="120" height="36" rx="14" className="v-fort" />
      <rect x="86" y="32" width="70" height="5" rx="2.5" className="v-fond-motif" />
      <rect x="86" y="42" width="44" height="5" rx="2.5" className="v-fond-motif" />
      <rect x="146" y="78" width="80" height="5" rx="2.5" className="v-fond-motif" />
      <rect x="146" y="88" width="56" height="5" rx="2.5" className="v-fond-motif" />
    </>
  );
}

// Embeddings : des vecteurs qui partent d'une origine, dans un espace à deux axes.
function MotifVecteurs() {
  return (
    <>
      <path d="M110 100H250M110 100V14" className="v-trait" />
      <path d="M110 100L180 40M110 100L200 52" className="v-trait-fort" />
      <path d="M110 100L230 86M110 100L140 26" className="v-trait" />
      <circle cx="180" cy="40" r="6" className="v-fort" />
      <circle cx="200" cy="52" r="6" className="v-fort" />
      <circle cx="230" cy="86" r="5" className="v-neutre" />
      <circle cx="140" cy="26" r="5" className="v-neutre" />
    </>
  );
}

// RAG : une loupe qui retrouve, parmi plusieurs documents, celui qui répond.
function MotifDocuments() {
  const documents = [72, 108, 144];
  return (
    <>
      {documents.map((x, i) => (
        <rect key={x} x={x} y="34" width="28" height="38" rx="4" className={i === 1 ? "v-fort" : "v-neutre"} />
      ))}
      {/* Liaison entre le document retrouvé et la loupe. */}
      <path d="M122 78 C122 98 180 98 190 72" className="v-trait-fort" />
      {/* La loupe : un cercle et un manche. */}
      <circle cx="212" cy="52" r="22" className="v-trait-fort" />
      <path d="M228 68 L246 86" className="v-trait-fort" />
    </>
  );
}

// Recherche opérationnelle : un graphe et son plus court chemin.
function MotifGraphe() {
  return (
    <>
      <path
        d="M70 80L120 35L190 30L250 70L200 95L130 90L70 80M120 35L130 90M190 30L200 95M130 90L190 30"
        className="v-trait"
      />
      <path d="M70 80L130 90L190 30L250 70" className="v-trait-fort" />
      <circle cx="120" cy="35" r="5" className="v-neutre" />
      <circle cx="200" cy="95" r="5" className="v-neutre" />
      <circle cx="70" cy="80" r="6.5" className="v-fort" />
      <circle cx="130" cy="90" r="5" className="v-fort" />
      <circle cx="190" cy="30" r="5" className="v-fort" />
      <circle cx="250" cy="70" r="6.5" className="v-fort" />
    </>
  );
}

// MLOps : un pipeline d'étapes, avec une boucle de retour (déploiement continu).
function MotifPipeline() {
  const etapes = [70, 130, 190, 250];
  return (
    <>
      <path d="M94 66H130M154 66H190M214 66H250" className="v-trait" />
      <path d="M262 52 C262 14 70 14 70 52" className="v-trait-fort" />
      {etapes.map((x, i) => (
        <rect key={x} x={x - 12} y="54" width="24" height="24" rx="6" className={i === 3 ? "v-fort" : "v-neutre"} />
      ))}
    </>
  );
}

// Data engineering : des bases de données reliées.
function MotifBases() {
  // Une base est dessinée comme un cylindre : un rectangle et deux ellipses.
  const base = (x: number, fort: boolean) => (
    <g key={x} className={fort ? "v-fort" : "v-neutre"}>
      <rect x={x - 20} y="36" width="40" height="48" />
      <ellipse cx={x} cy="84" rx="20" ry="7" />
      <ellipse cx={x} cy="36" rx="20" ry="7" className="v-dessus" />
    </g>
  );
  return (
    <>
      <path d="M120 60H140M180 60H200" className="v-trait-fort" />
      {base(100, false)}
      {base(160, true)}
      {base(220, false)}
    </>
  );
}

// Visualisation : un diagramme en barres.
function MotifBarres() {
  const barres = [
    [90, 40], [116, 56], [142, 76], [168, 48], [194, 70], [220, 86],
  ];
  return (
    <>
      {barres.map(([x, hauteur], i) => (
        <rect
          key={x}
          x={x}
          y={104 - hauteur}
          width="18"
          height={hauteur}
          rx="3"
          className={i === 2 || i === 5 ? "v-fort" : "v-neutre"}
        />
      ))}
      <line x1="80" y1="105" x2="248" y2="105" className="v-trait" />
    </>
  );
}

// Éthique : une balance.
function MotifBalance() {
  return (
    <>
      <path d="M160 22V98M126 98H194" className="v-trait-fort" />
      <path d="M96 34H224" className="v-trait-fort" />
      <path d="M96 34L76 72M96 34L116 72M224 34L204 72M224 34L244 72" className="v-trait" />
      <path d="M72 72 A24 12 0 0 0 120 72 Z" className="v-neutre" />
      <path d="M200 72 A24 12 0 0 0 248 72 Z" className="v-fort" />
      <circle cx="160" cy="22" r="6" className="v-fort" />
    </>
  );
}

// Apprentissage par renforcement : un agent qui trouve son chemin dans une grille.
function MotifGrille() {
  const cases: ReactNode[] = [];
  for (let ligne = 0; ligne < 3; ligne++) {
    for (let colonne = 0; colonne < 6; colonne++) {
      cases.push(
        <rect
          key={`${ligne}-${colonne}`}
          x={88 + colonne * 26}
          y={22 + ligne * 26}
          width="20"
          height="20"
          rx="4"
          className="v-trait-case"
        />
      );
    }
  }
  return (
    <>
      {cases}
      <path d="M98 84V58H150V32H228" className="v-trait-fort" />
      <circle cx="98" cy="84" r="6" className="v-neutre" />
      <rect x="218" y="22" width="20" height="20" rx="4" className="v-fort" />
    </>
  );
}

// Outils et plateformes : des tuiles d'applications.
function MotifTuiles() {
  const tuiles: ReactNode[] = [];
  const fortes = new Set(["0-2", "1-4", "2-1"]);
  for (let ligne = 0; ligne < 3; ligne++) {
    for (let colonne = 0; colonne < 6; colonne++) {
      const cle = `${ligne}-${colonne}`;
      tuiles.push(
        <rect
          key={cle}
          x={84 + colonne * 26}
          y={22 + ligne * 26}
          width="22"
          height="22"
          rx="6"
          className={fortes.has(cle) ? "v-fort" : "v-neutre"}
        />
      );
    }
  }
  return <>{tuiles}</>;
}

// ---------------------------------------------------------------------------
// Association de chaque catégorie (nom exact de topics.py) à son style.
// Les variantes alternent pour que deux cartes voisines aient rarement le
// même fond dans la grille.
// ---------------------------------------------------------------------------

const STYLES: Record<string, Style> = {
  "Fondamentaux de la Data Science": { famille: "fondations", variante: "sombre", motif: MotifCycle },
  "Mathématiques & Statistiques": { famille: "fondations", variante: "clair", motif: MotifMatrice },
  "Programmation & Outils": { famille: "fondations", variante: "couleur", motif: MotifCode },
  "Machine Learning Classique": { famille: "modeles", variante: "clair", motif: MotifRegression },
  "Deep Learning": { famille: "modeles", variante: "sombre", motif: MotifNeurones },
  "NLP (Traitement du Langage)": { famille: "langage", variante: "couleur", motif: MotifTokens },
  "LLMs & Prompt Engineering": { famille: "langage", variante: "couleur", motif: MotifConversation },
  "Embeddings & Recherche Vectorielle": { famille: "langage", variante: "clair", motif: MotifVecteurs },
  "RAG & Systèmes de Récupération": { famille: "langage", variante: "sombre", motif: MotifDocuments },
  "Recherche Opérationnelle & Optimisation": { famille: "modeles", variante: "sombre", motif: MotifGraphe },
  "MLOps & Déploiement": { famille: "data", variante: "couleur", motif: MotifPipeline },
  "Data Engineering": { famille: "data", variante: "clair", motif: MotifBases },
  "Visualisation de Données": { famille: "data", variante: "clair", motif: MotifBarres },
  "Éthique & IA Responsable": { famille: "data", variante: "sombre", motif: MotifBalance },
  "Apprentissage par Renforcement": { famille: "modeles", variante: "couleur", motif: MotifGrille },
  "Outils & Plateformes Récentes": { famille: "data", variante: "sombre", motif: MotifTuiles },
};

// Style de secours pour une catégorie ajoutée plus tard sans style prévu ici.
const STYLE_PAR_DEFAUT: Style = { famille: "fondations", variante: "sombre", motif: MotifCycle };

// Donne la famille de couleur d'une catégorie. Le tableau de bord s'en sert
// pour colorer chaque barre de catégorie comme sa vignette.
export function familleCategorie(nom: string): Famille {
  return (STYLES[nom] ?? STYLE_PAR_DEFAUT).famille;
}

interface Proprietes {
  nom: string; // nom exact de la catégorie
  grande?: boolean; // version agrandie, pour l'en-tête de la page de catégorie
}

export function VignetteCategorie({ nom, grande = false }: Proprietes) {
  const { famille, variante, motif: Motif } = STYLES[nom] ?? STYLE_PAR_DEFAUT;

  // Les classes choisissent les couleurs dans VignetteCategorie.css.
  const classes = ["vignette", `famille-${famille}`, `variante-${variante}`, grande ? "vignette-grande" : ""];

  return (
    // aria-hidden : l'illustration est purement décorative, le nom de la
    // catégorie est écrit juste à côté.
    <div className={classes.join(" ")} aria-hidden="true">
      {/* preserveAspectRatio centre le motif sans le déformer, quelle que
          soit la largeur de la carte. */}
      <svg viewBox="0 0 320 120" preserveAspectRatio="xMidYMid meet">
        <Motif />
      </svg>
    </div>
  );
}
