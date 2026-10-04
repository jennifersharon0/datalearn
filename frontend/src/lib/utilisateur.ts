// Fichier : src/lib/utilisateur.ts


// Type d'un utilisateur Supabase.
import type { User } from "@supabase/supabase-js";

// Longueur maximale du prénom. Il est saisi par l'utilisateur lui-même :
// on évite qu'un texte très long ne déforme l'en-tête ou le menu. Exportée
// pour que les formulaires imposent la même limite à la saisie.
export const LONGUEUR_MAX_PRENOM = 40;

/**
 * Nettoie un prénom saisi avant de l'enregistrer : retire les espaces au
 * début et à la fin, remplace les espaces multiples par un seul, et coupe à
 * la longueur maximale. "  marie   claire " devient "marie claire".
 */
export function nettoyerPrenom(texte: string): string {
  return texte.trim().replace(/\s+/g, " ").slice(0, LONGUEUR_MAX_PRENOM);
}

/**
 * Renvoie le prénom de l'utilisateur, ou null s'il n'en a pas encore donné.
 *
 * On ne tente pas de deviner un prénom à partir de l'email : une adresse
 * comme "ouedraogolaura5@gmail.com" donnerait "Ouedraogolaura5", ce qui
 * fait plus d'effet bizarre que de chaleur. Sans prénom, l'interface
 * affiche simplement "Bonjour".
 */
export function prenomUtilisateur(utilisateur: User | null): string | null {
  // user_metadata peut contenir n'importe quoi : on vérifie que "prenom"
  // existe bien et que c'est du texte avant de l'utiliser.
  const valeur = utilisateur?.user_metadata?.prenom;

  if (typeof valeur !== "string") {
    return null;
  }

  // On retire les espaces autour et on coupe si le texte est trop long.
  const prenom = valeur.trim().slice(0, LONGUEUR_MAX_PRENOM);

  // Un prénom vide (que des espaces) compte comme absent.
  return prenom || null;
}

/**
 * Renvoie la lettre affichée dans la pastille ronde de l'utilisateur :
 * l'initiale du prénom s'il existe, sinon celle de l'email, sinon "?".
 */
export function initialeUtilisateur(utilisateur: User | null): string {
  const source = prenomUtilisateur(utilisateur) ?? utilisateur?.email ?? "";
  return source.charAt(0).toUpperCase() || "?";
}