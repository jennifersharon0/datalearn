// Fichier : src/pages/NotionDuJour.tsx
//
// La page "Notion du jour" propose une leçon que l'utilisateur n'a encore jamais ouverte, choisie dans la suite logique de son parcours, et
// lui donne envie de l'ouvrir :
//  la vignette et le nom de la catégorie ;
//   le titre de la notion et sa place dans la catégorie ("Leçon 4 sur 12") ;
//   un aperçu en quelques lignes, demandé au LLM ;
//   une phrase qui explique pourquoi cette notion est proposée ;
//   deux boutons : commencer la leçon, ou en proposer une autre.
//
// Le choix lui-même est fait par notionDeJour.ts : la même notion toute la
// journée, la même que sur l'accueil. Le bouton "Une autre" avance d'un cran
// dans la liste des candidats (paramètre "decalage").
//
// Ouvrir cette page ne marque pas la leçon comme vue : seule l'ouverture de
// la leçon elle-même est enregistrée par le backend.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

// ReactMarkdown affiche le gras ou l'italique que le LLM peut mettre dans
// l'aperçu, sans jamais interpréter de HTML.
import ReactMarkdown from "react-markdown";

import { ArrowRight, PartyPopper, RotateCcw, Shuffle, TriangleAlert } from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import { api, type ProgressionSujet, type Sujet } from "../lib/apiClient";
import { slugCategorie } from "../lib/categories";
import { candidatsNotion, notionDuJour } from "../lib/notionDeJour";
import { VignetteCategorie } from "../components/VignetteCategorie";

import "./NotionDuJour.css";

export function NotionDuJour() {
  const { utilisateur } = useAuth();

  // Sujets et progression, null tant qu'ils ne sont pas arrivés.
  const [sujets, setSujets] = useState<Sujet[] | null>(null);
  const [progression, setProgression] = useState<ProgressionSujet[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tentative, setTentative] = useState(0);

  // Nombre de clics sur "Une autre" : 0 donne la notion du jour.
  const [decalage, setDecalage] = useState(0);

  // Aperçu de la notion affichée : null pendant le chargement, "" s'il n'a
  // pas pu être obtenu.
  const [apercu, setApercu] = useState<string | null>(null);

  // Aperçus déjà reçus, rangés par slug. Revenir sur une notion déjà vue
  // avec "Une autre" n'appelle donc pas le LLM une deuxième fois.
  // useRef garde cette mémoire d'un affichage à l'autre sans redessiner la page.
  const cacheApercus = useRef(new Map<string, string>());

  // Chargement des sujets et de la progression, en parallèle.
  useEffect(() => {
    let actif = true;
    setErreur(null);

    Promise.all([api.topics(), api.progression()])
      .then(([listeSujets, listeProgression]) => {
        if (!actif) return;
        setSujets(listeSujets);
        setProgression(listeProgression);
      })
      .catch((e: Error) => {
        if (actif) setErreur(e.message);
      });

    return () => {
      actif = false;
    };
  }, [tentative]);

  // Toutes les informations sur la notion proposée, calculées en une fois.
  const proposition = useMemo(() => {
    if (!sujets || !progression || !utilisateur) return null;

    const notion = notionDuJour(sujets, progression, utilisateur.id, decalage);
    const nombreCandidats = candidatsNotion(sujets, progression).length;
    if (!notion) return { notion: null, nombreCandidats };

    // Place de la notion dans sa catégorie : "Leçon 4 sur 12".
    const memeCategorie = sujets.filter((s) => s.categorie === notion.categorie);
    const position = memeCategorie.findIndex((s) => s.slug === notion.slug) + 1;

    // La catégorie est "commencée" si au moins une de ses leçons a été lue.
    // Cela change la phrase qui explique le choix.
    const lues = new Set(progression.filter((p) => p.lue).map((p) => p.sujet_slug));
    const commencee = memeCategorie.some((s) => lues.has(s.slug));

    return { notion, nombreCandidats, position, totalCategorie: memeCategorie.length, commencee };
  }, [sujets, progression, utilisateur, decalage]);

  // Slug de la notion affichée, ou null. Sert de déclencheur à l'aperçu.
  const slugNotion = proposition?.notion?.slug ?? null;

  // Chargement de l'aperçu à chaque nouvelle notion.
  useEffect(() => {
    if (!slugNotion) return;

    // Déjà reçu : on l'affiche tout de suite.
    const enCache = cacheApercus.current.get(slugNotion);
    if (enCache !== undefined) {
      setApercu(enCache);
      return;
    }

    let actif = true;
    setApercu(null);

    api
      .definition(slugNotion)
      .then((texte) => {
        cacheApercus.current.set(slugNotion, texte);
        if (actif) setApercu(texte);
      })
      .catch(() => {
        // L'aperçu est un plus : en cas d'échec (LLM indisponible, quota
        // atteint...), on n'affiche pas d'erreur, la page reste utilisable.
        if (actif) setApercu("");
      });

    return () => {
      actif = false;
    };
  }, [slugNotion]);

  // Date du jour en toutes lettres, par exemple "samedi 3 octobre".
  const dateTexte = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  // En-tête commun à tous les états de la page.
  const entete = (
    <header className="page-entete">
      <p className="notion-date">{dateTexte}</p>
      <h1>Notion du jour</h1>
      <p className="texte-secondaire">Une notion que tu n'as pas encore vue, choisie dans la suite de ton parcours.</p>
    </header>
  );

  if (erreur) {
    return (
      <div className="page notion-page">
        {entete}
        <div className="etat-vide">
          <TriangleAlert size={32} aria-hidden="true" />
          <p>{erreur}</p>
          <button type="button" className="bouton bouton-secondaire" onClick={() => setTentative((n) => n + 1)}>
            <RotateCcw size={18} aria-hidden="true" />
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!proposition) {
    return (
      <div className="page notion-page" aria-busy="true" aria-label="Chargement de la notion du jour">
        {entete}
        <div className="squelette notion-squelette" />
      </div>
    );
  }

  // Toutes les leçons ont déjà été ouvertes : plus rien de nouveau à proposer.
  if (!proposition.notion) {
    return (
      <div className="page notion-page">
        {entete}
        <div className="carte notion-fin">
          <span className="notion-fin-icone" aria-hidden="true">
            <PartyPopper size={26} />
          </span>
          <h2>Tu as tout exploré</h2>
          <p className="texte-secondaire">
            Tu as ouvert toutes les leçons du parcours. Le meilleur moyen de progresser maintenant, c'est de reprendre
            les quiz à revoir.
          </p>
          <Link to="/tableau-de-bord/quiz?filtre=a-revoir" className="bouton bouton-primaire">
            Voir les quiz à revoir
          </Link>
        </div>
      </div>
    );
  }

  const { notion, nombreCandidats, position, totalCategorie, commencee } = proposition;

  // Numéro de la proposition affichée, de 1 au nombre de candidats.
  const numero = (decalage % nombreCandidats) + 1;

  return (
    <div className="page notion-page">
      {entete}

      {/* La notion proposée. aria-live annonce le changement quand on clique
          sur "Une autre". */}
      <article className="notion-carte" aria-live="polite">
        <VignetteCategorie nom={notion.categorie} grande />

        <div className="notion-corps">
          <div className="notion-titres">
            <Link to={`/cours/${slugCategorie(notion.categorie)}`} className="notion-categorie">
              {notion.categorie}
            </Link>
            <h2>{notion.titre}</h2>
            <p className="texte-secondaire">
              Leçon {position} sur {totalCategorie}
            </p>
          </div>

          {/* Aperçu en quelques lignes. Rien n'est affiché si le LLM n'a pas
              pu répondre : le reste de la page suffit. */}
          {apercu === null ? (
            <div className="notion-apercu" aria-busy="true" aria-label="Chargement de l'aperçu">
              <span className="notion-apercu-titre">En bref</span>
              <span className="squelette notion-ligne" />
              <span className="squelette notion-ligne" />
              <span className="squelette notion-ligne courte" />
            </div>
          ) : (
            apercu !== "" && (
              <div className="notion-apercu">
                <span className="notion-apercu-titre">En bref</span>
                <div className="notion-apercu-texte">
                  <ReactMarkdown>{apercu}</ReactMarkdown>
                </div>
              </div>
            )
          )}

          {/* Pourquoi cette notion : la suite d'une catégorie commencée, ou
              une porte d'entrée vers une catégorie encore jamais ouverte. */}
          <p className="notion-pourquoi">
            {commencee
              ? `C'est la prochaine leçon de « ${notion.categorie} », une catégorie que tu as déjà commencée.`
              : `C'est la première leçon de « ${notion.categorie} », une catégorie que tu n'as pas encore ouverte.`}
          </p>

          <div className="notion-actions">
            <Link to={`/lecons/${encodeURIComponent(notion.slug)}`} className="bouton bouton-primaire">
              Commencer la leçon
              <ArrowRight size={18} aria-hidden="true" />
            </Link>

            {/* "Une autre" n'a de sens que s'il existe plusieurs candidats. */}
            {nombreCandidats > 1 && (
              <button type="button" className="bouton bouton-secondaire" onClick={() => setDecalage((n) => n + 1)}>
                <Shuffle size={18} aria-hidden="true" />
                Une autre
              </button>
            )}

            {nombreCandidats > 1 && (
              <span className="notion-compteur">
                Proposition {numero} sur {nombreCandidats}
              </span>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
