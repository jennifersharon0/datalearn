// Fichier : src/pages/Dashboard.tsx


import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

// Icônes des états (erreur, page vide) et du lien "Tout voir".
import { BookOpen, ChevronRight, RotateCcw, TriangleAlert } from "lucide-react";

import { api, type ProgressionSujet, type Sujet, type TableauDeBord } from "../lib/apiClient";
import { regrouperParCategorie, trierParAvancement } from "../lib/categories";
import {
  compter,
  derniersJours,
  evolutionScoreMoyen,
  moyenneScores,
  quizReussi,
  semainesActivite,
  depuisPremiereActivite,
} from "../lib/statistiques";
import {
  AnneauProgression,
  JaugeScore,
  RangeeSemaine,
  RepartitionQuiz,
} from "../components/progression/MiniGraphiques";
import { ActiviteHebdomadaire, BarresCategories, CourbeScores } from "../components/progression/Graphiques";
import { LigneQuiz } from "../components/progression/LigneQuiz";
import { TexteEvolution, Tuile } from "../components/progression/Tuile";

import "./Dashboard.css";

// Nombre de catégories et de quiz affichés sur cette page. Les listes
// complètes sont sur leurs propres pages, pour garder celle-ci légère.
const TAILLE_APERCU = 3;

// ---------------------------------------------------------------------------
// Petits composants de mise en page
// ---------------------------------------------------------------------------

// Un bloc de graphique : une carte avec un titre, un sous-titre, et
// éventuellement un lien "Tout voir" en haut à droite.
interface ProprietesBloc {
  titre: string;
  sousTitre?: string;
  lien?: { vers: string; libelle: string };
  children: ReactNode;
}

function Bloc({ titre, sousTitre, lien, children }: ProprietesBloc) {
  return (
    <section className="carte tdb-bloc">
      <header className="tdb-bloc-entete">
        <div>
          <h2>{titre}</h2>
          {sousTitre && <p className="texte-secondaire">{sousTitre}</p>}
        </div>
        {lien && (
          <Link to={lien.vers} className="tdb-lien-tout">
            {lien.libelle}
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// La page
// ---------------------------------------------------------------------------

export function Dashboard() {
  // Les trois sources de données, null tant qu'elles ne sont pas arrivées.
  const [stats, setStats] = useState<TableauDeBord | null>(null);
  const [sujets, setSujets] = useState<Sujet[] | null>(null);
  const [progression, setProgression] = useState<ProgressionSujet[] | null>(null);

  // Message d'erreur, et compteur qui relance le chargement quand il change.
  const [erreur, setErreur] = useState<string | null>(null);
  const [tentative, setTentative] = useState(0);

  // Chargement des trois sources en même temps. Promise.all attend les
  // trois réponses ; si une seule échoue, on affiche l'erreur.
  // "actif" évite de modifier l'état si l'on a quitté la page entre-temps.
  useEffect(() => {
    let actif = true;
    setErreur(null);

    Promise.all([api.dashboard(), api.topics(), api.progression()])
      .then(([statistiques, listeSujets, listeProgression]) => {
        if (!actif) return;
        setStats(statistiques);
        setSujets(listeSujets);
        setProgression(listeProgression);
      })
      .catch((e: Error) => {
        if (actif) setErreur(e.message);
      });

    return () => {
      actif = false;
    };
  }, [tentative]);

  // Slug vers titre lisible, pour les bulles et la liste des quiz.
  const titres = useMemo(() => new Map((sujets ?? []).map((s) => [s.slug, s.titre])), [sujets]);

  // Toutes les valeurs calculées à partir des données, en une seule fois.
  // useMemo ne refait le calcul que si les données changent.
  const calculs = useMemo(() => {
    if (!stats || !sujets || !progression) return null;

    const historique = stats.historique_quiz;

    // Date de référence de tous les calculs, prise une seule fois, pour que
    // tous les graphiques parlent du même "aujourd'hui".
    const aujourdHui = new Date();

    return {
      semaine: derniersJours(stats.activite, 7, aujourdHui),
      // Les 12 dernières semaines, à partir d'une semaine avant la première activité.
      semaines: depuisPremiereActivite(semainesActivite(stats.activite, aujourdHui)),
      categories: trierParAvancement(regrouperParCategorie(sujets, progression)),
      scoreMoyen: moyenneScores(historique),
      evolution: evolutionScoreMoyen(historique, aujourdHui),
      quizReussis: historique.filter(quizReussi).length,
      // Copie inversée ([...] puis reverse) : du plus récent au plus ancien,
      // sans modifier la liste d'origine.
      quizRecents: [...historique].reverse().slice(0, TAILLE_APERCU),
    };
  }, [stats, sujets, progression]);

  // En-tête commun à tous les états de la page.
  const entete = (
    <header className="page-entete">
      <h1>Ma progression</h1>
      <p className="texte-secondaire">Ton rythme, tes scores et ton avancement dans le parcours.</p>
    </header>
  );

  // Erreur de chargement, avec un bouton pour réessayer.
  if (erreur) {
    return (
      <div className="page">
        {entete}
        <div className="etat-vide">
          <TriangleAlert size={32} aria-hidden="true" />
          <p>{erreur}</p>
          <button type="button" className="bouton bouton-secondaire" onClick={() => setTentative((n) => n + 1)}>
            <RotateCcw size={18} aria-hidden="true" />
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Chargement : des blocs gris à la place des indicateurs et des graphiques.
  if (!stats || !calculs) {
    return (
      <div className="page" aria-busy="true" aria-label="Chargement de la progression">
        {entete}
        <div className="tdb-indicateurs">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="tdb-tuile squelette" />
          ))}
        </div>
        <div className="tdb-grille">
          <div className="squelette tdb-squelette-bloc" />
          <div className="squelette tdb-squelette-bloc" />
        </div>
      </div>
    );
  }

  // Aucune activité : on invite à commencer plutôt que d'afficher des zéros.
  if (stats.sujets_completes === 0 && stats.historique_quiz.length === 0) {
    return (
      <div className="page">
        {entete}
        <div className="carte tdb-bienvenue">
          <span className="tdb-bienvenue-icone" aria-hidden="true">
            <BookOpen size={26} />
          </span>
          <h2>Ton parcours commence ici</h2>
          <p className="texte-secondaire">
            Ouvre ta première leçon et passe son quiz : ton activité et tes scores s'afficheront ici.
          </p>
          <Link to="/cours" className="bouton bouton-primaire">
            Voir les cours
          </Link>
        </div>
      </div>
    );
  }

  const nombreQuiz = stats.historique_quiz.length;

  return (
    <div className="page">
      {entete}

      {/* Les quatre indicateurs. */}
      <section className="tdb-indicateurs" aria-label="Indicateurs clés">
        <Tuile
          libelle="Série en cours"
          valeur={compter(stats.streak_jours, "jour", "jours")}
          complement={stats.streak_jours > 0 ? "d'affilée" : "Une leçon aujourd'hui pour la relancer"}
          visuel={<RangeeSemaine jours={calculs.semaine} />}
        />
        <Tuile
          libelle="Sujets consultés"
          valeur={stats.sujets_completes}
          complement={`sur ${stats.total_sujets} sujets`}
          visuel={<AnneauProgression valeur={stats.sujets_completes} total={stats.total_sujets} />}
          cote
        />
        <Tuile
          libelle="Quiz passés"
          valeur={nombreQuiz}
          visuel={<RepartitionQuiz reussis={calculs.quizReussis} aRevoir={nombreQuiz - calculs.quizReussis} />}
        />
        <Tuile
          libelle="Score moyen"
          valeur={calculs.scoreMoyen === null ? "-" : `${calculs.scoreMoyen} %`}
          complement={<TexteEvolution evolution={calculs.evolution} />}
          visuel={
            calculs.scoreMoyen === null ? (
              <p className="tdb-mini-note">Aucun quiz passé pour le moment.</p>
            ) : (
              <JaugeScore valeur={calculs.scoreMoyen} />
            )
          }
        />
      </section>

      {/* Les graphiques, sur deux colonnes en grand écran. */}
      <div className="tdb-grille">
        <Bloc titre="Activité" sousTitre="Leçons ouvertes et quiz passés, semaine par semaine">
          <ActiviteHebdomadaire semaines={calculs.semaines} />
        </Bloc>

        <Bloc titre="Évolution des scores" sousTitre="Tes derniers quiz, du plus ancien au plus récent">
          <CourbeScores quiz={stats.historique_quiz} titres={titres} />
        </Bloc>

        <Bloc
          titre="Par catégorie"
          sousTitre="Tes trois catégories les plus avancées"
          lien={{ vers: "/cours", libelle: "Toutes les catégories" }}
        >
          <BarresCategories categories={calculs.categories.slice(0, TAILLE_APERCU)} />
        </Bloc>

        <Bloc
          titre="Derniers quiz"
          sousTitre={compter(nombreQuiz, "quiz passé", "quiz passés") + " au total"}
          lien={
            nombreQuiz > TAILLE_APERCU ? { vers: "/tableau-de-bord/quiz", libelle: "Tout l'historique" } : undefined
          }
        >
          {calculs.quizRecents.length === 0 ? (
            <p className="tdb-note">Aucun quiz passé pour le moment.</p>
          ) : (
            <ul className="tdb-historique">
              {calculs.quizRecents.map((quiz, i) => (
                <LigneQuiz key={`${quiz.date}-${i}`} quiz={quiz} titre={titres.get(quiz.sujet_slug)} />
              ))}
            </ul>
          )}
        </Bloc>
      </div>
    </div>
  );
}
