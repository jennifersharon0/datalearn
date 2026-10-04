// Fichier : src/components/lecon/Quiz.tsx
//
// Le quiz de la page de leçon. Il affiche une question à la fois, avec une
// barre de progression, et permet d'aller et venir entre les questions avant
// de valider. Après validation, il affiche le score et le corrigé complet.
//
// Les bonnes réponses ne sont jamais envoyées au navigateur avant la
// validation : le backend les retire du quiz, et la
// correction est faite par le serveur. Ouvrir les outils de développement
// du navigateur ne permet donc pas de tricher.

import { useEffect, useState } from "react";

// Icônes du quiz.
import { Check, ChevronLeft, ChevronRight, RotateCcw, TriangleAlert, Trophy, X } from "lucide-react";

// Fonctions d'appel au backend et types du quiz (fichier 2).
import { api, type Quiz as DonneesQuiz, type ResultatQuiz } from "../../lib/apiClient";

// Seuil de réussite commun à toute l'application (fichier categories.ts).
import { SEUIL_REUSSITE } from "../../lib/categories";

// Le composant reçoit uniquement l'identifiant du sujet.
interface Proprietes {
  slug: string;
}

// Lettres affichées devant les options (A, B, C, D...).
const LETTRES = ["A", "B", "C", "D", "E", "F"];

// Message d'encouragement selon le pourcentage de bonnes réponses.
// Le deuxième palier suit le seuil de réussite : un quiz "à revoir" dans le tableau de bord ne reçoit donc jamais de "Bien joué".

function messageSelonScore(pourcentage: number): string {
  if (pourcentage >= 90) return "Excellent travail, tu maîtrises ce sujet.";
  if (pourcentage >= SEUIL_REUSSITE) return "Bien joué. Relis les points manqués pour consolider.";
  return "Relis la leçon tranquillement, puis retente ta chance.";
}

export function Quiz({ slug }: Proprietes) {
  // Questions du quiz (null tant qu'elles ne sont pas chargées).
  const [quiz, setQuiz] = useState<DonneesQuiz | null>(null);

  // Message d'erreur de chargement ou de correction.
  const [erreur, setErreur] = useState<string | null>(null);

  // Position de la question affichée (0 pour la première).
  const [indexCourant, setIndexCourant] = useState(0);

  // Réponses choisies : pour chaque numéro de question, la position de
  // l'option choisie. Une question sans réponse n'a pas d'entrée.
  const [reponses, setReponses] = useState<Record<number, number>>({});

  // Résultat renvoyé par le backend après validation (null avant).
  const [resultat, setResultat] = useState<ResultatQuiz | null>(null);

  // Vrai pendant l'envoi des réponses.
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  // Chargement du quiz quand le composant apparaît.
  useEffect(() => {
    let actif = true;

    api
      .quiz(slug)
      .then((donnees) => {
        if (actif) setQuiz(donnees);
      })
      .catch((e: Error) => {
        if (actif) setErreur(e.message);
      });

    return () => {
      actif = false;
    };
  }, [slug]);

  // Chargement en cours.
  if (!quiz && !erreur) {
    return <div className="squelette squelette-bloc" aria-busy="true" aria-label="Chargement du quiz" />;
  }

  // Le chargement a échoué.
  if (!quiz) {
    return (
      <div className="etat-vide">
        <TriangleAlert size={32} aria-hidden="true" />
        <p>{erreur}</p>
      </div>
    );
  }

  // Le sujet n'a pas encore de quiz (génération ratée ou pas encore faite).
  if (quiz.questions.length === 0) {
    return (
      <div className="etat-vide">
        <p>Le quiz de ce sujet n'est pas encore disponible.</p>
      </div>
    );
  }

  // Quelques valeurs utiles pour l'affichage.
  const total = quiz.questions.length;
  const nombreRepondues = Object.keys(reponses).length;
  const toutRepondu = nombreRepondues === total;

  // Enregistre le choix d'une option pour la question affichée.
  function choisir(positionOption: number) {
    setReponses((precedentes) => ({ ...precedentes, [indexCourant]: positionOption }));
  }

  // Envoie toutes les réponses au backend pour correction.
  async function valider() {
    if (!quiz) return;
    setEnvoiEnCours(true);
    setErreur(null);

    // Tableau dans l'ordre des questions. -1 pour une question sans réponse
    // (le bouton Valider n'est actif que si tout est répondu, c'est une sécurité).
    const liste = quiz.questions.map((_, i) => reponses[i] ?? -1);

    try {
      setResultat(await api.soumettreQuiz(slug, liste));
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  // Remet le quiz à zéro pour une nouvelle tentative.
  function recommencer() {
    setResultat(null);
    setReponses({});
    setIndexCourant(0);
  }

  // ---------------------------------------------------------------------
  // Affichage après validation : score puis corrigé
  // ---------------------------------------------------------------------
  if (resultat) {
    const pourcentage = Math.round((resultat.score / resultat.total) * 100);

    // Paramètres du cercle de progression, dessiné en SVG.
    // La circonférence d'un cercle vaut 2 x pi x rayon. On dessine un trait
    // de cette longueur, puis on en masque une partie avec strokeDashoffset
    // pour ne montrer que le pourcentage obtenu.
    const rayon = 52;
    const circonference = 2 * Math.PI * rayon;
    const decalage = circonference * (1 - pourcentage / 100);

    return (
      <div className="quiz-resultat">
        <div className="carte score-carte">
          <div className="score-cercle">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle className="score-cercle-fond" cx="60" cy="60" r={rayon} />
              <circle
                className="score-cercle-valeur"
                cx="60"
                cy="60"
                r={rayon}
                strokeDasharray={circonference}
                strokeDashoffset={decalage}
              />
            </svg>
            <div className="score-cercle-texte">
              <strong>{pourcentage}%</strong>
              <span>
                {resultat.score} / {resultat.total}
              </span>
            </div>
          </div>
          <div className="score-message">
            <Trophy size={20} aria-hidden="true" />
            <p>{messageSelonScore(pourcentage)}</p>
          </div>
          <button type="button" className="bouton bouton-secondaire" onClick={recommencer}>
            <RotateCcw size={18} aria-hidden="true" />
            Refaire le quiz
          </button>
        </div>

        <h3 className="titre-corrige">Corrigé</h3>

        {/* Une carte par question, avec la bonne réponse et la tienne. */}
        <ol className="liste-corrige">
          {resultat.corrections.map((correction, i) => (
            <li key={i} className={correction.correct ? "corrige-item juste" : "corrige-item faux"}>
              <div className="corrige-entete">
                <span className="corrige-pastille" aria-hidden="true">
                  {correction.correct ? <Check size={16} /> : <X size={16} />}
                </span>
                <p className="corrige-question">
                  {i + 1}. {correction.question}
                </p>
              </div>
              <ul className="corrige-options">
                {correction.options.map((option, position) => {
                  // Le backend numérote les options à partir de 1 : on retire 1
                  // pour comparer avec "position", qui commence à 0.
                  const estBonne = position === correction.bonne_reponse - 1;
                  const estLaTienne =
                    correction.ta_reponse !== null && position === correction.ta_reponse - 1;

                  let classe = "corrige-option";
                  if (estBonne) classe += " bonne";
                  else if (estLaTienne) classe += " mauvaise";

                  return (
                    <li key={position} className={classe}>
                      <span className="option-lettre">{LETTRES[position]}</span>
                      <span>{option}</span>
                      {estBonne && <span className="etiquette">Bonne réponse</span>}
                      {estLaTienne && !estBonne && <span className="etiquette">Ta réponse</span>}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Affichage pendant le quiz : une question à la fois
  // ---------------------------------------------------------------------
  const question = quiz.questions[indexCourant];
  const estDerniere = indexCourant === total - 1;

  return (
    <div className="quiz">
      {/* Progression : texte et barre. */}
      <div className="quiz-progression">
        <span>
          Question {indexCourant + 1} sur {total}
        </span>
        <span className="texte-secondaire">
          {nombreRepondues} / {total} répondues
        </span>
      </div>
      <div
        className="barre-progression"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={indexCourant + 1}
        aria-label="Progression dans le quiz"
      >
        <div style={{ width: `${((indexCourant + 1) / total) * 100}%` }} />
      </div>

      {/* Pastilles numérotées pour aller directement à une question. */}
      <div className="quiz-pastilles">
        {quiz.questions.map((_, i) => {
          let classe = "quiz-pastille";
          if (i === indexCourant) classe += " courante";
          else if (reponses[i] !== undefined) classe += " repondue";
          return (
            <button
              key={i}
              type="button"
              className={classe}
              onClick={() => setIndexCourant(i)}
              aria-label={`Aller à la question ${i + 1}`}
              aria-current={i === indexCourant ? "step" : undefined}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* La question et ses options. role="radiogroup" et role="radio"
          indiquent aux lecteurs d'écran qu'une seule option peut être choisie. */}
      <div className="carte question-carte">
        <h3 className="question-enonce" id="enonce-question">
          {question.question}
        </h3>
        <div className="options" role="radiogroup" aria-labelledby="enonce-question">
          {question.options.map((option, position) => {
            const choisie = reponses[indexCourant] === position;
            return (
              <button
                key={position}
                type="button"
                role="radio"
                aria-checked={choisie}
                className={choisie ? "option choisie" : "option"}
                onClick={() => choisir(position)}
              >
                <span className="option-lettre">{LETTRES[position]}</span>
                <span>{option}</span>
              </button>
            );
          })}
        </div>
      </div>

      {erreur && (
        <p className="alerte alerte-erreur" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          {erreur}
        </p>
      )}

      {/* Boutons de navigation. */}
      <div className="quiz-navigation">
        <button
          type="button"
          className="bouton bouton-fantome"
          onClick={() => setIndexCourant((i) => i - 1)}
          disabled={indexCourant === 0}
        >
          <ChevronLeft size={18} aria-hidden="true" />
          Précédente
        </button>

        {estDerniere ? (
          <button
            type="button"
            className="bouton bouton-primaire"
            onClick={valider}
            disabled={!toutRepondu || envoiEnCours}
            // Explique pourquoi le bouton est grisé, au survol.
            title={toutRepondu ? undefined : "Réponds à toutes les questions pour valider"}
          >
            {envoiEnCours && <span className="spinner" aria-hidden="true" />}
            {envoiEnCours ? "Correction..." : "Valider mes réponses"}
          </button>
        ) : (
          <button type="button" className="bouton bouton-primaire" onClick={() => setIndexCourant((i) => i + 1)}>
            Suivante
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
