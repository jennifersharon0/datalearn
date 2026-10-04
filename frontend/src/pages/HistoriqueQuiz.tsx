// Fichier : src/pages/HistoriqueQuiz.tsx
//
// La page "Historique des quiz", ouverte depuis le lien "Tout l'historique"
// de "Ma progression". Elle montre tous les quiz passés, du plus récent au
// plus ancien, regroupés par mois.
//
// Trois filtres en haut permettent de n'afficher que les quiz réussis, ou
// seulement ceux à revoir : c'est la liste utile pour savoir quelles leçons
// relire. Chaque ligne mène à la leçon correspondante.
//
// Les lignes sont dessinées par LigneQuiz, le même composant que sur
// "Ma progression", et gardent donc exactement le même aspect.

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ArrowLeft, RotateCcw, TriangleAlert } from "lucide-react";

import { api, type HistoriqueQuizLigne, type Sujet } from "../lib/apiClient";
import { compter, evolutionScoreMoyen, moyenneScores, quizReussi } from "../lib/statistiques";
import { LigneQuiz } from "../components/progression/LigneQuiz";
import { JaugeScore, RepartitionQuiz } from "../components/progression/MiniGraphiques";
import { TexteEvolution, Tuile } from "../components/progression/Tuile";

// Les styles des lignes (tdb-historique, tdb-score) sont partagés avec
// "Ma progression" ; ceux propres à cette page sont dans HistoriqueQuiz.css.
import "./Dashboard.css";
import "./HistoriqueQuiz.css";

// Les trois filtres possibles.
type Filtre = "tous" | "reussis" | "a-revoir";

// Un groupe de quiz passés le même mois.
interface GroupeMois {
  cle: string; // "2026-09", sert d'identifiant unique
  nom: string; // "Septembre 2026"
  quiz: HistoriqueQuizLigne[];
}

/**
 * Lit le filtre écrit dans l'adresse. Toute valeur inconnue (adresse
 * modifiée à la main, ancien lien...) revient au filtre "tous".
 */
function lireFiltre(valeur: string | null): Filtre {
  return valeur === "reussis" || valeur === "a-revoir" ? valeur : "tous";
}

/**
 * Regroupe une liste de quiz (déjà triée du plus récent au plus ancien)
 * par mois. Comme la liste est triée, les quiz d'un même mois se suivent :
 * il suffit d'ouvrir un nouveau groupe chaque fois que le mois change.
 */
function regrouperParMois(quiz: HistoriqueQuizLigne[]): GroupeMois[] {
  const groupes: GroupeMois[] = [];

  for (const q of quiz) {
    const date = new Date(q.date);
    const cle = `${date.getFullYear()}-${date.getMonth()}`;
    const dernier = groupes[groupes.length - 1];

    if (dernier && dernier.cle === cle) {
      dernier.quiz.push(q);
    } else {
      // toLocaleDateString écrit le mois en minuscule ("septembre 2026") :
      // on met la première lettre en majuscule pour en faire un titre.
      const nom = date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      groupes.push({ cle, nom: nom.charAt(0).toUpperCase() + nom.slice(1), quiz: [q] });
    }
  }

  return groupes;
}

export function HistoriqueQuiz() {
  // Historique complet et liste des sujets (pour les titres lisibles).
  const [historique, setHistorique] = useState<HistoriqueQuizLigne[] | null>(null);
  const [sujets, setSujets] = useState<Sujet[] | null>(null);

  const [erreur, setErreur] = useState<string | null>(null);
  const [tentative, setTentative] = useState(0);

  // Le filtre est rangé dans l'adresse (par exemple ?filtre=a-revoir).
  // Le lien "à revoir" de "Ma progression" ouvre ainsi la page déjà filtrée,
  // et le bouton Retour du navigateur retrouve le filtre choisi.
  const [parametres, setParametres] = useSearchParams();
  const filtre = lireFiltre(parametres.get("filtre"));

  // Change le filtre dans l'adresse. "replace" évite d'ajouter une entrée
  // dans l'historique du navigateur à chaque clic sur un filtre.
  function setFiltre(nouveau: Filtre) {
    setParametres(nouveau === "tous" ? {} : { filtre: nouveau }, { replace: true });
  }

  // L'historique arrive avec les statistiques du tableau de bord.
  // "actif" évite de modifier l'état si l'on a quitté la page entre-temps.
  useEffect(() => {
    let actif = true;
    setErreur(null);

    Promise.all([api.dashboard(), api.topics()])
      .then(([statistiques, listeSujets]) => {
        if (!actif) return;
        // Copie inversée : du plus récent au plus ancien.
        setHistorique([...statistiques.historique_quiz].reverse());
        setSujets(listeSujets);
      })
      .catch((e: Error) => {
        if (actif) setErreur(e.message);
      });

    return () => {
      actif = false;
    };
  }, [tentative]);

  // Slug vers titre lisible.
  const titres = useMemo(() => new Map((sujets ?? []).map((s) => [s.slug, s.titre])), [sujets]);

  // Nombre de quiz dans chaque filtre, affiché sur les boutons.
  const nombreReussis = useMemo(() => (historique ?? []).filter(quizReussi).length, [historique]);
  const nombreTotal = historique?.length ?? 0;

  // Score moyen et son évolution sur 7 jours, pour la tuile du haut.
  // L'historique est ici du plus récent au plus ancien, mais ces deux
  // calculs ne dépendent pas de l'ordre.
  const scoreMoyen = useMemo(() => moyenneScores(historique ?? []), [historique]);
  const evolution = useMemo(() => evolutionScoreMoyen(historique ?? [], new Date()), [historique]);

  // Les quiz du filtre choisi, regroupés par mois.
  const groupes = useMemo(() => {
    const liste = (historique ?? []).filter((q) => {
      if (filtre === "reussis") return quizReussi(q);
      if (filtre === "a-revoir") return !quizReussi(q);
      return true;
    });
    return regrouperParMois(liste);
  }, [historique, filtre]);

  // Description des trois filtres, pour les afficher avec .map().
  const filtres: { valeur: Filtre; libelle: string; nombre: number }[] = [
    { valeur: "tous", libelle: "Tous", nombre: nombreTotal },
    { valeur: "reussis", libelle: "Réussis", nombre: nombreReussis },
    { valeur: "a-revoir", libelle: "À revoir", nombre: nombreTotal - nombreReussis },
  ];

  // En-tête commun à tous les états de la page.
  const entete = (
    <header className="page-entete">
      <Link to="/tableau-de-bord" className="lien-retour">
        <ArrowLeft size={18} aria-hidden="true" />
        Ma progression
      </Link>
      <h1>Historique des quiz</h1>
    </header>
  );

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

  if (!historique || !sujets) {
    return (
      <div className="page" aria-busy="true" aria-label="Chargement de l'historique">
        {entete}
        <div className="squelette tdb-squelette-bloc" />
      </div>
    );
  }

  // Aucun quiz encore : on renvoie vers les cours.
  if (nombreTotal === 0) {
    return (
      <div className="page">
        {entete}
        <div className="carte tdb-bienvenue">
          <h2>Aucun quiz pour le moment</h2>
          <p className="texte-secondaire">Chaque leçon se termine par un quiz : il apparaîtra ici une fois passé.</p>
          <Link to="/cours" className="bouton bouton-primaire">
            Voir les cours
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {entete}

      {/* Les deux mêmes indicateurs que sur "Ma progression" : le nombre
          de quiz avec leur répartition, et le score moyen. */}
      <section className="hq-indicateurs" aria-label="Résumé des quiz">
        <Tuile
          libelle="Quiz passés"
          valeur={nombreTotal}
          visuel={<RepartitionQuiz reussis={nombreReussis} aRevoir={nombreTotal - nombreReussis} />}
        />
        <Tuile
          libelle="Score moyen"
          valeur={scoreMoyen === null ? "-" : `${scoreMoyen} %`}
          complement={<TexteEvolution evolution={evolution} />}
          visuel={scoreMoyen === null ? null : <JaugeScore valeur={scoreMoyen} />}
        />
      </section>

      {/* Filtres. aria-pressed indique aux lecteurs d'écran quel bouton
          est actuellement enfoncé. */}
      <div className="hq-filtres" role="group" aria-label="Filtrer les quiz">
        {filtres.map(({ valeur, libelle, nombre }) => (
          <button
            key={valeur}
            type="button"
            className={filtre === valeur ? "hq-filtre actif" : "hq-filtre"}
            aria-pressed={filtre === valeur}
            onClick={() => setFiltre(valeur)}
          >
            {libelle}
            <span className="hq-filtre-nombre">{nombre}</span>
          </button>
        ))}
      </div>

      {/* La liste, mois par mois. aria-live annonce le changement de
          contenu quand on change de filtre. */}
      <section className="carte hq-liste" aria-live="polite">
        {groupes.length === 0 ? (
          <p className="tdb-note tdb-vide">
            {filtre === "a-revoir" ? "Aucun quiz à revoir : tout est réussi." : "Aucun quiz réussi pour le moment."}
          </p>
        ) : (
          groupes.map((groupe) => (
            <div key={groupe.cle} className="hq-mois">
              <h2 className="hq-mois-titre">
                {groupe.nom}
                <span>{compter(groupe.quiz.length, "quiz", "quiz")}</span>
              </h2>
              <ul className="tdb-historique">
                {groupe.quiz.map((quiz, i) => (
                  <LigneQuiz key={`${quiz.date}-${i}`} quiz={quiz} titre={titres.get(quiz.sujet_slug)} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
