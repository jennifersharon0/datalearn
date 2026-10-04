// Fichier : src/pages/Login.tsx
//

import { useState, type FormEvent } from "react";

// Icônes de l'interface.
import {
  BookOpen,
  CircleCheck,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  MessageCircle,
  Target,
  TriangleAlert,
  UserRound,
} from "lucide-react";

// isAuthRetryableFetchError reconnaît une erreur due au réseau ou à un
// service Supabase injoignable (projet en pause, coupure internet...).
import { isAuthRetryableFetchError } from "@supabase/supabase-js";

// Notre connexion unique à Supabase (fichier 1).
import { supabase } from "../lib/supabaseClient";

// Limite et nettoyage du prénom, communs avec la page "Mon profil".
import { LONGUEUR_MAX_PRENOM, nettoyerPrenom } from "../lib/utilisateur";

// Les deux modes possibles du formulaire.
type Mode = "connexion" | "inscription";

// Longueur minimale du mot de passe à l'inscription.
const LONGUEUR_MIN_MOT_DE_PASSE = 8;

// Message unique pour tout échec d'identifiants (voir l'explication en haut).
const MESSAGE_IDENTIFIANTS = "Email ou mot de passe incorrect.";

// Message en cas de problème réseau ou de service indisponible.
const MESSAGE_SERVICE = "Le service est momentanément indisponible. Réessaie dans quelques instants.";

// Arguments affichés dans la partie présentation, à gauche.
const ATOUTS = [
  { Icone: BookOpen, texte: "Des leçons claires sur les grands sujets de la data et de l'IA" },
  { Icone: MessageCircle, texte: "Un assistant pour poser tes questions sur chaque leçon" },
  { Icone: Target, texte: "Des quiz pour vérifier ce que tu as retenu" },
];

export function Login() {
  // Mode actuel du formulaire.
  const [mode, setMode] = useState<Mode>("connexion");

  // Valeurs saisies dans les champs. Le prénom n'est demandé qu'à l'inscription.
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");

  // Affiche ou masque le mot de passe en clair.
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);

  // Message d'erreur ou de confirmation à afficher (null quand il n'y en a pas).
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  // Vrai pendant l'envoi, pour désactiver le bouton et éviter un double envoi.
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  // Change de mode et efface les anciens messages, qui ne concernent plus
  // le nouveau mode.
  function changerMode(nouveauMode: Mode) {
    setMode(nouveauMode);
    setErreur(null);
    setConfirmation(null);
  }

  // Appelée quand le formulaire est envoyé (clic sur le bouton ou touche Entrée).
  async function envoyer(evenement: FormEvent) {
    // Empêche le comportement par défaut du navigateur, qui rechargerait la page.
    evenement.preventDefault();

    setErreur(null);
    setConfirmation(null);

    // Un prénom fait uniquement d'espaces passe le "required" du navigateur :
    // on le refuse ici, avant d'appeler Supabase.
    if (mode === "inscription" && !nettoyerPrenom(prenom)) {
      setErreur("Indique ton prénom pour créer ton compte.");
      return;
    }

    setEnvoiEnCours(true);

    // On retire les espaces accidentels autour de l'email.
    const emailNettoye = email.trim();

    try {
      if (mode === "connexion") {
        // Tentative de connexion. En cas de succès, AuthContext est prévenu
        // automatiquement et App.tsx redirige vers l'accueil : rien d'autre à faire ici.
        const { error } = await supabase.auth.signInWithPassword({
          email: emailNettoye,
          password: motDePasse,
        });

        if (error) {
          setErreur(isAuthRetryableFetchError(error) ? MESSAGE_SERVICE : MESSAGE_IDENTIFIANTS);
        }
      } else {
        // Création du compte. "options.data" range le prénom dans les
        // user_metadata du compte, là où prenomUtilisateur() va le chercher.
        const { data, error } = await supabase.auth.signUp({
          email: emailNettoye,
          password: motDePasse,
          options: { data: { prenom: nettoyerPrenom(prenom) } },
        });

        if (error) {
          setErreur(
            isAuthRetryableFetchError(error) ? MESSAGE_SERVICE : "Impossible de créer le compte avec ces informations.",
          );
        } else if (!data.session) {
          // Pas de session renvoyée : Supabase attend une confirmation par email.
          setConfirmation("Compte créé. Ouvre l'email de confirmation reçu, puis connecte-toi.");
          setMotDePasse("");
          setMode("connexion");
        }
        // Si une session est renvoyée, l'utilisateur est directement connecté
        // et la redirection se fait toute seule, comme pour la connexion.
      }
    } catch {
      // Erreur imprévue (par exemple, plus de connexion internet du tout).
      setErreur(MESSAGE_SERVICE);
    } finally {
      // Que ça ait marché ou non, l'envoi est terminé.
      setEnvoiEnCours(false);
    }
  }

  // Texte du bouton principal selon le mode et l'état d'envoi.
  const texteBouton = envoiEnCours ? "Un instant..." : mode === "connexion" ? "Se connecter" : "Créer mon compte";

  return (
    <div className="page-connexion">
      {/* Partie gauche : présentation (masquée sur téléphone par le CSS). */}
      <aside className="connexion-presentation">
        <div className="marque marque-claire">
          <span className="marque-logo" aria-hidden="true">
            <GraduationCap size={20} />
          </span>
          <span className="marque-nom">DataLearn</span>
        </div>

        <div className="presentation-texte">
          <h1>Apprends la data science à ton rythme.</h1>
          <p>Du machine learning aux LLM, en passant par la recherche opérationnelle.</p>

          <ul className="liste-atouts">
            {ATOUTS.map(({ Icone, texte }) => (
              <li key={texte}>
                <span className="atout-icone" aria-hidden="true">
                  <Icone size={18} />
                </span>
                {texte}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Partie droite : le formulaire. */}
      <main className="connexion-zone">
        <div className="carte-connexion">
          {/* Logo visible uniquement sur téléphone, où la partie gauche est masquée. */}
          <div className="marque marque-mobile">
            <span className="marque-logo" aria-hidden="true">
              <GraduationCap size={20} />
            </span>
            <span className="marque-nom">DataLearn</span>
          </div>

          <h2>{mode === "connexion" ? "Bon retour parmi nous" : "Crée ton compte"}</h2>
          <p className="texte-secondaire">
            {mode === "connexion"
              ? "Connecte-toi pour reprendre ta progression."
              : "Quelques secondes suffisent pour commencer."}
          </p>

          {/* Sélecteur entre les deux modes. role="tablist" et aria-selected
              indiquent aux lecteurs d'écran quel mode est choisi. */}
          <div className="selecteur-mode" role="tablist" aria-label="Choix du mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "connexion"}
              className={mode === "connexion" ? "selecteur-option actif" : "selecteur-option"}
              onClick={() => changerMode("connexion")}
            >
              Connexion
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "inscription"}
              className={mode === "inscription" ? "selecteur-option actif" : "selecteur-option"}
              onClick={() => changerMode("inscription")}
            >
              Inscription
            </button>
          </div>

          <form className="formulaire" onSubmit={envoyer}>
            {/* Champ prénom, seulement à l'inscription. Il sert à saluer
                l'utilisateur sur l'accueil et dans le menu. */}
            {mode === "inscription" && (
              <div className="champ">
                <label htmlFor="prenom">Prénom</label>
                <div className="champ-saisie">
                  <UserRound size={18} className="champ-icone" aria-hidden="true" />
                  <input
                    id="prenom"
                    type="text"
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    placeholder="Ton prénom"
                    autoComplete="given-name"
                    maxLength={LONGUEUR_MAX_PRENOM}
                    required
                  />
                </div>
              </div>
            )}

            {/* Champ email. htmlFor relie le libellé au champ : cliquer sur
                le libellé place le curseur dans le champ. */}
            <div className="champ">
              <label htmlFor="email">Adresse email</label>
              <div className="champ-saisie">
                <Mail size={18} className="champ-icone" aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom@exemple.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Champ mot de passe, avec bouton pour l'afficher en clair. */}
            <div className="champ">
              <label htmlFor="mot-de-passe">Mot de passe</label>
              <div className="champ-saisie">
                <Lock size={18} className="champ-icone" aria-hidden="true" />
                <input
                  id="mot-de-passe"
                  type={motDePasseVisible ? "text" : "password"}
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  placeholder={
                    mode === "inscription" ? `${LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum` : "Ton mot de passe"
                  }
                  // "current-password" et "new-password" aident le gestionnaire
                  // de mots de passe du navigateur à proposer la bonne action.
                  autoComplete={mode === "connexion" ? "current-password" : "new-password"}
                  // La longueur minimale n'est imposée qu'à l'inscription.
                  minLength={mode === "inscription" ? LONGUEUR_MIN_MOT_DE_PASSE : undefined}
                  required
                />
                <button
                  type="button"
                  className="bouton-voir-mdp"
                  onClick={() => setMotDePasseVisible((visible) => !visible)}
                  aria-label={motDePasseVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {motDePasseVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Messages. aria-live="polite" fait lire le message par les
                lecteurs d'écran dès qu'il apparaît. */}
            <div aria-live="polite">
              {erreur && (
                <p className="alerte alerte-erreur">
                  <TriangleAlert size={18} aria-hidden="true" />
                  {erreur}
                </p>
              )}
              {confirmation && (
                <p className="alerte alerte-succes">
                  <CircleCheck size={18} aria-hidden="true" />
                  {confirmation}
                </p>
              )}
            </div>

            {/* Bouton d'envoi, désactivé pendant l'envoi. */}
            <button type="submit" className="bouton bouton-primaire bouton-large" disabled={envoiEnCours}>
              {envoiEnCours && <span className="spinner" aria-hidden="true" />}
              {texteBouton}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
