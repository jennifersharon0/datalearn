// Fichier : src/components/progression/Graphiques.tsx
//
// Les trois graphiques principaux du tableau de bord :
//   ActiviteHebdomadaire : 12 semaines d'activité, une barre par semaine,
//                          d'autant plus haute qu'on a travaillé ;
//   CourbeScores : l'évolution des scores aux derniers quiz, avec le seuil
//                  de réussite en pointillé ;
//   BarresCategories : la part des leçons consultées dans chaque catégorie,
//                      chaque barre prenant la couleur de famille de sa
//                      vignette dans "Mes cours".
//
// Le graphique d'activité et la courbe réagissent au survol et au clavier
// avec une bulle qui donne le détail. Les barres écrivent tout en
// clair et n'en ont pas besoin. Les couleurs viennent de
// Dashboard.css, qui prévoit des teintes différentes pour le mode sombre.

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Link } from "react-router-dom";

import type { HistoriqueQuizLigne } from "../../lib/apiClient";
import { SEUIL_REUSSITE, type Categorie } from "../../lib/categories";
import { compter, formaterJourCourt, pourcentage, pourcentageQuiz, type SemaineActivite } from "../../lib/statistiques";
import { familleCategorie } from "../VignetteCategorie";
import { Infobulle, useInfobulle, useLargeur } from "./Infobulle";

// ---------------------------------------------------------------------------
// Activité semaine par semaine
// ---------------------------------------------------------------------------

// Hauteur totale du graphique, et marges autour de la zone des barres : à
// gauche pour les nombres, en bas pour les dates.
const HAUTEUR_ACTIVITE = 200;
const MARGES_ACTIVITE = { haut: 12, droite: 4, bas: 26, gauche: 28 };

// Largeur maximale d'une barre et de son emplacement, en pixels, et part de
// l'emplacement occupée par la barre (le reste fait l'espace entre deux
// barres). Avec peu de semaines, les emplacements ne s'élargissent pas
// au-delà du maximum : les barres restent regroupées au centre.
const LARGEUR_MAX_BARRE = 36;
const LARGEUR_MAX_EMPLACEMENT = 72;
const PART_BARRE = 0.62;

/**
 * Choisit le haut de l'axe vertical : un nombre rond juste au-dessus de la
 * semaine la plus chargée (5, 10, 15, 20...), pour des graduations lisibles.
 * Au minimum 5, pour qu'une semaine à 1 activité ne remplisse pas tout le
 * graphique.
 */
function hautDeLAxe(maximum: number): number {
  return Math.max(5, Math.ceil(maximum / 5) * 5);
}

export function ActiviteHebdomadaire({ semaines }: { semaines: SemaineActivite[] }) {
  const zone = useRef<HTMLDivElement>(null);
  const largeur = useLargeur(zone);
  const { conteneur, etat, montrerA, cacher } = useInfobulle();

  // Index de la semaine survolée ou choisie au clavier (null si aucune).
  const [active, setActive] = useState<number | null>(null);

  // Totaux de la période, pour le résumé écrit sous le graphique.
  const semainesActives = semaines.filter((s) => s.total > 0).length;
  const totalLecons = semaines.reduce((somme, s) => somme + s.lecons, 0);
  const totalQuiz = semaines.reduce((somme, s) => somme + s.quiz, 0);

  // Géométrie : chaque semaine a un emplacement de même largeur, et la
  // barre est centrée dans son emplacement.
  const largeurZone = Math.max(largeur - MARGES_ACTIVITE.gauche - MARGES_ACTIVITE.droite, 0);
  const hauteurZone = HAUTEUR_ACTIVITE - MARGES_ACTIVITE.haut - MARGES_ACTIVITE.bas;
  const emplacement = Math.min(largeurZone / semaines.length, LARGEUR_MAX_EMPLACEMENT);
  // Décalage qui centre le groupe de barres quand il ne remplit pas la largeur.
  const decalage = (largeurZone - emplacement * semaines.length) / 2;
  const largeurBarre = Math.min(emplacement * PART_BARRE, LARGEUR_MAX_BARRE);
  const maximum = hautDeLAxe(Math.max(...semaines.map((s) => s.total)));

  // Conversions : nombre d'activités vers hauteur, index vers centre de barre.
  const versY = (valeur: number) => MARGES_ACTIVITE.haut + hauteurZone - (valeur / maximum) * hauteurZone;
  const centre = (i: number) => MARGES_ACTIVITE.gauche + decalage + emplacement * (i + 0.5);

  // Dates sous l'axe : toutes s'il y a la place, sinon une sur deux, ou
  // une sur trois sur un écran étroit, pour qu'elles ne se chevauchent pas.
  const pasEtiquettes = emplacement >= 64 ? 1 : emplacement < 34 ? 3 : 2;

  // Texte de la bulle pour une semaine.
  function texteSemaine(s: SemaineActivite): string {
    if (s.total === 0) return "Aucune activité";
    const morceaux: string[] = [];
    if (s.lecons > 0) morceaux.push(compter(s.lecons, "leçon", "leçons"));
    if (s.quiz > 0) morceaux.push(compter(s.quiz, "quiz", "quiz"));
    return morceaux.join(", ");
  }

  function activer(i: number) {
    const s = semaines[i];
    setActive(i);
    montrerA(
      centre(i),
      // La bulle se place au-dessus de la barre, ou au-dessus de l'axe si
      // la semaine est vide.
      versY(s.total),
      <>
        <strong>{s.enCours ? "Cette semaine" : `Semaine du ${formaterJourCourt(s.lundi)}`}</strong>
        <span>{texteSemaine(s)}</span>
      </>,
    );
  }

  function desactiver() {
    setActive(null);
    cacher();
  }

  // Au survol, la semaine dont l'emplacement contient le pointeur devient
  // active : toute la hauteur de l'emplacement réagit, pas seulement la barre.
  function surDeplacement(evenement: PointerEvent<SVGSVGElement>) {
    const x = evenement.clientX - evenement.currentTarget.getBoundingClientRect().left;
    const index = Math.floor((x - MARGES_ACTIVITE.gauche - decalage) / emplacement);
    if (index >= 0 && index < semaines.length) activer(index);
  }

  // Flèches gauche et droite pour passer d'une semaine à l'autre au clavier.
  function surTouche(evenement: KeyboardEvent<SVGSVGElement>) {
    if (evenement.key !== "ArrowLeft" && evenement.key !== "ArrowRight") return;
    evenement.preventDefault();
    const depart = active ?? semaines.length - 1;
    const suivant = evenement.key === "ArrowLeft" ? depart - 1 : depart + 1;
    activer(Math.max(0, Math.min(semaines.length - 1, suivant)));
  }

  // Résumé complet, lu par les lecteurs d'écran.
  const description = `${compter(semainesActives, "semaine active", "semaines actives")}, ${compter(
    totalLecons,
    "leçon ouverte",
    "leçons ouvertes",
  )} et ${compter(totalQuiz, "quiz passé", "quiz passés")}. Flèches gauche et droite pour parcourir les semaines.`;

  return (
    <div className="tdb-activite">
      <div ref={conteneur} className="tdb-courbe">
        <div ref={zone}>
          {largeur > 0 && (
            <svg
              width={largeur}
              height={HAUTEUR_ACTIVITE}
              tabIndex={0}
              aria-label={description}
              onPointerMove={surDeplacement}
              onPointerDown={surDeplacement}
              onPointerLeave={desactiver}
              onFocus={() => activer(semaines.length - 1)}
              onBlur={desactiver}
              onKeyDown={surTouche}
            >
              {/* Graduations : zéro, le milieu et le haut de l'axe. */}
              {[0, maximum / 2, maximum].map((g) => (
                <g key={g}>
                  <line
                    className="tdb-quadrillage"
                    x1={MARGES_ACTIVITE.gauche}
                    x2={largeur - MARGES_ACTIVITE.droite}
                    y1={versY(g)}
                    y2={versY(g)}
                  />
                  <text
                    className="tdb-axe-texte"
                    x={MARGES_ACTIVITE.gauche - 8}
                    y={versY(g)}
                    textAnchor="end"
                    dominantBaseline="central"
                  >
                    {/* Le milieu peut tomber sur un nombre à virgule (2,5) : on ne l'écrit que s'il est entier. */}
                    {Number.isInteger(g) ? g : ""}
                  </text>
                </g>
              ))}

              {semaines.map((s, i) => {
                const x = centre(i) - largeurBarre / 2;
                const hauteur = versY(0) - versY(s.total);
                // Rayon des coins du haut, jamais plus grand que la barre elle-même.
                const rayon = Math.min(4, hauteur / 2, largeurBarre / 2);
                return (
                  <g key={s.lundi.toISOString()}>
                    {/* Fond léger de l'emplacement survolé, pour bien le repérer. */}
                    {i === active && (
                      <rect
                        className="tdb-emplacement-actif"
                        x={MARGES_ACTIVITE.gauche + decalage + emplacement * i}
                        y={MARGES_ACTIVITE.haut}
                        width={emplacement}
                        height={hauteurZone}
                        rx={6}
                      />
                    )}
                    {/* La barre : coins arrondis en haut, base droite posée sur
                        l'axe. Le chemin SVG la dessine en partant du bas gauche. */}
                    {s.total > 0 && (
                      <path
                        className={s.enCours ? "tdb-barre-semaine en-cours" : "tdb-barre-semaine"}
                        d={`M${x},${versY(0)}
                            V${versY(s.total) + rayon}
                            Q${x},${versY(s.total)} ${x + rayon},${versY(s.total)}
                            H${x + largeurBarre - rayon}
                            Q${x + largeurBarre},${versY(s.total)} ${x + largeurBarre},${versY(s.total) + rayon}
                            V${versY(0)} Z`}
                      />
                    )}
                    {/* Dates sous l'axe : une sur deux ou trois, en partant de
                        la semaine en cours pour qu'elle soit toujours nommée. */}
                    {(semaines.length - 1 - i) % pasEtiquettes === 0 && (
                      <text className="tdb-axe-texte" x={centre(i)} y={HAUTEUR_ACTIVITE - 6} textAnchor="middle">
                        {s.enCours ? "cette sem." : formaterJourCourt(s.lundi)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Ligne de base, par-dessus les barres. */}
              <line
                className="tdb-axe"
                x1={MARGES_ACTIVITE.gauche}
                x2={largeur - MARGES_ACTIVITE.droite}
                y1={versY(0)}
                y2={versY(0)}
              />
            </svg>
          )}
        </div>
        <Infobulle etat={etat} />
      </div>

      {/* Le résumé de la période, écrit en clair. */}
      <p className="tdb-note">
        {compter(semainesActives, "semaine active", "semaines actives")} · {compter(totalLecons, "leçon", "leçons")} ·{" "}
        {compter(totalQuiz, "quiz", "quiz")}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Courbe des scores
// ---------------------------------------------------------------------------

// Nombre de quiz affichés et hauteur totale du graphique, en pixels.
const POINTS_COURBE = 20;
const HAUTEUR_COURBE = 250;

// Marges autour de la zone de tracé : à gauche pour les pourcentages, en
// bas pour les dates, un peu en haut et à droite pour ne pas couper les points.
const MARGES = { haut: 14, droite: 14, bas: 28, gauche: 42 };

// Graduations de l'axe vertical.
const GRADUATIONS = [0, 50, 100];

interface ProprietesCourbe {
  quiz: HistoriqueQuizLigne[]; // tous les quiz, du plus ancien au plus récent
  titres: Map<string, string>;
}

export function CourbeScores({ quiz, titres }: ProprietesCourbe) {
  const derniers = quiz.slice(-POINTS_COURBE);

  // Une courbe a besoin d'au moins deux points.
  if (derniers.length < 2) {
    return <p className="tdb-note tdb-vide">Passe au moins deux quiz pour voir l'évolution de tes scores.</p>;
  }

  return <TraceCourbe derniers={derniers} titres={titres} />;
}

function TraceCourbe({ derniers, titres }: { derniers: HistoriqueQuizLigne[]; titres: Map<string, string> }) {
  const zone = useRef<HTMLDivElement>(null);
  const largeur = useLargeur(zone);
  const { conteneur, etat, montrerA, cacher } = useInfobulle();

  // Index du quiz survolé ou choisi au clavier (null si aucun).
  const [actif, setActif] = useState<number | null>(null);

  // Taille de la zone de tracé, sans les marges.
  const largeurTrace = Math.max(largeur - MARGES.gauche - MARGES.droite, 0);
  const hauteurTrace = HAUTEUR_COURBE - MARGES.haut - MARGES.bas;

  // Conversions : position dans la liste vers x, score vers y.
  const pas = largeurTrace / (derniers.length - 1);
  const versX = (i: number) => MARGES.gauche + i * pas;
  const versY = (score: number) => MARGES.haut + ((100 - score) / 100) * hauteurTrace;

  const points = derniers.map((q, i) => ({ x: versX(i), y: versY(pourcentageQuiz(q)), quiz: q }));

  // Ligne et surface sous la ligne. La surface reprend le tracé puis
  // redescend jusqu'à l'axe du bas pour se refermer.
  const trace = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const surface = `${trace} L${points[points.length - 1].x},${versY(0)} L${points[0].x},${versY(0)} Z`;

  function activer(i: number) {
    const p = points[i];
    setActif(i);
    montrerA(
      p.x,
      p.y,
      <>
        <strong>{titres.get(p.quiz.sujet_slug) ?? p.quiz.sujet_slug}</strong>
        <span>
          {p.quiz.score} / {p.quiz.total} ({pourcentageQuiz(p.quiz)} %), {formaterJourCourt(p.quiz.date)}
        </span>
      </>,
    );
  }

  function desactiver() {
    setActif(null);
    cacher();
  }

  // Le point le plus proche du pointeur, horizontalement, devient actif.
  function surDeplacement(evenement: PointerEvent<SVGSVGElement>) {
    const x = evenement.clientX - evenement.currentTarget.getBoundingClientRect().left;
    const index = Math.round((x - MARGES.gauche) / pas);
    activer(Math.max(0, Math.min(points.length - 1, index)));
  }

  // Flèches gauche et droite pour passer d'un quiz à l'autre au clavier.
  function surTouche(evenement: KeyboardEvent<SVGSVGElement>) {
    if (evenement.key !== "ArrowLeft" && evenement.key !== "ArrowRight") return;
    evenement.preventDefault();
    const depart = actif ?? points.length - 1;
    const suivant = evenement.key === "ArrowLeft" ? depart - 1 : depart + 1;
    activer(Math.max(0, Math.min(points.length - 1, suivant)));
  }

  const premier = derniers[0];
  const dernier = derniers[derniers.length - 1];

  return (
    <div ref={conteneur} className="tdb-courbe">
      <div ref={zone}>
        {largeur > 0 && (
          <svg
            width={largeur}
            height={HAUTEUR_COURBE}
            tabIndex={0}
            aria-label={`Évolution de tes ${derniers.length} derniers scores, du ${formaterJourCourt(
              premier.date,
            )} au ${formaterJourCourt(dernier.date)}. Dernier score : ${pourcentageQuiz(
              dernier,
            )} %. Flèches gauche et droite pour parcourir.`}
            onPointerMove={surDeplacement}
            onPointerDown={surDeplacement}
            onPointerLeave={desactiver}
            onFocus={() => activer(points.length - 1)}
            onBlur={desactiver}
            onKeyDown={surTouche}
          >
            {/* Lignes horizontales de repère et leurs pourcentages. */}
            {GRADUATIONS.map((g) => (
              <g key={g}>
                <line
                  className="tdb-quadrillage"
                  x1={MARGES.gauche}
                  x2={largeur - MARGES.droite}
                  y1={versY(g)}
                  y2={versY(g)}
                />
                <text
                  className="tdb-axe-texte"
                  x={MARGES.gauche - 8}
                  y={versY(g)}
                  textAnchor="end"
                  dominantBaseline="central"
                >
                  {g} %
                </text>
              </g>
            ))}

            {/* Seuil de réussite, en pointillé, sans texte : la jauge du
                score moyen indique déjà sa valeur. */}
            <line
              className="tdb-seuil"
              x1={MARGES.gauche}
              x2={largeur - MARGES.droite}
              y1={versY(SEUIL_REUSSITE)}
              y2={versY(SEUIL_REUSSITE)}
            />

            {/* Surface légèrement teintée sous la courbe, puis la courbe. */}
            <path className="tdb-surface" d={surface} />
            <path className="tdb-ligne" d={trace} />

            {/* Trait vertical sous le point actif, pour bien le repérer. */}
            {actif !== null && (
              <line className="tdb-repere" x1={points[actif].x} x2={points[actif].x} y1={MARGES.haut} y2={versY(0)} />
            )}

            {/* Un rond par quiz. Le rond actif est plus grand. */}
            {points.map((p, i) => (
              <circle key={i} className="tdb-point" cx={p.x} cy={p.y} r={i === actif ? 6 : 4} />
            ))}

            {/* Dates du premier et du dernier quiz, sous l'axe. */}
            <text className="tdb-axe-texte" x={points[0].x} y={HAUTEUR_COURBE - 6} textAnchor="start">
              {formaterJourCourt(premier.date)}
            </text>
            <text className="tdb-axe-texte" x={points[points.length - 1].x} y={HAUTEUR_COURBE - 6} textAnchor="end">
              {formaterJourCourt(dernier.date)}
            </text>
          </svg>
        )}
      </div>
      <Infobulle etat={etat} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barres par catégorie
// ---------------------------------------------------------------------------

// Pas de légende des couleurs : chaque barre porte déjà le nom de sa
// catégorie, et la couleur rappelle seulement celle de sa vignette dans
// "Mes cours". Pas de bulle non plus : tout le détail est écrit en clair.
export function BarresCategories({ categories }: { categories: Categorie[] }) {
  // Texte complet d'une catégorie, lu par les lecteurs d'écran.
  function detail(c: Categorie): string {
    return `${compter(c.vues, "leçon consultée", "leçons consultées")} sur ${c.sujets.length}, ${compter(
      c.reussies,
      "quiz réussi",
      "quiz réussis",
    )}`;
  }

  return (
    <ul className="tdb-barres-liste">
      {categories.map((c) => (
        <li key={c.slug}>
          {/* Toute la ligne est un lien vers la page de la catégorie. */}
          <Link
            to={`/cours/${c.slug}`}
            className={`tdb-barre serie-${familleCategorie(c.nom)}`}
            aria-label={`${c.nom} : ${detail(c)}`}
          >
            <span className="tdb-barre-nom">{c.nom}</span>
            <span className="tdb-barre-valeur">
              {c.vues} / {c.sujets.length}
            </span>
            <span className="tdb-barre-piste" aria-hidden="true">
              {c.vues > 0 && <span style={{ width: `${pourcentage(c.vues, c.sujets.length)}%` }} />}
            </span>
            {/* Sous la barre, ce que la longueur ne montre pas : combien de
                leçons de la catégorie ont leur quiz réussi. */}
            <span className="tdb-barre-note">{compter(c.reussies, "quiz réussi", "quiz réussis")}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
