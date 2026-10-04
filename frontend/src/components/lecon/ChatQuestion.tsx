// Fichier : src/components/lecon/ChatQuestion.tsx
//
// Zone de questions de la page de leçon, présentée comme une conversation.
// Les questions de l'utilisateur apparaissent à droite, les réponses de
// l'assistant à gauche, et l'historique reste affiché tant qu'on reste sur
// la leçon.
//
// Chaque question est envoyée au backend (route /questions), qui la transmet
// au LLM avec le contenu de la leçon. L'assistant répond donc en s'appuyant
// sur le cours affiché, pas au hasard.

// useEffect sert au défilement automatique, useRef garde une référence vers
// un élément de la page ou une valeur qui ne doit pas relancer l'affichage.
// KeyboardEvent est le type d'un appui sur une touche.
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

// Icônes de la conversation.
import { Send, Sparkles } from "lucide-react";

// Fonctions d'appel au backend (fichier 2).
import { api } from "../../lib/apiClient";

// Ce que le composant reçoit de la page de leçon.
interface Proprietes {
  slug: string; // identifiant du sujet, envoyé au backend avec la question
  titreSujet: string; // titre affiché dans le message d'accueil
}

// Un message de la conversation.
interface Message {
  id: number; // identifiant unique, utilisé par React pour suivre chaque message
  auteur: "utilisateur" | "assistant";
  texte: string;
  enErreur?: boolean; // vrai si ce message signale une erreur
}

// Longueur maximale d'une question. Cette limite évite d'envoyer au LLM des
// textes énormes, qui coûteraient cher en quota sans rien apporter.
const LONGUEUR_MAX = 1000;

// Questions proposées quand la conversation est vide, pour aider à démarrer.
const SUGGESTIONS = [
  "Donne-moi un exemple concret",
  "À quoi ça sert en pratique ?",
  "Quelles sont les erreurs fréquentes ?",
];

export function ChatQuestion({ slug, titreSujet }: Proprietes) {
  // Tous les messages échangés depuis l'ouverture de la leçon.
  const [messages, setMessages] = useState<Message[]>([]);

  // Texte en cours de saisie.
  const [saisie, setSaisie] = useState("");

  // Vrai pendant que l'assistant prépare sa réponse.
  const [enAttente, setEnAttente] = useState(false);

  // Référence vers la zone qui contient les messages, pour la faire défiler.
  const listeRef = useRef<HTMLDivElement>(null);

  // Compteur utilisé pour donner un identifiant unique à chaque message.
  // useRef garde la valeur entre deux affichages sans en provoquer un nouveau.
  const prochainId = useRef(0);

  // Après chaque nouveau message, on fait défiler la zone jusqu'en bas pour
  // que le dernier message soit visible.
  useEffect(() => {
    const liste = listeRef.current;
    if (liste) {
      liste.scrollTop = liste.scrollHeight;
    }
  }, [messages, enAttente]);

  // Ajoute un message à la fin de la conversation.
  function ajouterMessage(auteur: Message["auteur"], texte: string, enErreur = false) {
    const id = prochainId.current++;
    // On passe par une fonction (precedents) pour partir de la liste la plus
    // récente, même si deux messages sont ajoutés très rapidement.
    setMessages((precedents) => [...precedents, { id, auteur, texte, enErreur }]);
  }

  // Envoie une question au backend et affiche la réponse.
  async function envoyerQuestion(question: string) {
    const questionNettoyee = question.trim();

    // Rien à envoyer, ou une réponse est déjà en cours de préparation.
    if (!questionNettoyee || enAttente) return;

    ajouterMessage("utilisateur", questionNettoyee);
    setSaisie("");
    setEnAttente(true);

    try {
      const reponse = await api.poserQuestion(slug, questionNettoyee);
      ajouterMessage("assistant", reponse);
    } catch (e) {
      // L'erreur s'affiche dans la conversation, comme un message de l'assistant.
      ajouterMessage("assistant", (e as Error).message, true);
    } finally {
      setEnAttente(false);
    }
  }

  // Envoi du formulaire (clic sur le bouton).
  function surEnvoi(evenement: FormEvent) {
    evenement.preventDefault();
    envoyerQuestion(saisie);
  }

  // Entrée envoie la question, Maj + Entrée passe à la ligne.
  function surTouche(evenement: KeyboardEvent<HTMLTextAreaElement>) {
    if (evenement.key === "Enter" && !evenement.shiftKey) {
      evenement.preventDefault();
      envoyerQuestion(saisie);
    }
  }

  return (
    <div className="chat">
      {/* Zone des messages. aria-live fait lire les nouvelles réponses aux
          lecteurs d'écran au fur et à mesure qu'elles arrivent. */}
      <div className="chat-messages" ref={listeRef} aria-live="polite">
        {/* Message d'accueil et suggestions, tant que la conversation est vide. */}
        {messages.length === 0 && (
          <div className="chat-accueil">
            <span className="chat-accueil-icone" aria-hidden="true">
              <Sparkles size={22} />
            </span>
            <p>Une question sur {titreSujet} ? Je m'appuie sur la leçon pour te répondre.</p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="puce"
                  onClick={() => envoyerQuestion(suggestion)}
                  disabled={enAttente}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Les messages, chacun dans une bulle alignée selon son auteur. */}
        {messages.map((message) => (
          <div
            key={message.id}
            className={[
              "bulle",
              message.auteur === "utilisateur" ? "bulle-utilisateur" : "bulle-assistant",
              message.enErreur ? "bulle-erreur" : "",
            ].join(" ")}
          >
            {message.texte}
          </div>
        ))}

        {/* Trois points animés pendant que l'assistant répond. */}
        {enAttente && (
          <div className="bulle bulle-assistant bulle-attente" aria-label="L'assistant écrit">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      {/* Zone de saisie. */}
      <form className="chat-saisie" onSubmit={surEnvoi}>
        <textarea
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={surTouche}
          placeholder="Pose ta question..."
          rows={1}
          maxLength={LONGUEUR_MAX}
          aria-label="Ta question"
          disabled={enAttente}
        />
        <button
          type="submit"
          className="bouton bouton-primaire bouton-carre"
          disabled={enAttente || !saisie.trim()}
          aria-label="Envoyer la question"
        >
          <Send size={18} aria-hidden="true" />
        </button>
      </form>

      {/* Compteur de caractères, affiché seulement quand on approche de la limite. */}
      {saisie.length > LONGUEUR_MAX * 0.8 && (
        <p className="chat-compteur">
          {saisie.length} / {LONGUEUR_MAX}
        </p>
      )}
    </div>
  );
}
