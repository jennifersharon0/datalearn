// Fichier : src/lib/categories.ts
//
// Outils communs aux pages "Mes cours" et "Catégorie" :
//   regrouper les sujets par catégorie, dans l'ordre de topics.py ;
//   fabriquer une adresse web propre à partir du nom d'une catégorie ;
//   dire où en est l'utilisateur sur une leçon (jamais ouverte, lue, réussie).
//
// Comme notionDeJour.ts, ce fichier ne contient que des fonctions pures :
// aucun appel au backend, seulement des calculs sur les données reçues.

// Types des données reçues du backend.
import type { ProgressionSujet, Sujet } from "./apiClient";

// Pourcentage minimal au quiz pour considérer une leçon comme réussie.
// 70 % correspond à au moins 6 bonnes réponses sur 8. Toute l'application
// lit cette valeur : la changer ici met tout à jour d'un coup.
export const SEUIL_REUSSITE = 70;

// Les trois états possibles d'une leçon pour l'utilisateur.
export type EtatLecon = "nouvelle" | "lue" | "reussie";

// Une catégorie avec ses sujets et la progression de l'utilisateur.
export interface Categorie {
  nom: string; // nom affiché, ex : "Deep Learning"
  slug: string; // nom utilisé dans l'adresse, ex : "deep-learning"
  sujets: Sujet[]; // ses leçons, dans l'ordre d'apprentissage
  vues: number; // nombre de leçons déjà ouvertes
  reussies: number; // nombre de leçons dont le quiz est réussi
}

/**
 * Transforme un nom de catégorie en morceau d'adresse web.
 * "Éthique & IA Responsable" devient "ethique-ia-responsable".
 * Une adresse lisible est plus agréable à partager qu'un numéro, et elle
 * ne contient que des lettres simples, des chiffres et des tirets.
 */
export function slugCategorie(nom: string): string {
  return nom
    .normalize("NFD") // sépare les lettres de leurs accents
    .replace(/[̀-ͯ]/g, "") // supprime les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // tout ce qui n'est ni lettre ni chiffre devient un tiret
    .replace(/^-+|-+$/g, ""); // retire les tirets en début et en fin
}

/**
 * Transforme la liste de progression du backend en dictionnaire
 * slug du sujet vers sa progression, pour la retrouver instantanément.
 */
export function indexerProgression(progression: ProgressionSujet[]): Map<string, ProgressionSujet> {
  return new Map(progression.map((p) => [p.sujet_slug, p]));
}

/**
 * Dit où en est l'utilisateur sur une leçon :
 *   "reussie" si son meilleur score au quiz atteint SEUIL_REUSSITE ;
 *   "lue" s'il a ouvert la leçon (ou passé un quiz sans le réussir) ;
 *   "nouvelle" s'il n'y a encore aucune activité.
 */
export function etatLecon(slug: string, progression: Map<string, ProgressionSujet>): EtatLecon {
  const p = progression.get(slug);
  if (!p) return "nouvelle";
  if (p.meilleur_pourcentage !== null && p.meilleur_pourcentage >= SEUIL_REUSSITE) return "reussie";
  return "lue";
}

/**
 * Regroupe les sujets par catégorie, dans l'ordre où le backend les envoie
 * (celui de topics.py), et compte pour chacune les leçons vues et réussies.
 */
export function regrouperParCategorie(sujets: Sujet[], progression: ProgressionSujet[]): Categorie[] {
  const index = indexerProgression(progression);

  // Une Map garde l'ordre d'insertion : les catégories restent dans l'ordre.
  const groupes = new Map<string, Sujet[]>();
  for (const sujet of sujets) {
    const liste = groupes.get(sujet.categorie) ?? [];
    liste.push(sujet);
    groupes.set(sujet.categorie, liste);
  }

  return Array.from(groupes.entries()).map(([nom, sujetsCategorie]) => {
    // On calcule l'état de chaque leçon une seule fois, puis on compte.
    const etats = sujetsCategorie.map((s) => etatLecon(s.slug, index));
    return {
      nom,
      slug: slugCategorie(nom),
      sujets: sujetsCategorie,
      vues: etats.filter((e) => e !== "nouvelle").length,
      reussies: etats.filter((e) => e === "reussie").length,
    };
  });
}

/**
 * Trie les catégories de la plus avancée à la moins avancée : d'abord la
 * part des leçons consultées, puis le nombre de quiz réussis. À égalité,
 * l'ordre du parcours est conservé, car sort() garde l'ordre des éléments
 * égaux. Les premières sont ainsi celles sur lesquelles
 * on travaille (tableau de bord et accueil).
 */
export function trierParAvancement(categories: Categorie[]): Categorie[] {
  const part = (c: Categorie) => (c.sujets.length > 0 ? c.vues / c.sujets.length : 0);
  // On trie une copie, pour ne pas modifier la liste d'origine.
  return [...categories].sort((a, b) => part(b) - part(a) || b.reussies - a.reussies);
}