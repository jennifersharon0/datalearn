// Fichier : src/lib/notionDuJour.ts
//
// Choisit la "notion du jour" : un sujet que l'utilisateur n'a encore jamais
// ouvert, proposé sur la page d'accueil et sur la page Notion du jour.
//
// Le choix suit deux règles.
//
// 1. Il respecte l'ordre d'apprentissage. Plutôt que de tirer au hasard
//    parmi tous les sujets non vus (et de proposer "Fine-tuning" à quelqu'un
//    qui n'a jamais vu la régression), on retient seulement :
//      la prochaine leçon non vue de chaque catégorie déjà commencée ;
//      ou, si aucune catégorie n'est commencée, la première leçon de
//      chaque catégorie.
//
// 2. Il reste le même toute la journée. Le choix est calculé à partir de la
//    date du jour et de l'identifiant de l'utilisateur : recharger la page
//    ne change pas la notion, mais elle change le lendemain, et deux
//    utilisateurs n'ont pas forcément la même.
//
// Ce fichier ne contient que des fonctions "pures" : elles ne lisent rien
// d'autre que leurs paramètres et n'appellent pas le backend. Elles sont donc
// simples à tester et réutilisables par plusieurs pages.

// Types des données reçues du backend (fichier apiClient.ts).
import type { ProgressionSujet, Sujet } from "./apiClient";

/**
 * Renvoie la liste des sujets qui peuvent devenir la notion du jour,
 * selon la règle 1 expliquée en haut du fichier.
 * Renvoie une liste vide si l'utilisateur a déjà ouvert tous les sujets.
 */
export function candidatsNotion(sujets: Sujet[], progression: ProgressionSujet[]): Sujet[] {
  // Ensemble des slugs déjà ouverts, pour tester rapidement "déjà vu ou non".
  const vus = new Set(progression.filter((p) => p.lue).map((p) => p.sujet_slug));

  // Regroupe les sujets par catégorie, en gardant l'ordre de topics.py.
  const parCategorie = new Map<string, Sujet[]>();
  for (const sujet of sujets) {
    const liste = parCategorie.get(sujet.categorie) ?? [];
    liste.push(sujet);
    parCategorie.set(sujet.categorie, liste);
  }

  // "suites" : prochaine leçon non vue des catégories déjà commencées.
  // "debuts" : première leçon des catégories jamais commencées.
  const suites: Sujet[] = [];
  const debuts: Sujet[] = [];

  for (const liste of parCategorie.values()) {
    const prochaine = liste.find((sujet) => !vus.has(sujet.slug));

    // Toute la catégorie est déjà vue : rien à proposer ici.
    if (!prochaine) continue;

    const commencee = liste.some((sujet) => vus.has(sujet.slug));
    if (commencee) {
      suites.push(prochaine);
    } else {
      debuts.push(liste[0]);
    }
  }

  // On privilégie la continuité : les suites d'abord, s'il y en a.
  return suites.length > 0 ? suites : debuts;
}

/**
 * Transforme un texte en un nombre entier, toujours le même pour le même
 * texte (algorithme FNV-1a, très courant pour ce genre d'usage).
 * Ce n'est pas un chiffrement : il sert seulement à obtenir un choix stable.
 */
function empreinte(texte: string): number {
  let valeur = 2166136261;
  for (let i = 0; i < texte.length; i++) {
    // XOR avec le code du caractère, puis multiplication par un nombre premier.
    valeur ^= texte.charCodeAt(i);
    valeur = Math.imul(valeur, 16777619);
  }
  // ">>> 0" convertit le résultat en entier positif.
  return valeur >>> 0;
}

/**
 * Date du jour au format AAAA-MM-JJ, dans le fuseau horaire de l'utilisateur
 * (pour que la notion change à minuit chez lui, et non à minuit à Londres).
 */
function dateDuJour(date: Date): string {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

/**
 * Renvoie la notion du jour pour un utilisateur, ou null s'il a déjà tout vu.
 *
 * "decalage" permet de proposer une autre notion (bouton "Une autre") :
 * 0 donne la notion du jour, 1 la suivante dans la liste des candidats, etc.
 */
export function notionDuJour(
  sujets: Sujet[],
  progression: ProgressionSujet[],
  idUtilisateur: string,
  decalage = 0,
  date = new Date()
): Sujet | null {
  const candidats = candidatsNotion(sujets, progression);
  if (candidats.length === 0) return null;

  // Même utilisateur et même jour donnent toujours la même position de départ.
  const depart = empreinte(`${idUtilisateur}-${dateDuJour(date)}`);

  // Le modulo (%) ramène le nombre entre 0 et le nombre de candidats moins 1.
  return candidats[(depart + decalage) % candidats.length];
}