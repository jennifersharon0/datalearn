// Fichier : src/lib/statistiques.ts
//
// Les calculs du tableau de bord, séparés de l'affichage. Toutes les
// fonctions de ce fichier sont "pures" : elles reçoivent des données et
// renvoient un résultat, sans appeler le backend ni toucher à la page.
// On peut donc les lire et les vérifier sans rien savoir de React.
//
// On y trouve trois familles de calculs :
//   les dates (clé d'un jour, décalage de quelques jours) ;
//   l'activité (compléter les jours vides, regrouper les jours par
//   semaine, choisir l'intensité d'une case) ;
//   les scores (pourcentage d'un quiz, moyenne, évolution sur 7 jours).

import type { ActiviteJour, HistoriqueQuizLigne } from "./apiClient";

// Seuil de réussite d'un quiz, en pourcentage. Le même que dans categories.ts.
import { SEUIL_REUSSITE } from "./categories";

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

// Nombre de semaines affichées dans le graphique d'activité.
// Le backend renvoie 84 jours, soit exactement 12 semaines.
export const SEMAINES_ACTIVITE = 12;

/**
 * Transforme une date en clé "AAAA-MM-JJ", dans le fuseau de l'appareil.
 * C'est le même format que celui des jours renvoyés par le backend, ce qui
 * permet de retrouver l'activité d'un jour par une simple recherche.
 * On n'utilise pas toISOString() : elle convertit en temps universel et
 * peut donner la veille ou le lendemain selon l'heure.
 */
export function cleJour(date: Date): string {
  const annee = date.getFullYear();
  // getMonth() commence à 0 pour janvier, d'où le + 1.
  // padStart ajoute un zéro devant les nombres à un chiffre : 9 devient "09".
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

/**
 * Renvoie une nouvelle date décalée d'un certain nombre de jours
 * (négatif pour revenir en arrière). La date reçue n'est pas modifiée.
 */
export function decalerJours(date: Date, nombre: number): Date {
  const copie = new Date(date);
  copie.setDate(copie.getDate() + nombre);
  return copie;
}

/**
 * Ramène une date à minuit, pour comparer des jours sans tenir compte de l'heure.
 */
function debutDuJour(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Position d'un jour dans la semaine, du lundi (0) au dimanche (6).
 * getDay() de JavaScript commence le dimanche (0) : on décale pour
 * suivre l'habitude française d'une semaine qui commence le lundi.
 */
export function rangDansSemaine(date: Date): number {
  return (date.getDay() + 6) % 7;
}

// ---------------------------------------------------------------------------
// Activité
// ---------------------------------------------------------------------------

// Un jour du calendrier, avec son activité (zéro si rien ne s'est passé).
export interface JourCalendrier {
  date: Date;
  cle: string; // "AAAA-MM-JJ"
  lecons: number;
  quiz: number;
  total: number; // lecons + quiz
  niveau: number; // intensité de la case, de 0 (rien) à 4 (beaucoup)
}

/**
 * Choisit l'intensité d'une case selon le nombre d'activités du jour.
 * Les paliers sont fixes plutôt que relatifs au jour le plus chargé : une
 * même journée garde ainsi la même couleur d'une semaine sur l'autre.
 */
export function niveauActivite(total: number): number {
  if (total === 0) return 0;
  if (total === 1) return 1;
  if (total <= 3) return 2;
  if (total <= 5) return 3;
  return 4;
}

/**
 * Range l'activité renvoyée par le backend dans un dictionnaire
 * "AAAA-MM-JJ" vers l'activité du jour, pour la retrouver instantanément.
 */
function indexerActivite(activite: ActiviteJour[]): Map<string, ActiviteJour> {
  return new Map(activite.map((jour) => [jour.date, jour]));
}

/**
 * Construit l'objet complet d'un jour à partir de l'activité indexée.
 * Un jour absent de l'index n'a eu aucune activité.
 */
function construireJour(date: Date, index: Map<string, ActiviteJour>): JourCalendrier {
  const cle = cleJour(date);
  const trouve = index.get(cle);
  const lecons = trouve?.lecons ?? 0;
  const quiz = trouve?.quiz ?? 0;
  return { date, cle, lecons, quiz, total: lecons + quiz, niveau: niveauActivite(lecons + quiz) };
}

/**
 * Renvoie les derniers jours, du plus ancien à aujourd'hui inclus, avec
 * zéro pour les jours sans activité. Sert à la rangée des 7 derniers jours.
 */
export function derniersJours(activite: ActiviteJour[], nombre: number, aujourdHui: Date): JourCalendrier[] {
  const index = indexerActivite(activite);
  const jours: JourCalendrier[] = [];

  // On part du jour le plus ancien pour obtenir une liste dans l'ordre.
  for (let ecart = nombre - 1; ecart >= 0; ecart--) {
    jours.push(construireJour(decalerJours(debutDuJour(aujourdHui), -ecart), index));
  }

  return jours;
}

/**
 * Construit la grille du calendrier : une colonne par semaine, du lundi au
 * dimanche, la dernière colonne étant la semaine en cours.
 * Les jours de cette semaine qui ne sont pas encore arrivés valent null :
 * le calendrier les laisse vides au lieu de les compter comme inactifs.
 */
export function grilleCalendrier(
  activite: ActiviteJour[],
  aujourdHui: Date,
  semaines: number = SEMAINES_ACTIVITE
): (JourCalendrier | null)[][] {
  const index = indexerActivite(activite);
  const jour0 = debutDuJour(aujourdHui);

  // Lundi de la semaine en cours, puis lundi de la première semaine affichée.
  const lundiCourant = decalerJours(jour0, -rangDansSemaine(jour0));
  const premierLundi = decalerJours(lundiCourant, -7 * (semaines - 1));

  const colonnes: (JourCalendrier | null)[][] = [];

  for (let s = 0; s < semaines; s++) {
    const colonne: (JourCalendrier | null)[] = [];
    for (let j = 0; j < 7; j++) {
      const date = decalerJours(premierLundi, s * 7 + j);
      // Un jour après aujourd'hui n'a pas encore eu lieu.
      colonne.push(date > jour0 ? null : construireJour(date, index));
    }
    colonnes.push(colonne);
  }

  return colonnes;
}

// L'activité d'une semaine, du lundi au dimanche.
export interface SemaineActivite {
  lundi: Date; // premier jour de la semaine
  lecons: number;
  quiz: number;
  total: number; // lecons + quiz
  enCours: boolean; // vrai pour la semaine d'aujourd'hui, pas encore finie
}

/**
 * Regroupe l'activité par semaine, du lundi au dimanche, sur les dernières
 * semaines. La dernière de la liste est la semaine en cours.
 * On part de la grille construite par grilleCalendrier (une colonne par
 * semaine) et on additionne simplement chaque colonne.
 */
export function semainesActivite(
  activite: ActiviteJour[],
  aujourdHui: Date,
  semaines: number = SEMAINES_ACTIVITE
): SemaineActivite[] {
  const colonnes = grilleCalendrier(activite, aujourdHui, semaines);

  return colonnes.map((colonne, i) => {
    // Les jours à venir valent null : on ne garde que les jours réels.
    const jours = colonne.filter((jour): jour is JourCalendrier => jour !== null);
    const lecons = jours.reduce((somme, jour) => somme + jour.lecons, 0);
    const quiz = jours.reduce((somme, jour) => somme + jour.quiz, 0);
    return {
      // Le lundi existe toujours : seuls des jours de la fin de la
      // semaine en cours peuvent être à venir.
      lundi: jours[0].date,
      lecons,
      quiz,
      total: lecons + quiz,
      enCours: i === colonnes.length - 1,
    };
  });
}

/**
 * Retire les semaines vides du début de la liste, pour que le graphique
 * commence une semaine avant la première activité au lieu d'afficher
 * plusieurs semaines vides. On garde toujours au moins les deux dernières
 * semaines (la précédente et celle en cours), même sans aucune activité.
 */
export function depuisPremiereActivite(semaines: SemaineActivite[]): SemaineActivite[] {
  const premiere = semaines.findIndex((s) => s.total > 0);
  // Aucune activité du tout : les deux dernières semaines.
  if (premiere === -1) return semaines.slice(-2);
  // Une semaine avant la première activité, sans dépasser le début de la
  // liste, et jamais moins de deux semaines affichées.
  const debut = Math.min(Math.max(premiere - 1, 0), semaines.length - 2);
  return semaines.slice(debut);
}

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

/**
 * Pourcentage arrondi d'une valeur sur un total, sans division par zéro.
 */
export function pourcentage(valeur: number, total: number): number {
  return total > 0 ? Math.round((valeur / total) * 100) : 0;
}

/**
 * Score d'un quiz en pourcentage.
 */
export function pourcentageQuiz(quiz: HistoriqueQuizLigne): number {
  return pourcentage(quiz.score, quiz.total);
}

/**
 * Vrai si le quiz atteint le seuil de réussite.
 */
export function quizReussi(quiz: HistoriqueQuizLigne): boolean {
  return pourcentageQuiz(quiz) >= SEUIL_REUSSITE;
}

/**
 * Moyenne des scores d'une liste de quiz, en pourcentage arrondi.
 * Renvoie null s'il n'y a aucun quiz, pour ne pas afficher un faux 0 %.
 */
export function moyenneScores(quiz: HistoriqueQuizLigne[]): number | null {
  if (quiz.length === 0) return null;
  const somme = quiz.reduce((acc, q) => acc + pourcentageQuiz(q), 0);
  return Math.round(somme / quiz.length);
}

// Comment le score moyen a bougé pendant les 7 derniers jours.
export type EvolutionScore =
  | { type: "aucun" } // aucun quiz du tout
  | { type: "debut" } // tous les quiz datent des 7 derniers jours : rien à comparer
  | { type: "stable" } // aucun quiz ces 7 derniers jours : la moyenne n'a pas bougé
  | { type: "ecart"; points: number }; // différence en points de pourcentage

/**
 * Compare le score moyen actuel à celui d'il y a 7 jours.
 * "Il y a 7 jours", c'est la moyenne calculée sans les quiz passés depuis.
 * Le résultat répond à la question : mes derniers quiz ont-ils fait
 * monter ou baisser ma moyenne ?
 */
export function evolutionScoreMoyen(historique: HistoriqueQuizLigne[], aujourdHui: Date): EvolutionScore {
  if (historique.length === 0) return { type: "aucun" };

  // Limite : minuit, il y a 6 jours. Avec aujourd'hui, cela fait 7 jours.
  const limite = decalerJours(debutDuJour(aujourdHui), -6);

  const anciens = historique.filter((q) => new Date(q.date) < limite);
  const recents = historique.length - anciens.length;

  if (anciens.length === 0) return { type: "debut" };
  if (recents === 0) return { type: "stable" };

  // Les deux moyennes existent forcément ici, d'où le "as number".
  const avant = moyenneScores(anciens) as number;
  const maintenant = moyenneScores(historique) as number;

  return { type: "ecart", points: maintenant - avant };
}

// ---------------------------------------------------------------------------
// Textes
// ---------------------------------------------------------------------------

/**
 * Écrit un nombre suivi du mot au singulier ou au pluriel.
 * En français, 0 et 1 prennent le singulier : "0 quiz", "1 leçon", "2 leçons".
 */
export function compter(nombre: number, singulier: string, pluriel: string): string {
  return `${nombre} ${nombre > 1 ? pluriel : singulier}`;
}

/**
 * Date complète avec le jour de la semaine, par exemple "mardi 29 septembre".
 */
export function formaterJourLong(date: Date): string {
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * Date courte, par exemple "29 sept.". On accepte une date ou un texte ISO.
 */
export function formaterJourCourt(date: Date | string): string {
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/**
 * Résumé de l'activité d'un jour, par exemple "2 leçons, 1 quiz" ou "Aucune activité".
 */
export function texteActivite(jour: JourCalendrier): string {
  if (jour.total === 0) return "Aucune activité";
  const morceaux: string[] = [];
  if (jour.lecons > 0) morceaux.push(compter(jour.lecons, "leçon", "leçons"));
  if (jour.quiz > 0) morceaux.push(compter(jour.quiz, "quiz", "quiz"));
  return morceaux.join(", ");
}