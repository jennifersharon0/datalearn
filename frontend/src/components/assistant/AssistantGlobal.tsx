// Fichier : src/components/assistant/AssistantGlobal.tsx
//
// L'assistant qu'on ouvre depuis n'importe quelle page. La mascotte attend
// en bas à droite. Un clic ouvre une fenêtre de discussion : petite fenêtre
// par-dessus la page sur ordinateur, plein écran sur téléphone.
//
// Chaque question part vers la route POST /assistant. Le backend cherche
// les passages utiles dans toutes les leçons et fait répondre le LLM à
// partir d'eux (voir assistant_global.py). La réponse arrive déjà découpée
// en paragraphes, avec les leçons citées : ce composant n'a qu'à les
// afficher.
//
// Le composant est placé dans Layout.tsx, donc il reste en vie quand on
// change de page : la conversation ne se perd pas en ouvrant une leçon
// citée.

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, ChevronRight, Send, X } from "lucide-react";

import { api, type LeconCitee, type ReponseAssistant } from "../../lib/apiClient";
import { Mascotte } from "./Mascotte";
import "./AssistantGlobal.css";

// Même limite que le backend (LONGUEUR_MAX_QUESTION dans main.py).
const LONGUEUR_MAX = 1000;

// Le message d'accueil, et les questions proposées pour démarrer.
const ACCUEIL =
  "Bonjour ! Je suis l'assistant de DataLearn. Pose-moi une question sur la data science ou l'IA et je te répondrai.";

// "\u00a0" est une espace insécable : le point d'interrogation ne se
// retrouve jamais seul au début d'une ligne.
const SUGGESTIONS = [
  "Précision et rappel, quelle différence\u00a0?",
  "C'est quoi un embedding\u00a0?",
  "Par où commencer en machine learning\u00a0?",
];

// Clé du navigateur qui retient que la bulle d'invitation a été vue.
const CLE_INVITATION = "datalearn-assistant-invitation-vue";

// En dessous de cette largeur, la fenêtre prend tout l'écran.
// Doit correspondre à la valeur utilisée dans AssistantGlobal.css.
const REQUETE_TELEPHONE = "(max-width: 639px)";

// Si la fenêtre reste fermée plus longtemps que ce délai, la conversation
// est effacée et l'assistant repart de l'accueil à la prochaine ouverture.
// Une fermeture courte (le temps de lire la leçon citée) garde l'échange.
const DELAI_OUBLI_MS = 30 * 60 * 1000; // 30 minutes

// Un message de la conversation.
type Message =
  | { id: number; auteur: "utilisateur"; texte: string }
  | { id: number; auteur: "assistant"; reponse: ReponseAssistant }
  | { id: number; auteur: "erreur"; texte: string };

// Un message avant qu'on lui donne son identifiant.
type NouveauMessage = Message extends infer M ? (M extends Message ? Omit<M, "id"> : never) : never;

// La lecture et l'écriture dans le stockage du navigateur peuvent échouer
// (navigation privée, stockage désactivé) : dans ce cas, on fait sans.
function lireStockage(cle: string): string | null {
  try {
    return window.localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrireStockage(cle: string, valeur: string) {
  try {
    window.localStorage.setItem(cle, valeur);
  } catch {
    // Rien de grave : la bulle d'invitation réapparaîtra simplement.
  }
}

function estTelephone(): boolean {
  return window.matchMedia(REQUETE_TELEPHONE).matches;
}

export function AssistantGlobal() {
  const [ouvert, setOuvert] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [saisie, setSaisie] = useState("");
  const [enAttente, setEnAttente] = useState(false);

  // La petite bulle "Une question sur un cours ?" s'affiche tant que
  // l'assistant n'a jamais été ouvert sur ce navigateur.
  const [invitation, setInvitation] = useState(() => lireStockage(CLE_INVITATION) === null);

  const prochainId = useRef(0);
  const listeRef = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLTextAreaElement>(null);
  const lanceurRef = useRef<HTMLButtonElement>(null);

  // Le moment où la fenêtre a été fermée pour la dernière fois.
  const fermeeLe = useRef<number | null>(null);

  // Le dernier message reste visible : on descend en bas de la liste à
  // chaque nouveau message.
  useEffect(() => {
    const liste = listeRef.current;
    if (liste) liste.scrollTop = liste.scrollHeight;
  }, [messages, enAttente, ouvert]);

  // Pendant que la fenêtre est ouverte : le curseur est placé dans le champ,
  // Échap la referme, et sur téléphone la page derrière ne défile plus.
  useEffect(() => {
    if (!ouvert) return;

    champRef.current?.focus();

    function surTouche(evenement: globalThis.KeyboardEvent) {
      if (evenement.key === "Escape") fermer();
    }
    document.addEventListener("keydown", surTouche);

    const debordementInitial = document.body.style.overflow;
    if (estTelephone()) document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", surTouche);
      document.body.style.overflow = debordementInitial;
    };
  }, [ouvert]);

  // La zone de saisie grandit avec le texte, jusqu'à environ quatre lignes.
  useEffect(() => {
    const champ = champRef.current;
    if (!champ) return;
    champ.style.height = "auto";
    champ.style.height = `${Math.min(champ.scrollHeight, 120)}px`;
  }, [saisie, ouvert]);

  function ouvrir() {
    // Fermée depuis trop longtemps : on repart d'une conversation vide.
    // Sauf si une réponse est encore en route, pour ne pas la perdre.
    const fermeeDepuis = fermeeLe.current === null ? 0 : Date.now() - fermeeLe.current;
    if (fermeeDepuis > DELAI_OUBLI_MS && !enAttente) {
      setMessages([]);
      setSaisie("");
    }

    setOuvert(true);
    if (invitation) {
      setInvitation(false);
      ecrireStockage(CLE_INVITATION, "1");
    }
  }

  // Ferme la fenêtre et rend le focus clavier au bouton de la mascotte.
  function fermer() {
    fermeeLe.current = Date.now();
    setOuvert(false);
    // Le bouton réapparaît après la fermeture : on attend qu'il soit affiché.
    window.setTimeout(() => lanceurRef.current?.focus(), 0);
  }

  function masquerInvitation() {
    setInvitation(false);
    ecrireStockage(CLE_INVITATION, "1");
  }

  function ajouter(message: NouveauMessage) {
    const id = prochainId.current++;
    setMessages((precedents) => [...precedents, { ...message, id } as Message]);
  }

  async function envoyer(question: string) {
    const texte = question.trim();
    if (!texte || enAttente) return;

    ajouter({ auteur: "utilisateur", texte });
    setSaisie("");
    setEnAttente(true);

    try {
      const reponse = await api.poserQuestionAssistant(texte);
      ajouter({ auteur: "assistant", reponse });
    } catch (erreur) {
      ajouter({ auteur: "erreur", texte: (erreur as Error).message });
    } finally {
      setEnAttente(false);
      champRef.current?.focus();
    }
  }

  function surEnvoi(evenement: FormEvent) {
    evenement.preventDefault();
    envoyer(saisie);
  }

  // Entrée envoie, Maj + Entrée passe à la ligne.
  function surToucheChamp(evenement: KeyboardEvent<HTMLTextAreaElement>) {
    if (evenement.key === "Enter" && !evenement.shiftKey) {
      evenement.preventDefault();
      envoyer(saisie);
    }
  }

  // Sur téléphone, ouvrir une leçon citée referme la fenêtre pour qu'on
  // voie la leçon. Sur ordinateur, la fenêtre reste ouverte à côté.
  function surLienLecon() {
    if (estTelephone()) {
      fermeeLe.current = Date.now();
      setOuvert(false);
    }
  }

  if (!ouvert) {
    return (
      <div className="ag-repos">
        {invitation && (
          <div className="ag-invitation">
            <p>Une question sur un cours ? Je suis là pour t'aider.</p>
            <button type="button" className="ag-invitation-fermer" onClick={masquerInvitation} aria-label="Masquer ce message">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}
        <button
          ref={lanceurRef}
          type="button"
          className="ag-lanceur"
          onClick={ouvrir}
          aria-label="Ouvrir l'assistant DataLearn"
          aria-haspopup="dialog"
        >
          <Mascotte cadrage="lanceur" taille={72} />
        </button>
      </div>
    );
  }

  return (
    <section className="ag-fenetre" role="dialog" aria-modal="false" aria-labelledby="ag-titre">
      <header className="ag-entete">
        {/* Sur téléphone, une flèche retour ; sur ordinateur, une croix. */}
        <button type="button" className="ag-entete-bouton ag-retour" onClick={fermer} aria-label="Fermer l'assistant">
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <span className="ag-avatar ag-avatar-grand">
          <Mascotte cadrage="tete" taille={44} />
        </span>
        <h2 id="ag-titre" className="ag-titre">
          Assistant DataLearn
        </h2>
        <button type="button" className="ag-entete-bouton ag-croix" onClick={fermer} aria-label="Fermer l'assistant">
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      {/* aria-live fait lire les nouvelles réponses aux lecteurs d'écran. */}
      <div className="ag-messages" ref={listeRef} aria-live="polite">
        <BulleAssistant>
          <p>{ACCUEIL}</p>
        </BulleAssistant>

        {messages.length === 0 && (
          <div className="ag-suggestions">
            {SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} type="button" className="ag-puce" onClick={() => envoyer(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {messages.map((message) => {
          if (message.auteur === "utilisateur") {
            return (
              <p key={message.id} className="ag-bulle ag-bulle-utilisateur">
                {message.texte}
              </p>
            );
          }
          if (message.auteur === "erreur") {
            return (
              <BulleAssistant key={message.id} erreur>
                <p>{message.texte}</p>
              </BulleAssistant>
            );
          }
          return <Reponse key={message.id} reponse={message.reponse} surLienLecon={surLienLecon} />;
        })}

        {enAttente && (
          <BulleAssistant>
            <span className="ag-points" role="status" aria-label="L'assistant écrit">
              <span />
              <span />
              <span />
            </span>
          </BulleAssistant>
        )}
      </div>

      <form className="ag-saisie" onSubmit={surEnvoi}>
        <textarea
          ref={champRef}
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={surToucheChamp}
          placeholder="Pose ta question…"
          rows={1}
          maxLength={LONGUEUR_MAX}
          aria-label="Ta question"
        />
        <button type="submit" className="ag-envoyer" disabled={enAttente || !saisie.trim()} aria-label="Envoyer la question">
          <Send size={18} aria-hidden="true" />
        </button>
      </form>
      <p className="ag-avertissement">L'assistant peut se tromper. Vérifie dans la leçon citée.</p>
    </section>
  );
}

// Une bulle de l'assistant, précédée de sa petite tête.
function BulleAssistant({ children, erreur = false }: { children: ReactNode; erreur?: boolean }) {
  return (
    <div className="ag-ligne-assistant">
      <span className="ag-avatar">
        <Mascotte cadrage="tete" taille={28} />
      </span>
      <div className={erreur ? "ag-bulle ag-bulle-assistant ag-bulle-erreur" : "ag-bulle ag-bulle-assistant"}>
        {children}
      </div>
    </div>
  );
}

// Une réponse complète : le texte, puis les leçons citées ou proposées.
function Reponse({ reponse, surLienLecon }: { reponse: ReponseAssistant; surLienLecon: () => void }) {
  return (
    <>
      <BulleAssistant>
        {reponse.paragraphes.map((paragraphe, position) => (
          <p key={position}>{paragraphe}</p>
        ))}
        {reponse.sources.map((lecon) => (
          <LienSource key={lecon.slug} lecon={lecon} surClic={surLienLecon} />
        ))}
      </BulleAssistant>

      {reponse.suggestions.length > 0 && (
        <div className="ag-suggestions ag-suggestions-lecons">
          {reponse.suggestions.map((lecon) => (
            <Link key={lecon.slug} to={`/lecons/${encodeURIComponent(lecon.slug)}`} className="ag-puce" onClick={surLienLecon}>
              {lecon.titre}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function LienSource({ lecon, surClic }: { lecon: LeconCitee; surClic: () => void }) {
  return (
    <Link to={`/lecons/${encodeURIComponent(lecon.slug)}`} className="ag-source" onClick={surClic}>
      <BookOpen size={17} aria-hidden="true" />
      <span className="ag-source-titre">
        <span className="ag-source-etiquette">Leçon citée</span>
        {lecon.titre}
      </span>
      <ChevronRight size={16} aria-hidden="true" />
    </Link>
  );
}
