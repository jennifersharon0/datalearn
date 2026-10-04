// Fichier : src/lib/supabaseClient.ts
// Ce fichier crée une seule connexion à Supabase, partagée par toute l'application. Les autres fichiers importent l'objet "supabase" défini
// ici au lieu de fabriquer chacun leur propre connexion. Avoir un point d'entrée unique évite les doublons et rend la configuration facile à retrouver.

// createClient vient de la librairie officielle de Supabase.
// Elle fabrique un objet capable de dialoguer avec notre projet Supabase
// (connexion, inscription, session de l'utilisateur).
import { createClient } from "@supabase/supabase-js";

// Vite lit le fichier frontend/.env au démarrage et expose au navigateur uniquement les variables dont le nom commence par VITE_.
// Ici on récupère l'adresse de notre projet Supabase.
const url = import.meta.env.VITE_SUPABASE_URL;

// Clé publique du projet (celle qui commence par sb_publishable_).
// Elle est prévue pour être visible dans le navigateur : la sécurité des données repose sur l'authentification, pas sur le secret de cette clé.
// La clé secrète (service_role) ne doit jamais apparaître dans le frontend.
const clePublique = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Si l'une des deux valeurs est absente, on arrête l'application tout de suite avec un message qui dit exactement quoi corriger. Sans cette
// vérification, l'erreur apparaîtrait plus tard, beaucoup moins lisible.
if (!url || !clePublique) {
  throw new Error(
    "Configuration manquante : VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY " +
      "doivent être définies dans frontend/.env"
  );
}

// Création du client, faite une seule fois puis exportée.
export const supabase = createClient(url, clePublique, {
  auth: {
    // Garde la session dans le navigateur : l'utilisateur reste connectémême après avoir fermé puis rouvert l'onglet.
    persistSession: true,

    // Renouvelle le jeton de connexion avant qu'il n'expire, sans que l'utilisateur ait à se reconnecter.
    autoRefreshToken: true,

    // Permet de récupérer la session quand l'utilisateur revient depuis un lien reçu par email (confirmation de compte, par exemple).
    detectSessionInUrl: true,
  },
});