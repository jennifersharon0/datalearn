// Fichier : src/pages/Accueil.tsx
//
// Page d'accueil après connexion. C'est le premier écran que voit
// l'utilisateur : il doit lui donner envie de continuer.


import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

// Icônes de la page.
import { ArrowRight, BookOpen, ChevronRight, Flame, Library, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";

// Appels au backend et types (fichier apiClient.ts).
import { api, type ProgressionSujet, type Sujet, type TableauDeBord } from "../lib/apiClient";

// Utilisateur connecté et son prénom.
import { useAuth } from "../contexts/AuthContext";
import { prenomUtilisateur } from "../lib/utilisateur";

// Choix de la notion du jour (fichier notionDeJour.ts).
import { notionDuJour } from "../lib/notionDeJour";

// Catégories triées par avancement, et calculs sur l'activité de la semaine.
import { regrouperParCategorie, trierParAvancement } from "../lib/categories";
import { derniersJours } from "../lib/statistiques";

// Les mêmes visuels que sur "Ma progression" : les barres de catégorie et
// la rangée des 7 derniers jours. Leurs styles sont dans Dashboard.css.
import { BarresCategories } from "../components/progression/Graphiques";
import { RangeeSemaine } from "../components/progression/MiniGraphiques";
import "./Dashboard.css";

// Styles propres à cette page.
import "./Accueil.css";

// Illustration du bandeau : un petit réseau de points reliés, qui évoque les
// données et les modèles sans être une image de banque d'images. Elle est
// dessinée en SVG : nette sur tous les écrans et très légère.
// Chaque point est décrit par ses coordonnées (x, y), sa taille et sa couleur.
const POINTS = [
  { x: 40, y: 150, r: 5, rouge: false },
  { x: 90, y: 60, r: 7, rouge: true },
  { x: 120, y: 130, r: 4, rouge: false },
  { x: 170, y: 40, r: 5, rouge: false },
  { x: 190, y: 110, r: 9, rouge: true },
  { x: 240, y: 165, r: 5, rouge: false },
  { x: 250, y: 70, r: 6, rouge: false },
  { x: 300, y: 115, r: 7, rouge: true },
  { x: 310, y: 30, r: 4, rouge: false },
];

// Liaisons entre les points, par leur position dans la liste ci-dessus.
const LIAISONS = [
  [0, 1],
  [0, 2],
  [1, 2],
  [1, 3],
  [2, 4],
  [3, 4],
  [3, 6],
  [4, 5],
  [4, 6],
  [4, 7],
  [5, 7],
  [6, 7],
  [6, 8],
  [7, 8],
];

function IllustrationReseau() {
  return (
    <svg className="bandeau-illustration" viewBox="0 0 340 200" aria-hidden="true">
      {/* Les liaisons d'abord, pour qu'elles passent sous les points. */}
      {LIAISONS.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={POINTS[a].x}
          y1={POINTS[a].y}
          x2={POINTS[b].x}
          y2={POINTS[b].y}
          className="reseau-liaison"
        />
      ))}
      {/* Les points, rouges ou gris. */}
      {POINTS.map((point, i) => (
        <circle
          key={i}
          cx={point.x}
          cy={point.y}
          r={point.r}
          className={point.rouge ? "reseau-point rouge" : "reseau-point"}
        />
      ))}
    </svg>
  );
}

export function Accueil() {
  const { utilisateur } = useAuth();
  const prenom = prenomUtilisateur(utilisateur);

  // Données chargées depuis le backend (null tant qu'elles ne sont pas arrivées).
  const [sujets, setSujets] = useState<Sujet[] | null>(null);
  const [progression, setProgression] = useState<ProgressionSujet[] | null>(null);
  const [stats, setStats] = useState<TableauDeBord | null>(null);

  // Message d'erreur et compteur pour relancer le chargement.
  const [erreur, setErreur] = useState<string | null>(null);
  const [tentative, setTentative] = useState(0);

  // Chargement des trois sources en même temps.
  useEffect(() => {
    let actif = true;
    setErreur(null);

    Promise.all([api.topics(), api.progression(), api.dashboard()])
      .then(([listeSujets, listeProgression, statistiques]) => {
        if (!actif) return;
        setSujets(listeSujets);
        setProgression(listeProgression);
        setStats(statistiques);
      })
      .catch((e: Error) => {
        if (actif) setErreur(e.message);
      });

    return () => {
      actif = false;
    };
  }, [tentative]);

  // Correspondance slug vers sujet, pour retrouver un titre à partir d'un slug.
  const sujetParSlug = useMemo(() => new Map((sujets ?? []).map((s) => [s.slug, s])), [sujets]);

  // Dernière leçon ouverte : l'entrée de progression avec la date la plus récente.
  // Les dates ISO se comparent directement comme du texte ("2026-10-01..." est
  // après "2026-09-30..."), ce qui évite de les convertir.
  const derniere = useMemo(() => {
    if (!progression) return null;
    const lues = progression.filter((p) => p.lue && sujetParSlug.has(p.sujet_slug));
    if (lues.length === 0) return null;
    return lues.reduce((plusRecente, p) => (p.derniere_activite > plusRecente.derniere_activite ? p : plusRecente));
  }, [progression, sujetParSlug]);

  // Notion du jour, calculée à partir des sujets et de la progression.
  const notion = useMemo(() => {
    if (!sujets || !progression || !utilisateur) return null;
    return notionDuJour(sujets, progression, utilisateur.id);
  }, [sujets, progression, utilisateur]);

  // Les trois catégories les plus avancées. Pour quelqu'un qui débute, aucune
  // n'est commencée : le tri garde alors l'ordre du parcours, et on montre
  // simplement les trois premières.
  const categories = useMemo(() => {
    if (!sujets || !progression) return [];
    return trierParAvancement(regrouperParCategorie(sujets, progression)).slice(0, 3);
  }, [sujets, progression]);
  const categoriesCommencees = categories.some((c) => c.vues > 0);

  // Les 7 derniers jours, et les totaux de la semaine.
  const semaine = useMemo(() => (stats ? derniersJours(stats.activite, 7, new Date()) : []), [stats]);
  const joursActifs = semaine.filter((j) => j.total > 0).length;
  const leconsSemaine = semaine.reduce((somme, j) => somme + j.lecons, 0);
  const quizSemaine = semaine.reduce((somme, j) => somme + j.quiz, 0);

  // Date du jour en toutes lettres, par exemple "jeudi 1 octobre".
  const dateTexte = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const chargement = !erreur && (!sujets || !progression || !stats);

  // Nombre de catégories, pour la carte "Mes cours".
  const nombreCategories = sujets ? new Set(sujets.map((s) => s.categorie)).size : 0;

  return (
    <div className="page accueil">
      {/* Bandeau d'accueil. */}
      <section className="bandeau">
        <div className="bandeau-texte">
          <p className="bandeau-date">{dateTexte}</p>
          <h1>{prenom ? `Bonjour ${prenom}` : "Bonjour"}</h1>
          <p className="bandeau-sous-titre">
            {derniere ? "On continue sur ta lancée ?" : "Une première notion t'attend aujourd'hui."}
          </p>

          {/* Deux chiffres clés, affichés dès que les statistiques sont là. */}
          {stats && (
            <div className="bandeau-chiffres">
              <div className="bandeau-chiffre">
                <Flame size={18} aria-hidden="true" />
                <strong>{stats.streak_jours}</strong>
                <span>{stats.streak_jours > 1 ? "jours d'affilée" : "jour d'affilée"}</span>
              </div>
              <div className="bandeau-chiffre">
                <BookOpen size={18} aria-hidden="true" />
                <strong>
                  {stats.sujets_completes} / {stats.total_sujets}
                </strong>
                {/* "consultés" est masqué sur téléphone par le CSS, pour que
                    les deux pastilles tiennent sur une seule ligne. */}
                <span>
                  sujets<span className="texte-long"> consultés</span>
                </span>
              </div>
            </div>
          )}
        </div>

        <IllustrationReseau />
      </section>

      {/* Erreur de chargement. */}
      {erreur && (
        <div className="etat-vide">
          <TriangleAlert size={32} aria-hidden="true" />
          <p>{erreur}</p>
          <button type="button" className="bouton bouton-secondaire" onClick={() => setTentative((n) => n + 1)}>
            <RotateCcw size={18} aria-hidden="true" />
            Réessayer
          </button>
        </div>
      )}

      {/* Chargement : trois cartes grises. */}
      {chargement && (
        <div className="grille-accueil" aria-busy="true" aria-label="Chargement">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="carte-accueil squelette" />
          ))}
        </div>
      )}

      {/* Les trois cartes, une fois les données chargées. */}
      {!chargement && !erreur && sujets && (
        <div className="grille-accueil">
          {/* Carte 1 : reprendre la dernière leçon, ou commencer par la première. */}
          <article className="carte-accueil">
            <span className="carte-accueil-etiquette">
              <RotateCcw size={16} aria-hidden="true" />
              {derniere ? "Reprendre" : "Commencer"}
            </span>
            {derniere ? (
              <>
                <h2>{sujetParSlug.get(derniere.sujet_slug)?.titre}</h2>
                <p className="texte-secondaire">
                  {derniere.meilleur_pourcentage === null
                    ? "Quiz pas encore passé"
                    : `Meilleur score : ${derniere.meilleur_pourcentage} %`}
                </p>
                <Link to={`/lecons/${derniere.sujet_slug}`} className="bouton bouton-primaire">
                  Continuer
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </>
            ) : (
              <>
                <h2>{sujets[0]?.titre}</h2>
                <p className="texte-secondaire">La toute première leçon du parcours.</p>
                <Link to={`/lecons/${sujets[0]?.slug}`} className="bouton bouton-primaire">
                  Commencer
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </>
            )}
          </article>

          {/* Carte 2 : la notion du jour. */}
          <article className="carte-accueil">
            <span className="carte-accueil-etiquette">
              <Sparkles size={16} aria-hidden="true" />
              Notion du jour
            </span>
            {notion ? (
              <>
                <h2>{notion.titre}</h2>
                <p className="texte-secondaire">{notion.categorie}</p>
                <Link to={`/lecons/${notion.slug}`} className="bouton bouton-secondaire">
                  Découvrir
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </>
            ) : (
              <>
                <h2>Tu as tout exploré</h2>
                <p className="texte-secondaire">Tu as ouvert toutes les leçons du parcours.</p>
              </>
            )}
          </article>

          {/* Carte 3 : accès à tous les cours. Masquée sur téléphone par le
              CSS : le lien "Toutes les catégories" du bloc du dessous et le
              menu y mènent déjà, et la page reste plus courte. */}
          <article className="carte-accueil carte-accueil-cours">
            <span className="carte-accueil-etiquette">
              <Library size={16} aria-hidden="true" />
              Mes cours
            </span>
            <h2>Tout le parcours</h2>
            <p className="texte-secondaire">
              {sujets.length} leçons réparties en {nombreCategories} catégories.
            </p>
            <Link to="/cours" className="bouton bouton-secondaire">
              Voir les cours
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </article>
        </div>
      )}

      {/* Sous les cartes : les catégories en cours et la semaine. */}
      {!chargement && !erreur && sujets && stats && (
        <div className="accueil-suite">
          <section className="carte accueil-bloc">
            <header className="accueil-bloc-entete">
              <h2>{categoriesCommencees ? "Tes catégories en cours" : "Pour bien commencer"}</h2>
              {/* Texte long sur grand écran, "Tout voir" sur téléphone (le CSS
                  choisit lequel afficher). aria-label donne toujours le nom
                  complet aux lecteurs d'écran. */}
              <Link to="/cours" className="tdb-lien-tout" aria-label="Toutes les catégories">
                <span className="texte-long">Toutes les catégories</span>
                <span className="texte-court">Tout voir</span>
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </header>
            <BarresCategories categories={categories} />
          </section>

          <section className="carte accueil-bloc accueil-bloc-semaine">
            <header className="accueil-bloc-entete">
              <h2>Ta semaine</h2>
              <Link to="/tableau-de-bord" className="tdb-lien-tout">
                Ma progression
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </header>
            {/* La rangée et les chiffres sont regroupés : sur ordinateur, ce
                groupe est centré dans la hauteur du bloc (voir Accueil.css). */}
            <div className="accueil-semaine-contenu">
              <RangeeSemaine jours={semaine} />
              {/* Les totaux de la semaine : trois chiffres côte à côte, sous
                les cases, dans une liste de définitions (dl). Chaque <dt>
                est l'intitulé, chaque <dd> sa valeur. */}
              <dl className="accueil-semaine-chiffres">
                <div>
                  <dt>{joursActifs > 1 ? "jours actifs" : "jour actif"}</dt>
                  <dd>
                    {joursActifs}
                    <span>/7</span>
                  </dd>
                </div>
                <div>
                  <dt>{leconsSemaine > 1 ? "leçons" : "leçon"}</dt>
                  <dd>{leconsSemaine}</dd>
                </div>
                <div>
                  <dt>quiz</dt>
                  <dd>{quizSemaine}</dd>
                </div>
              </dl>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
