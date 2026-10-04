// Fichier : src/lib/apiClient.ts
//
// Ce fichier regroupe tous les échanges entre le frontend et notre backend
// FastAPI (main.py). Aucun composant n'appelle fetch() directement : ils
// utilisent tous l'objet "api" défini en bas du fichier. Si une route
// change côté backend, il n'y a donc qu'un seul endroit à modifier.
//
// Il s'occupe aussi de trois choses que chaque appel doit faire de la même
// façon : joindre le jeton de connexion, limiter le temps d'attente, et
// transformer les erreurs techniques en messages compréhensibles.

// On a besoin du client Supabase pour lire le jeton de la session en cours.
import { supabase } from "./supabaseClient";

// Adresse du backend, lue dans frontend/.env (en local : http://localhost:8000).
const API_URL = import.meta.env.VITE_API_URL;

// Même principe que dans supabaseClient.ts : on échoue tout de suite avec
// un message clair si la variable n'est pas définie.
if (!API_URL) {
  throw new Error("Configuration manquante : VITE_API_URL doit être définie dans frontend/.env");
}

// Temps d'attente maximal pour une réponse, en millisecondes.
// Une réponse du LLM peut prendre plusieurs secondes, on laisse donc une
// marge confortable avant d'abandonner la requête.
const DELAI_MAXIMUM_MS = 60_000;

// ---------------------------------------------------------------------------
// Types des données échangées
//
// Ces interfaces décrivent exactement ce que renvoie main.py, avec les mêmes
// noms de champs (en français). TypeScript s'en sert pour signaler une faute
// de frappe ou un champ inexistant avant même de lancer l'application.
// ---------------------------------------------------------------------------

// Un sujet tel que renvoyé par la route /topics.
export interface Sujet {
  slug: string; // identifiant technique utilisé dans les adresses, ex : "regression_lineaire"
  titre: string; // titre lisible, ex : "Régression Linéaire"
  categorie: string; // catégorie du sujet, ex : "machine_learning"
}

// Une leçon telle que renvoyée par la route /lessons/{slug}.
export interface Lecon {
  titre: string;
  categorie: string;
  contenu: string; // texte complet de la leçon
}

// Une question de quiz, sans la bonne réponse (le backend la retire exprès).
export interface QuestionQuiz {
  question: string;
  options: string[];
}

// Le quiz complet d'un sujet, renvoyé par /lessons/{slug}/quiz.
export interface Quiz {
  questions: QuestionQuiz[];
}

// Le corrigé d'une question, renvoyé après la soumission du quiz.
// Attention : côté backend, les réponses sont numérotées à partir de 1
// (la première option vaut 1, pas 0).
export interface Correction {
  question: string;
  options: string[];
  ta_reponse: number | null; // réponse donnée, numérotée à partir de 1
  bonne_reponse: number; // bonne réponse, numérotée à partir de 1
  correct: boolean; // vrai si la réponse donnée est la bonne
}

// Le résultat global d'un quiz.
export interface ResultatQuiz {
  score: number; // nombre de bonnes réponses
  total: number; // nombre de questions
  corrections: Correction[];
}

// Une ligne de l'historique des quiz passés par l'utilisateur.
export interface HistoriqueQuizLigne {
  sujet_slug: string;
  score: number;
  total: number;
  date: string; // date au format ISO, ex : "2026-09-29T17:20:00"
}

// L'activité d'une journée : nombre de leçons ouvertes et de quiz passés.
// Le backend ne renvoie que les jours où il s'est passé quelque chose.
export interface ActiviteJour {
  date: string; // jour au format "AAAA-MM-JJ", ex : "2026-09-29"
  lecons: number;
  quiz: number;
}

// Les statistiques affichées sur le tableau de bord, renvoyées par /dashboard.
export interface TableauDeBord {
  streak_jours: number; // nombre de jours actifs consécutifs
  sujets_completes: number; // nombre de leçons différentes consultées
  total_sujets: number; // nombre total de sujets disponibles
  par_categorie: Record<string, number>; // catégorie : nombre de leçons vues
  historique_quiz: HistoriqueQuizLigne[];
  activite: ActiviteJour[]; // activité jour par jour sur les 12 dernières semaines
}

// L'état d'un sujet pour l'utilisateur connecté, renvoyé par /progress.
// Seuls les sujets déjà touchés apparaissent : un sujet absent de la liste
// n'a jamais été ouvert.
export interface ProgressionSujet {
  sujet_slug: string;
  lue: boolean; // vrai si la leçon a été ouverte au moins une fois
  meilleur_pourcentage: number | null; // meilleur score au quiz, null si jamais passé
  derniere_activite: string; // date ISO de la dernière activité sur ce sujet
}

// ---------------------------------------------------------------------------
// Gestion des erreurs
// ---------------------------------------------------------------------------

// Erreur propre à nos appels API. En plus du message, elle garde le code
// HTTP pour que les composants puissent réagir différemment selon le cas
// (par exemple, renvoyer vers la connexion si la session a expiré).
export class ErreurApi extends Error {
  // Code HTTP de la réponse. Vaut 0 quand le serveur n'a pas pu être joint.
  statut: number;

  constructor(message: string, statut: number) {
    super(message); // transmet le message à la classe Error d'origine
    this.name = "ErreurApi"; // nom visible dans la console en cas d'erreur
    this.statut = statut;
  }
}

// Traduit un code HTTP en message lisible pour l'utilisateur.
// On n'affiche jamais le détail technique renvoyé par le serveur : il peut
// contenir des informations internes qui n'ont rien à faire à l'écran.
function messageSelonStatut(statut: number): string {
  if (statut === 401) return "Ta session a expiré. Reconnecte-toi pour continuer.";
  if (statut === 404) return "Ce contenu est introuvable.";
  if (statut === 422) return "La demande envoyée n'est pas valide.";
  // 429 : la limite de questions à l'assistant est atteinte (voir limiteur.py).
  if (statut === 429) return "Tu as posé beaucoup de questions en peu de temps. Réessaie un peu plus tard.";
  // 502 et 503 : le LLM n'a pas répondu ou son quota du jour est épuisé.
  if (statut === 502 || statut === 503) return "L'assistant est momentanément indisponible. Réessaie plus tard.";
  if (statut >= 500) return "Le serveur a rencontré un problème. Réessaie dans quelques instants.";
  return "Une erreur inattendue est survenue.";
}

// ---------------------------------------------------------------------------
// Fonction commune à tous les appels
// ---------------------------------------------------------------------------

// Envoie une requête au backend avec le jeton de l'utilisateur connecté,
// puis renvoie la réponse déjà convertie depuis le JSON.
// Le <T> permet d'indiquer à chaque appel le type de données attendu.
async function requeteAuthentifiee<T>(chemin: string, options: RequestInit = {}): Promise<T> {
  // Lecture de la session en cours. Supabase la renouvelle lui-même si besoin.
  const { data } = await supabase.auth.getSession();
  const jeton = data.session?.access_token;

  // Sans jeton, le backend refuserait la requête : inutile de l'envoyer.
  if (!jeton) {
    throw new ErreurApi(messageSelonStatut(401), 401);
  }

  // On part des en-têtes éventuellement fournis, puis on ajoute les nôtres.
  const entetes = new Headers(options.headers);

  // Le jeton prouve au backend qui fait la demande (vérifié dans auth_jwt.py).
  entetes.set("Authorization", `Bearer ${jeton}`);

  // On ne précise le format JSON que lorsqu'on envoie réellement un contenu.
  if (options.body) {
    entetes.set("Content-Type", "application/json");
  }

  // AbortController permet d'annuler une requête en cours.
  // Le minuteur l'annule si le serveur met trop de temps à répondre.
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MAXIMUM_MS);

  let reponse: Response;

  try {
    reponse = await fetch(`${API_URL}${chemin}`, {
      ...options,
      headers: entetes,
      signal: controleur.signal,
    });
  } catch (erreur) {
    // On arrive ici quand aucune réponse n'a été reçue : serveur éteint,
    // connexion coupée, ou délai dépassé.
    const delaiDepasse = erreur instanceof DOMException && erreur.name === "AbortError";
    throw new ErreurApi(
      delaiDepasse
        ? "Le serveur met trop de temps à répondre. Réessaie dans un instant."
        : "Impossible de joindre le serveur. Vérifie ta connexion ou réessaie plus tard.",
      0
    );
  } finally {
    // Dans tous les cas, on arrête le minuteur pour ne pas le laisser tourner.
    clearTimeout(minuteur);
  }

  // Le serveur a répondu, mais avec un code d'erreur (401, 404, 500...).
  if (!reponse.ok) {
    // En développement seulement, on affiche le détail dans la console
    // pour pouvoir déboguer. En production, rien ne s'affiche.
    if (import.meta.env.DEV) {
      console.error(`Erreur API ${reponse.status} sur ${chemin} :`, await reponse.text());
    }
    throw new ErreurApi(messageSelonStatut(reponse.status), reponse.status);
  }

  // Tout s'est bien passé : on renvoie le contenu JSON converti en objet.
  return (await reponse.json()) as T;
}

// ---------------------------------------------------------------------------
// Les appels disponibles, un par route du backend
// ---------------------------------------------------------------------------

export const api = {
  // Liste de tous les sujets (route GET /topics).
  topics(): Promise<Sujet[]> {
    return requeteAuthentifiee<Sujet[]>("/topics");
  },

  // Contenu d'une leçon (route GET /lessons/{slug}).
  // encodeURIComponent protège l'adresse si le slug contenait un caractère
  // spécial : il ne peut pas modifier la route appelée.
  lecon(slug: string): Promise<Lecon> {
    return requeteAuthentifiee<Lecon>(`/lessons/${encodeURIComponent(slug)}`);
  },

  // Questions du quiz, sans les réponses (route GET /lessons/{slug}/quiz).
  quiz(slug: string): Promise<Quiz> {
    return requeteAuthentifiee<Quiz>(`/lessons/${encodeURIComponent(slug)}/quiz`);
  },

  // Envoi des réponses pour correction (route POST /lessons/{slug}/quiz/submit).
  // Dans React, on repère une option par sa position dans le tableau, qui
  // commence à 0. Le backend attend une numérotation qui commence à 1.
  // La conversion se fait ici, une fois pour toutes. Une question sans
  // réponse est représentée par -1 et reste -1.
  soumettreQuiz(slug: string, reponses: number[]): Promise<ResultatQuiz> {
    const reponsesPourLeBackend = reponses.map((position) => (position < 0 ? -1 : position + 1));

    return requeteAuthentifiee<ResultatQuiz>(`/lessons/${encodeURIComponent(slug)}/quiz/submit`, {
      method: "POST",
      body: JSON.stringify({ reponses: reponsesPourLeBackend }),
    });
  },

  // Question libre au LLM sur un sujet (route POST /questions).
  // Le backend renvoie { reponse: "..." } : on ne garde que le texte.
  async poserQuestion(slug: string, question: string): Promise<string> {
    const corps = await requeteAuthentifiee<{ reponse: string }>("/questions", {
      method: "POST",
      body: JSON.stringify({ sujet_slug: slug, question }),
    });
    return corps.reponse;
  },

  // Définition courte d'un sujet (route GET /lessons/{slug}/definition).
  // Le backend renvoie { definition: "..." } : on ne garde que le texte.
  async definition(slug: string): Promise<string> {
    const corps = await requeteAuthentifiee<{ definition: string }>(
      `/lessons/${encodeURIComponent(slug)}/definition`
    );
    return corps.definition;
  },

  // État de chaque sujet déjà touché par l'utilisateur (route GET /progress).
  // Sert aux indicateurs des leçons, au bouton "Reprendre" et à la notion du jour.
  progression(): Promise<ProgressionSujet[]> {
    return requeteAuthentifiee<ProgressionSujet[]>("/progress");
  },

  // Statistiques de progression de l'utilisateur (route GET /dashboard).
  dashboard(): Promise<TableauDeBord> {
    return requeteAuthentifiee<TableauDeBord>("/dashboard");
  },
};