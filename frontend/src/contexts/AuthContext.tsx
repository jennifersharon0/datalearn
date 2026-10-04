// Fichier : src/contexts/AuthContext.tsx

/* Ce fichier rend l'état de connexion disponible partout dans l'application.
 N'importe quel composant peut savoir si quelqu'un est connecté, qui c'est,
 et le déconnecter, simplement en appelant useAuth(). Sans ce fichier, il
 faudrait faire passer ces informations de composant en composant à la main.

 Il repose sur le "contexte" de React : un fournisseur (AuthProvider) placé
 tout en haut de l'application stocke les données, et tous les composants
 situés en dessous peuvent les lire.

 createContext crée le contexte, useContext permet de le lire,
 useEffect lance du code au montage du composant, useState stocke une valeur
 qui, quand elle change, met l'affichage à jour.
 ReactNode est le type de "n'importe quel contenu affichable" (utilisé pour children).*/
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Session et User sont les types fournis par Supabase :
// Session contient le jeton de connexion, User contient l'email, l'identifiant, etc.
import type { Session, User } from "@supabase/supabase-js";

// Notre connexion unique à Supabase (fichier 1).
import { supabase } from "../lib/supabaseClient";

// Ce que le contexte met à disposition des composants.
interface ValeurAuth {
  session: Session | null; // null quand personne n'est connecté
  utilisateur: User | null; // raccourci vers session.user
  chargement: boolean; // vrai tant qu'on ne sait pas encore si quelqu'un est connecté
  deconnecter: () => Promise<void>; // fonction à appeler pour se déconnecter
}

// Création du contexte. La valeur par défaut "undefined" sert à détecter
// un oubli : si un composant utilise useAuth() en dehors du fournisseur,
// on pourra le signaler clairement (voir useAuth plus bas).
const AuthContext = createContext<ValeurAuth | undefined>(undefined);

// Le fournisseur, à placer autour de toute l'application (dans App.tsx).
// "children" représente tout ce qui est affiché à l'intérieur.
export function AuthProvider({ children }: { children: ReactNode }) {
  // Session en cours, vide au départ.
  const [session, setSession] = useState<Session | null>(null);

  // Au démarrage, on ne sait pas encore si une session existe :
  // on est donc "en chargement" jusqu'à la première réponse de Supabase.
  const [chargement, setChargement] = useState(true);

  // Ce bloc s'exécute une seule fois, quand le fournisseur apparaît à l'écran
  // (grâce au tableau vide [] passé en second argument).
  useEffect(() => {
    // Indique si le composant est toujours affiché. Si l'utilisateur quitte
    // la page avant la réponse de Supabase, on évite de modifier un état
    // qui n'existe plus.
    let actif = true;

    // Première lecture : y a-t-il déjà une session enregistrée dans le navigateur ?
    supabase.auth.getSession().then(({ data, error }) => {
      if (!actif) return;
      // En cas d'erreur de lecture, on considère que personne n'est connecté.
      setSession(error ? null : data.session);
      setChargement(false);
    });

    // Ensuite, on écoute tous les changements : connexion, déconnexion,
    // renouvellement du jeton. Supabase appelle cette fonction à chaque fois.
    const { data: abonnement } = supabase.auth.onAuthStateChange((_evenement, nouvelleSession) => {
      if (!actif) return;
      setSession(nouvelleSession);
      setChargement(false);
    });

    // Fonction de nettoyage, appelée quand le fournisseur disparaît :
    // on arrête d'écouter pour ne pas laisser un écouteur tourner inutilement.
    return () => {
      actif = false;
      abonnement.subscription.unsubscribe();
    };
  }, []);

  // Déconnexion : Supabase efface la session du navigateur, puis
  // onAuthStateChange (plus haut) met automatiquement session à null.
  async function deconnecter() {
    await supabase.auth.signOut();
  }

  // On transmet les valeurs à tous les composants situés à l'intérieur.
  return (
    <AuthContext.Provider
      value={{
        session,
        utilisateur: session?.user ?? null,
        chargement,
        deconnecter,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Le "hook" que les composants utilisent pour lire le contexte.
// Exemple dans un composant : const { utilisateur, deconnecter } = useAuth();
export function useAuth(): ValeurAuth {
  const valeur = useContext(AuthContext);

  // Si la valeur est undefined, c'est que le composant n'est pas placé
  // à l'intérieur de AuthProvider : on le dit explicitement.
  if (valeur === undefined) {
    throw new Error("useAuth doit être utilisé à l'intérieur de AuthProvider");
  }

  return valeur;
}
