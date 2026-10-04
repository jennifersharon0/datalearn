// Fichier : src/pages/Lesson.tsx
//
// Page d'une leçon. Elle charge la leçon demandée dans l'adresse
// (par exemple /lecons/regression_lineaire) et organise son contenu en trois
// onglets : la leçon elle-même, les questions à l'assistant, et le quiz.
//
// Les onglets évitent une page interminable, surtout sur téléphone.
// Les trois contenus restent chargés en même temps et seul l'onglet choisi
// est visible : passer d'un onglet à l'autre ne fait donc pas perdre la
// conversation ou les réponses déjà cochées dans le quiz.
//
// La page connaît aussi la place de la leçon dans sa catégorie : le lien de
// retour ramène à la catégorie, et un lien en bas de page mène directement
// à la leçon suivante, pour enchaîner les chapitres.

import { useEffect, useMemo, useState } from "react";

// useParams lit les paramètres de l'adresse (ici, le slug du sujet).
import { Link, useParams } from "react-router-dom";

// ReactMarkdown transforme le texte Markdown de la leçon en vrais éléments
// HTML (titres, gras, listes). remarkBreaks conserve les retours à la ligne
// simples, que le Markdown standard ignorerait.
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

// Icônes de la page.
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  MessageCircle,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";

// Appels au backend, types et type d'erreur.
import { api, ErreurApi, type Lecon, type Sujet } from "../lib/apiClient";

// Adresse de la catégorie à partir de son nom (fichier categories.ts).
import { slugCategorie } from "../lib/categories";

// Les deux composants de la page.
import { ChatQuestion } from "../components/lecon/ChatQuestion";
import { Quiz } from "../components/lecon/Quiz";

// Styles propres à cette page (mise en forme du texte de la leçon).
import "./Lesson.css";

// Les trois onglets possibles.
type Onglet = "lecon" | "questions" | "quiz";

// Description des onglets, utilisée pour construire la barre d'onglets.
const ONGLETS: { id: Onglet; libelle: string; Icone: typeof BookOpen }[] = [
  { id: "lecon", libelle: "Leçon", Icone: BookOpen },
  { id: "questions", libelle: "Questions", Icone: MessageCircle },
  { id: "quiz", libelle: "Quiz", Icone: Target },
];

// Vitesse de lecture moyenne, en mots par minute, pour estimer la durée.
const MOTS_PAR_MINUTE = 200;

// Estime le temps de lecture en minutes (au moins 1 minute).
function tempsDeLecture(texte: string): number {
  const nombreDeMots = texte.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(nombreDeMots / MOTS_PAR_MINUTE));
}

// Le composant qui s'affiche pour l'adresse /lecons/:slug.
// Il lit le slug, puis délègue l'affichage à ContenuLecon. La prop "key"
// force React à repartir d'un composant neuf quand on change de leçon :
// conversation, quiz et onglet choisi sont alors remis à zéro. C'est ce qui
// permet au lien "Leçon suivante" de fonctionner proprement.
export function Lesson() {
  const { slug } = useParams<{ slug: string }>();

  if (!slug) {
    return null;
  }

  return <ContenuLecon key={slug} slug={slug} />;
}

// Le vrai contenu de la page, pour un slug donné.
function ContenuLecon({ slug }: { slug: string }) {
  // Leçon chargée (null tant qu'elle n'est pas arrivée).
  const [lecon, setLecon] = useState<Lecon | null>(null);

  // Liste de tous les sujets, pour situer la leçon dans sa catégorie.
  const [sujets, setSujets] = useState<Sujet[] | null>(null);

  // Erreur de chargement, conservée entière pour connaître son code (404...).
  const [erreur, setErreur] = useState<ErreurApi | Error | null>(null);

  // Onglet affiché.
  const [onglet, setOnglet] = useState<Onglet>("lecon");

  // Définition rapide, chargée seulement si l'utilisateur la demande.
  const [definition, setDefinition] = useState<string | null>(null);
  const [definitionEnCours, setDefinitionEnCours] = useState(false);

  // Chargement de la leçon.
  useEffect(() => {
    let actif = true;

    api
      .lecon(slug)
      .then((donnees) => {
        if (actif) setLecon(donnees);
      })
      .catch((e: Error) => {
        if (actif) setErreur(e);
      });

    // La liste des sujets est chargée à part : si elle échoue, la leçon
    // s'affiche quand même, seuls les liens de navigation manqueront.
    api
      .topics()
      .then((liste) => {
        if (actif) setSujets(liste);
      })
      .catch(() => {});

    return () => {
      actif = false;
    };
  }, [slug]);

  // Leçon suivante dans la même catégorie (undefined si c'est la dernière).
  const suivante = useMemo(() => {
    if (!sujets || !lecon) return undefined;
    const memeCategorie = sujets.filter((s) => s.categorie === lecon.categorie);
    const position = memeCategorie.findIndex((s) => s.slug === slug);
    return position >= 0 ? memeCategorie[position + 1] : undefined;
  }, [sujets, lecon, slug]);

  // Demande une définition courte au LLM. On ne la charge pas
  // automatiquement, pour ne pas consommer de quota à chaque visite.
  async function chargerDefinition() {
    setDefinitionEnCours(true);
    try {
      setDefinition(await api.definition(slug));
    } catch (e) {
      setDefinition((e as Error).message);
    } finally {
      setDefinitionEnCours(false);
    }
  }

  // Change d'onglet et remonte en haut de la page, pour que le nouvel
  // onglet commence bien à son début.
  function ouvrirOnglet(id: Onglet) {
    setOnglet(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Lien de retour : vers la catégorie de la leçon si on la connaît,
  // sinon vers la liste de tous les cours.
  const lienRetour = (
    <Link to={lecon ? `/cours/${slugCategorie(lecon.categorie)}` : "/cours"} className="lien-retour">
      <ArrowLeft size={18} aria-hidden="true" />
      {lecon ? lecon.categorie : "Mes cours"}
    </Link>
  );

  // Cas d'erreur, avec un message spécial si le sujet n'existe pas.
  if (erreur) {
    const introuvable = erreur instanceof ErreurApi && erreur.statut === 404;
    return (
      <div className="page">
        {lienRetour}
        <div className="etat-vide">
          <TriangleAlert size={32} aria-hidden="true" />
          <p>{introuvable ? "Ce sujet n'existe pas ou n'est pas encore disponible." : erreur.message}</p>
        </div>
      </div>
    );
  }

  // Chargement : squelette du titre et du texte.
  if (!lecon) {
    return (
      <div className="page" aria-busy="true" aria-label="Chargement de la leçon">
        {lienRetour}
        <div className="squelette squelette-titre" />
        <div className="squelette squelette-bloc" />
      </div>
    );
  }

  return (
    <div className="page page-lecon">
      {lienRetour}

      {/* En-tête : titre et durée de lecture. La catégorie n'est pas répétée
          ici : elle apparaît déjà dans le lien de retour, juste au-dessus. */}
      <header className="page-entete">
        <h1>{lecon.titre}</h1>
        <p className="texte-secondaire meta-lecon">
          <Clock size={16} aria-hidden="true" />
          {tempsDeLecture(lecon.contenu)} min de lecture
        </p>
      </header>

      {/* Barre d'onglets. Les attributs role et aria relient chaque onglet
          au panneau qu'il affiche, pour les lecteurs d'écran. */}
      <div className="onglets" role="tablist" aria-label="Sections de la leçon">
        {ONGLETS.map(({ id, libelle, Icone }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`onglet-${id}`}
            aria-selected={onglet === id}
            aria-controls={`panneau-${id}`}
            className={onglet === id ? "onglet actif" : "onglet"}
            onClick={() => ouvrirOnglet(id)}
          >
            <Icone size={18} aria-hidden="true" />
            {libelle}
          </button>
        ))}
      </div>

      {/* Panneau 1 : la leçon. L'attribut hidden masque les panneaux
          inactifs sans les retirer de la page. */}
      <section
        id="panneau-lecon"
        role="tabpanel"
        aria-labelledby="onglet-lecon"
        hidden={onglet !== "lecon"}
      >
        {/* Encadré "En bref" avec la définition courte, à la demande. */}
        <div className="encadre">
          <div className="encadre-titre">
            <Sparkles size={18} aria-hidden="true" />
            En bref
          </div>
          {definition ? (
            <p>{definition}</p>
          ) : (
            <button
              type="button"
              className="bouton bouton-fantome"
              onClick={chargerDefinition}
              disabled={definitionEnCours}
            >
              {definitionEnCours && <span className="spinner" aria-hidden="true" />}
              {definitionEnCours ? "Rédaction..." : "Obtenir une définition rapide"}
            </button>
          )}
        </div>

        {/* Le texte de la leçon, mis en forme à partir de son Markdown.
            ReactMarkdown n'exécute jamais de HTML ni de script contenu dans
            le texte : il ne fait que le mettre en forme, ce qui le rend sûr
            même pour un contenu généré par un LLM. */}
        <article className="carte texte-lecon">
          <ReactMarkdown remarkPlugins={[remarkBreaks]}>{lecon.contenu}</ReactMarkdown>
        </article>

        {/* Invitation à passer au quiz en fin de lecture. */}
        <div className="suite-lecon">
          <p>Tu as terminé la lecture ?</p>
          <button type="button" className="bouton bouton-primaire" onClick={() => ouvrirOnglet("quiz")}>
            <Target size={18} aria-hidden="true" />
            Passer au quiz
          </button>
        </div>
      </section>

      {/* Panneau 2 : la conversation avec l'assistant. */}
      <section
        id="panneau-questions"
        role="tabpanel"
        aria-labelledby="onglet-questions"
        hidden={onglet !== "questions"}
      >
        <ChatQuestion slug={slug} titreSujet={lecon.titre} />
      </section>

      {/* Panneau 3 : le quiz. */}
      <section id="panneau-quiz" role="tabpanel" aria-labelledby="onglet-quiz" hidden={onglet !== "quiz"}>
        <Quiz slug={slug} />
      </section>

      {/* Lien vers la leçon suivante, visible quel que soit l'onglet ouvert.
          Pour la dernière leçon d'une catégorie, il ramène à la catégorie. */}
      {sujets && (
        <nav className="navigation-lecon" aria-label="Navigation entre les leçons">
          {suivante ? (
            <Link to={`/lecons/${suivante.slug}`} className="lecon-suivante">
              <span>
                <span className="lecon-suivante-etiquette">Leçon suivante</span>
                <span className="lecon-suivante-titre">{suivante.titre}</span>
              </span>
              <ArrowRight size={22} aria-hidden="true" />
            </Link>
          ) : (
            <Link to={`/cours/${slugCategorie(lecon.categorie)}`} className="lecon-suivante">
              <span>
                <span className="lecon-suivante-etiquette">Fin de la catégorie</span>
                <span className="lecon-suivante-titre">Revenir à {lecon.categorie}</span>
              </span>
              <ArrowRight size={22} aria-hidden="true" />
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
