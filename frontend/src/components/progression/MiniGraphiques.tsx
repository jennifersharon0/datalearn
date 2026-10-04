// Fichier : src/components/progression/MiniGraphiques.tsx
//
// Les petits visuels placés dans les quatre indicateurs en haut du tableau
// de bord. Ils remplacent les anciennes icônes décoratives par une
// information réelle :
//   RangeeSemaine : les 7 derniers jours, une case par jour, plus ou moins
//                   foncée selon l'activité (sous la série de jours) ;
//   AnneauProgression : un anneau qui se remplit avec la part des sujets
//                   consultés (à côté du nombre de sujets) ;
//   RepartitionQuiz : une barre en deux parts, quiz réussis et quiz à
//                   revoir (sous le nombre de quiz) ;
//   JaugeScore : une barre de 0 à 100 % avec un repère au seuil de
//                   réussite (sous le score moyen).
//
// Chaque visuel complète un chiffre écrit en clair juste au-dessus : il
// n'est jamais la seule façon d'obtenir l'information.

import { Link } from "react-router-dom";

import { SEUIL_REUSSITE } from "../../lib/categories";
import { compter, formaterJourLong, texteActivite, type JourCalendrier } from "../../lib/statistiques";
import { Infobulle, useInfobulle } from "./Infobulle";

// ---------------------------------------------------------------------------
// Rangée des 7 derniers jours
// ---------------------------------------------------------------------------

export function RangeeSemaine({ jours }: { jours: JourCalendrier[] }) {
  const { conteneur, etat, montrerSur, cacher } = useInfobulle();

  // Nombre de jours actifs, pour la description lue par les lecteurs d'écran.
  const actifs = jours.filter((j) => j.total > 0).length;

  return (
    <div
      ref={conteneur}
      className="tdb-semaine"
      role="img"
      aria-label={`Actif ${compter(actifs, "jour", "jours")} sur les 7 derniers`}
    >
      {jours.map((jour, i) => (
        <div key={jour.cle} className="tdb-semaine-jour">
          {/* La case prend la couleur de son niveau d'activité (classes
              niveau-0 à niveau-4 dans Dashboard.css). Le dernier jour,
              aujourd'hui, est entouré pour servir de repère. */}
          <span
            className={`tdb-case niveau-${jour.niveau}${i === jours.length - 1 ? " aujourdhui" : ""}`}
            onPointerEnter={(e) =>
              montrerSur(
                e.currentTarget,
                <>
                  <strong>{formaterJourLong(jour.date)}</strong>
                  <span>{texteActivite(jour)}</span>
                </>,
              )
            }
            onPointerLeave={cacher}
          />
          {/* Initiale du jour : "L" pour lundi, "M" pour mardi... */}
          <span className="tdb-semaine-initiale">{jour.date.toLocaleDateString("fr-FR", { weekday: "narrow" })}</span>
        </div>
      ))}
      <Infobulle etat={etat} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Anneau de progression
// ---------------------------------------------------------------------------

// Dimensions de l'anneau, en pixels.
const TAILLE_ANNEAU = 64;
const EPAISSEUR_ANNEAU = 7;

export function AnneauProgression({ valeur, total }: { valeur: number; total: number }) {
  const rayon = (TAILLE_ANNEAU - EPAISSEUR_ANNEAU) / 2;
  const circonference = 2 * Math.PI * rayon;
  const part = total > 0 ? valeur / total : 0;
  const pourcent = Math.round(part * 100);

  return (
    <svg
      className="tdb-anneau"
      width={TAILLE_ANNEAU}
      height={TAILLE_ANNEAU}
      viewBox={`0 0 ${TAILLE_ANNEAU} ${TAILLE_ANNEAU}`}
      role="img"
      aria-label={`${pourcent} % du parcours consulté`}
    >
      {/* Piste grise complète. */}
      <circle
        className="tdb-anneau-piste"
        cx={TAILLE_ANNEAU / 2}
        cy={TAILLE_ANNEAU / 2}
        r={rayon}
        strokeWidth={EPAISSEUR_ANNEAU}
      />
      {/* Arc rouge. Le trait fait le tour complet, mais strokeDasharray le
          découpe : une partie visible de la longueur voulue, puis un vide.
          La rotation de -90 degrés fait partir l'arc du haut du cercle. */}
      {part > 0 && (
        <circle
          className="tdb-anneau-valeur"
          cx={TAILLE_ANNEAU / 2}
          cy={TAILLE_ANNEAU / 2}
          r={rayon}
          strokeWidth={EPAISSEUR_ANNEAU}
          strokeDasharray={`${Math.max(part * circonference, 1)} ${circonference}`}
          transform={`rotate(-90 ${TAILLE_ANNEAU / 2} ${TAILLE_ANNEAU / 2})`}
        />
      )}
      {/* Pourcentage écrit au centre. dominantBaseline le centre en hauteur. */}
      <text className="tdb-anneau-texte" x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
        {pourcent} %
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Répartition des quiz réussis et à revoir
// ---------------------------------------------------------------------------

interface ProprietesRepartition {
  reussis: number;
  aRevoir: number;
}

export function RepartitionQuiz({ reussis, aRevoir }: ProprietesRepartition) {
  const total = reussis + aRevoir;

  // Part de chaque segment dans la barre, en pourcentage.
  const partReussis = total > 0 ? (reussis / total) * 100 : 0;

  return (
    <div className="tdb-repartition">
      {/* La barre en deux segments : gris pour les réussis, rouge pour
          ceux à revoir, comme les pastilles de la liste des quiz. */}
      <div
        className="tdb-repartition-barre"
        role="img"
        aria-label={`${compter(reussis, "quiz réussi", "quiz réussis")} et ${aRevoir} à revoir`}
      >
        {reussis > 0 && <span className="segment-reussi" style={{ width: `${partReussis}%` }} />}
        {aRevoir > 0 && <span className="segment-a-revoir" style={{ width: `${100 - partReussis}%` }} />}
      </div>

      {/* Sous la barre, les deux nombres en toutes lettres. Celui des quiz
          à revoir ouvre directement l'historique filtré sur ces quiz. */}
      <div className="tdb-repartition-legende">
        <span>
          <span className="tdb-repartition-pastille segment-reussi" aria-hidden="true" />
          {compter(reussis, "réussi", "réussis")}
        </span>
        {aRevoir > 0 ? (
          <Link to="/tableau-de-bord/quiz?filtre=a-revoir" className="tdb-repartition-lien">
            <span className="tdb-repartition-pastille segment-a-revoir" aria-hidden="true" />
            {aRevoir} à revoir
          </Link>
        ) : (
          <span>0 à revoir</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Jauge du score moyen
// ---------------------------------------------------------------------------

export function JaugeScore({ valeur }: { valeur: number }) {
  return (
    <div className="tdb-jauge">
      <div
        className="tdb-jauge-piste"
        role="img"
        aria-label={`Score moyen de ${valeur} %, seuil de réussite à ${SEUIL_REUSSITE} %`}
      >
        <span className="tdb-jauge-valeur" style={{ width: `${valeur}%` }} />
        {/* Petit trait vertical à la position du seuil de réussite. */}
        <span className="tdb-jauge-seuil" style={{ left: `${SEUIL_REUSSITE}%` }} />
      </div>
      <span className="tdb-mini-note">Seuil de réussite : {SEUIL_REUSSITE} %</span>
    </div>
  );
}
