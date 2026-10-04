// Fichier : src/components/progression/Tuile.tsx
//
// Les indicateurs (les "tuiles") affichés en haut de "Ma progression" et
// de "Historique des quiz" : un intitulé, une valeur en grand, un petit
// texte et un visuel. Ils sont dans leur propre fichier parce que les deux
// pages les utilisent, et doivent donc avoir exactement le même aspect.
//
// On y trouve aussi TexteEvolution, la phrase sous le score moyen qui dit
// s'il a monté ou baissé pendant la semaine.
//
// Les styles (classes tdb-tuile...) sont dans pages/Dashboard.css.

import type { ReactNode } from "react";

// Flèches qui accompagnent l'évolution du score.
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { compter, type EvolutionScore } from "../../lib/statistiques";

// Un indicateur : un intitulé, une valeur en grand, et un visuel en dessous
// (ou à côté, si "cote" est vrai).
interface ProprietesTuile {
  libelle: string;
  valeur: ReactNode;
  complement?: ReactNode; // petit texte sous la valeur
  visuel: ReactNode;
  cote?: boolean;
}

export function Tuile({ libelle, valeur, complement, visuel, cote = false }: ProprietesTuile) {
  return (
    <article className={cote ? "tdb-tuile tdb-tuile-cote" : "tdb-tuile"}>
      <div className="tdb-tuile-texte">
        <h2 className="tdb-tuile-libelle">{libelle}</h2>
        <p className="tdb-tuile-valeur">{valeur}</p>
        {complement && <p className="tdb-tuile-complement">{complement}</p>}
      </div>
      <div className="tdb-tuile-visuel">{visuel}</div>
    </article>
  );
}

// Texte de l'évolution du score moyen sur 7 jours, avec une flèche qui
// indique le sens. Le sens est aussi écrit en toutes lettres ("en hausse",
// "en baisse") : la flèche n'est qu'un repère visuel en plus.
export function TexteEvolution({ evolution }: { evolution: EvolutionScore }) {
  if (evolution.type === "aucun") return null;
  if (evolution.type === "debut") return <>Tes premiers quiz datent de cette semaine</>;
  if (evolution.type === "stable") return <>Aucun quiz cette semaine</>;

  const { points } = evolution;

  if (points === 0) {
    return (
      <span className="tdb-evolution">
        <ArrowRight size={15} aria-hidden="true" />
        Moyenne stable cette semaine
      </span>
    );
  }

  const Fleche = points > 0 ? ArrowUpRight : ArrowDownRight;
  // Math.abs donne la valeur sans le signe : "en baisse de 3", pas "de -3".
  const ecart = compter(Math.abs(points), "point", "points");

  return (
    <span className="tdb-evolution">
      <Fleche size={15} aria-hidden="true" />
      {points > 0 ? `En hausse de ${ecart} cette semaine` : `En baisse de ${ecart} cette semaine`}
    </span>
  );
}
