// Fichier : src/pages/Profil.tsx

//
// Les modifications sont faites directement auprès de Supabase avec
// supabase.auth.updateUser. Supabase vérifie lui-même que c'est bien la
// personne connectée qui modifie son propre compte. Ensuite, il prévient
// AuthContext, qui met à jour l'utilisateur partout : le menu et l'accueil
// affichent le nouveau prénom sans recharger la page.

import { useState, type FormEvent, type ReactNode } from "react";

import { CircleCheck, Eye, EyeOff, Lock, LogOut, Mail, TriangleAlert, UserRound } from "lucide-react";

// isAuthRetryableFetchError reconnaît une panne réseau ou un service injoignable.
import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";

import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { initialeUtilisateur, LONGUEUR_MAX_PRENOM, nettoyerPrenom, prenomUtilisateur } from "../lib/utilisateur";

import "./Profil.css";

// Même longueur minimale qu'à l'inscription (Login.tsx).
const LONGUEUR_MIN_MOT_DE_PASSE = 8;

// Les trois réglages modifiables.
type Reglage = "prenom" | "email" | "mdp";

// Un message à afficher : réussite ou erreur.
interface Message {
  type: "succes" | "erreur";
  texte: string;
}

/**
 * Traduit une erreur de Supabase en message compréhensible.
 * Supabase renvoie un "code" précis pour les cas courants ; pour les autres,
 * on affiche un message général plutôt que le texte technique en anglais.
 */
function messageErreur(erreur: AuthError): string {
  if (isAuthRetryableFetchError(erreur)) {
    return "Le service est momentanément indisponible. Réessaie dans quelques instants.";
  }
  if (erreur.code === "same_password") {
    return "Le nouveau mot de passe doit être différent de l'ancien.";
  }
  if (erreur.code === "weak_password") {
    return "Ce mot de passe est trop simple. Choisis-en un plus long ou plus varié.";
  }
  if (erreur.code === "email_exists" || erreur.code === "email_address_invalid") {
    return "Cette adresse ne peut pas être utilisée. Vérifie-la ou choisis-en une autre.";
  }
  if (erreur.code === "over_email_send_rate_limit") {
    return "Trop d'emails envoyés en peu de temps. Réessaie dans quelques minutes.";
  }
  if (erreur.code === "reauthentication_needed") {
    return "Par sécurité, déconnecte-toi puis reconnecte-toi avant de faire cette modification.";
  }
  return "La modification n'a pas pu être enregistrée. Réessaie dans un instant.";
}

/**
 * Affiche un message de réussite ou d'erreur, avec son icône.
 * aria-live le fait lire par les lecteurs d'écran dès qu'il apparaît.
 */
function ZoneMessage({ message }: { message: Message | null }) {
  return (
    <div aria-live="polite">
      {message && (
        <p className={message.type === "succes" ? "alerte alerte-succes" : "alerte alerte-erreur"}>
          {message.type === "succes" ? (
            <CircleCheck size={18} aria-hidden="true" />
          ) : (
            <TriangleAlert size={18} aria-hidden="true" />
          )}
          {message.texte}
        </p>
      )}
    </div>
  );
}

/**
 * Une ligne de réglage : l'intitulé, la valeur actuelle, le bouton
 * "Modifier", puis, quand la ligne est ouverte, le formulaire (children).
 * "retour" est le message laissé après une modification réussie, affiché
 * sous la ligne une fois le formulaire refermé.
 */
interface ProprietesLigne {
  id: Reglage;
  titre: string;
  valeur: ReactNode;
  ouverte: boolean;
  onModifier: () => void;
  retour: Message | null;
  children: ReactNode;
}

function LigneReglage({ id, titre, valeur, ouverte, onModifier, retour, children }: ProprietesLigne) {
  return (
    <li className={ouverte ? "profil-ligne ouverte" : "profil-ligne"}>
      <div className="profil-ligne-resume">
        <span className="profil-ligne-titre">{titre}</span>
        <span className="profil-ligne-valeur">{valeur}</span>
        {/* Le bouton disparaît quand le formulaire est ouvert : "Annuler"
            prend le relais. aria-controls désigne le formulaire qu'il ouvre. */}
        {!ouverte && (
          <button
            type="button"
            className="profil-modifier"
            onClick={onModifier}
            aria-controls={`formulaire-${id}`}
            aria-expanded={false}
          >
            Modifier
          </button>
        )}
      </div>

      {ouverte ? (
        <div id={`formulaire-${id}`} className="profil-ligne-formulaire">
          {children}
        </div>
      ) : (
        retour && <ZoneMessage message={retour} />
      )}
    </li>
  );
}

export function Profil() {
  const { utilisateur, deconnecter } = useAuth();
  const prenomActuel = prenomUtilisateur(utilisateur);

  // Le réglage dont le formulaire est ouvert (null : aucun).
  const [ouvert, setOuvert] = useState<Reglage | null>(null);

  // Message laissé après une modification réussie, avec le réglage concerné.
  const [retour, setRetour] = useState<{ reglage: Reglage; message: Message } | null>(null);

  // Erreur du formulaire ouvert, et envoi en cours (un seul formulaire à la fois).
  const [erreur, setErreur] = useState<Message | null>(null);
  const [envoi, setEnvoi] = useState(false);

  // Valeurs des champs.
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmationMdp, setConfirmationMdp] = useState("");
  const [mdpVisible, setMdpVisible] = useState(false);

  // Date d'inscription en toutes lettres, par exemple "septembre 2026".
  const membreDepuis = utilisateur?.created_at
    ? new Date(utilisateur.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : null;

  // Ouvre le formulaire d'un réglage, avec des champs remis à zéro.
  // Le champ du prénom commence avec le prénom actuel, pour le corriger.
  function ouvrir(reglage: Reglage) {
    setOuvert(reglage);
    setRetour(null);
    setErreur(null);
    setPrenom(prenomActuel ?? "");
    setEmail("");
    setMotDePasse("");
    setConfirmationMdp("");
    setMdpVisible(false);
  }

  // Referme le formulaire sans rien enregistrer.
  function fermer() {
    setOuvert(null);
    setErreur(null);
  }

  // Appelée après une modification réussie : on referme et on laisse un message.
  function reussite(reglage: Reglage, texte: string) {
    setOuvert(null);
    setErreur(null);
    setRetour({ reglage, message: { type: "succes", texte } });
  }

  /**
   * Envoie une modification à Supabase et gère les cas communs aux trois
   * formulaires : bouton désactivé pendant l'envoi, erreur traduite en
   * français, panne réseau. Renvoie vrai si la modification a réussi.
   */
  async function envoyer(modification: Parameters<typeof supabase.auth.updateUser>[0]): Promise<boolean> {
    setErreur(null);
    setEnvoi(true);
    try {
      const { error } = await supabase.auth.updateUser(modification);
      if (error) {
        setErreur({ type: "erreur", texte: messageErreur(error) });
        return false;
      }
      return true;
    } catch {
      setErreur({ type: "erreur", texte: "Le service est momentanément indisponible." });
      return false;
    } finally {
      setEnvoi(false);
    }
  }

  // Prénom : rangé dans les user_metadata du compte.
  async function enregistrerPrenom(evenement: FormEvent) {
    evenement.preventDefault();
    const nouveau = nettoyerPrenom(prenom);
    if (!nouveau) {
      setErreur({ type: "erreur", texte: "Le prénom ne peut pas être vide." });
      return;
    }
    if (await envoyer({ data: { prenom: nouveau } })) {
      reussite("prenom", "Prénom enregistré.");
    }
  }

  // Email : Supabase ne le remplace pas tout de suite. Il envoie d'abord un
  // lien de confirmation, et l'adresse ne change qu'une fois le lien ouvert.
  // Une faute de frappe ne peut donc pas faire perdre l'accès au compte.
  async function changerEmail(evenement: FormEvent) {
    evenement.preventDefault();
    const nouveau = email.trim().toLowerCase();
    if (nouveau === utilisateur?.email?.toLowerCase()) {
      setErreur({ type: "erreur", texte: "C'est déjà ton adresse actuelle." });
      return;
    }
    if (await envoyer({ email: nouveau })) {
      reussite(
        "email",
        `Un lien de confirmation a été envoyé à ${nouveau}. La nouvelle adresse sera active dès que tu l'auras ouvert.`,
      );
    }
  }

  // Mot de passe : les deux saisies sont vérifiées avant d'appeler Supabase,
  // pour répondre tout de suite sans attendre le réseau.
  async function changerMotDePasse(evenement: FormEvent) {
    evenement.preventDefault();
    if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
      setErreur({
        type: "erreur",
        texte: `Le mot de passe doit faire au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`,
      });
      return;
    }
    if (motDePasse !== confirmationMdp) {
      setErreur({ type: "erreur", texte: "Les deux mots de passe ne sont pas identiques." });
      return;
    }
    if (await envoyer({ password: motDePasse })) {
      // reussite() referme le formulaire, et ouvrir() videra les champs la
      // prochaine fois : le mot de passe ne reste pas en mémoire à l'écran.
      setMotDePasse("");
      setConfirmationMdp("");
      reussite("mdp", "Mot de passe modifié.");
    }
  }

  // Les boutons du bas de chaque formulaire, identiques pour les trois.
  function boutons(libelle: string, actif: boolean) {
    return (
      <div className="profil-actions">
        <button type="button" className="bouton bouton-secondaire" onClick={fermer} disabled={envoi}>
          Annuler
        </button>
        <button type="submit" className="bouton bouton-primaire" disabled={envoi || !actif}>
          {envoi && <span className="spinner" aria-hidden="true" />}
          {envoi ? "Un instant..." : libelle}
        </button>
      </div>
    );
  }

  // Message du réglage donné, s'il en a un.
  const retourDe = (reglage: Reglage) => (retour?.reglage === reglage ? retour.message : null);

  return (
    <div className="page profil-page">
      <header className="page-entete">
        <h1>Mon profil</h1>
        <p className="texte-secondaire">Mes informations</p>
      </header>

      {/* Carte d'identité. */}
      <section className="carte profil-identite" aria-label="Mon compte">
        <span className="profil-avatar" aria-hidden="true">
          {initialeUtilisateur(utilisateur)}
        </span>
        <div className="profil-identite-texte">
          <p className="profil-nom">{prenomActuel ?? "Prénom non renseigné"}</p>
          <p className="texte-secondaire">{utilisateur?.email}</p>
          {membreDepuis && <p className="profil-depuis">Membre depuis {membreDepuis}</p>}
        </div>
      </section>

      {/* Les réglages, une ligne chacun. */}
      <section className="carte profil-reglages" aria-label="Réglages du compte">
        <ul className="profil-liste">
          {/* Prénom. */}
          <LigneReglage
            id="prenom"
            titre="Prénom"
            valeur={prenomActuel ?? <em>Non renseigné</em>}
            ouverte={ouvert === "prenom"}
            onModifier={() => ouvrir("prenom")}
            retour={retourDe("prenom")}
          >
            <form className="formulaire" onSubmit={enregistrerPrenom}>
              <div className="champ">
                <label htmlFor="profil-prenom">Ton prénom</label>
                <div className="champ-saisie">
                  <UserRound size={18} className="champ-icone" aria-hidden="true" />
                  <input
                    id="profil-prenom"
                    type="text"
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    placeholder="Ton prénom"
                    autoComplete="given-name"
                    maxLength={LONGUEUR_MAX_PRENOM}
                    autoFocus
                  />
                </div>
              </div>
              <ZoneMessage message={erreur} />
              {/* "Enregistrer" n'est actif que si le prénom a vraiment changé. */}
              {boutons("Enregistrer", nettoyerPrenom(prenom) !== (prenomActuel ?? ""))}
            </form>
          </LigneReglage>

          {/* Adresse email. */}
          <LigneReglage
            id="email"
            titre="Adresse email"
            valeur={
              <>
                {utilisateur?.email}
                {/* Un changement demandé mais pas encore confirmé : Supabase
                    garde la nouvelle adresse dans "new_email" en attendant. */}
                {utilisateur?.new_email && (
                  <span className="profil-attente">En attente de confirmation : {utilisateur.new_email}</span>
                )}
              </>
            }
            ouverte={ouvert === "email"}
            onModifier={() => ouvrir("email")}
            retour={retourDe("email")}
          >
            <form className="formulaire" onSubmit={changerEmail}>
              <div className="champ">
                <label htmlFor="profil-email">Nouvelle adresse</label>
                <div className="champ-saisie">
                  <Mail size={18} className="champ-icone" aria-hidden="true" />
                  <input
                    id="profil-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="prenom@exemple.com"
                    autoComplete="email"
                    required
                    autoFocus
                  />
                </div>
              </div>
              <p className="profil-aide">Un lien de confirmation sera envoyé à cette adresse.</p>
              <ZoneMessage message={erreur} />
              {boutons("Changer l'adresse", email.trim() !== "")}
            </form>
          </LigneReglage>

          {/* Mot de passe. Il n'est jamais affiché, même masqué : on montre
              seulement des points. */}
          <LigneReglage
            id="mdp"
            titre="Mot de passe"
            valeur="••••••••"
            ouverte={ouvert === "mdp"}
            onModifier={() => ouvrir("mdp")}
            retour={retourDe("mdp")}
          >
            <form className="formulaire" onSubmit={changerMotDePasse}>
              <div className="champ">
                <label htmlFor="profil-mdp">Nouveau mot de passe</label>
                <div className="champ-saisie">
                  <Lock size={18} className="champ-icone" aria-hidden="true" />
                  <input
                    id="profil-mdp"
                    type={mdpVisible ? "text" : "password"}
                    value={motDePasse}
                    onChange={(e) => setMotDePasse(e.target.value)}
                    placeholder={`${LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum`}
                    autoComplete="new-password"
                    minLength={LONGUEUR_MIN_MOT_DE_PASSE}
                    required
                    autoFocus
                  />
                  {/* Un seul bouton œil, qui affiche ou masque les deux champs. */}
                  <button
                    type="button"
                    className="bouton-voir-mdp"
                    onClick={() => setMdpVisible((visible) => !visible)}
                    aria-label={mdpVisible ? "Masquer les mots de passe" : "Afficher les mots de passe"}
                  >
                    {mdpVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="champ">
                <label htmlFor="profil-mdp-confirmation">Confirme le nouveau mot de passe</label>
                <div className="champ-saisie">
                  <Lock size={18} className="champ-icone" aria-hidden="true" />
                  <input
                    id="profil-mdp-confirmation"
                    type={mdpVisible ? "text" : "password"}
                    value={confirmationMdp}
                    onChange={(e) => setConfirmationMdp(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
              <ZoneMessage message={erreur} />
              {boutons("Changer le mot de passe", motDePasse !== "" && confirmationMdp !== "")}
            </form>
          </LigneReglage>

          {/* Déconnexion : une ligne comme les autres, avec son propre bouton. */}
          <li className="profil-ligne">
            <div className="profil-ligne-resume">
              <span className="profil-ligne-titre">Session</span>
              <span className="profil-ligne-valeur">Connecté sur cet appareil</span>
              <button type="button" className="profil-modifier profil-deconnexion" onClick={deconnecter}>
                <LogOut size={16} aria-hidden="true" />
                Se déconnecter
              </button>
            </div>
          </li>
        </ul>
      </section>
    </div>
  );
}
