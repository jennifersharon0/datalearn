// Fichier : src/pages/Categorie.tsx

import { useEffect, useMemo, useState } from "react";

// useParams lit la partie variable de l'adresse (le slug de la catégorie).
import { Link, useParams } from "react-router-dom";

// Icônes de la page.
import { ArrowLeft, ChevronRight, RotateCcw, TriangleAlert } from "lucide-react";

// Appels au backend et types.
import { api, type ProgressionSujet, type Sujet } from "../lib/apiClient";

// Outils sur les catégories (fichier categories.ts).
import { etatLecon, indexerProgression, regrouperParCategorie, type EtatLecon } from "../lib/categories";

// Vignette illustrée de la catégorie, affichée en grand dans l'en-tête.
import { VignetteCategorie } from "../components/VignetteCategorie";

// Styles propres à cette page.
import "./Categorie.css";

// Texte affiché sous le titre de chaque leçon, selon son état.
const LIBELLES: Record<EtatLecon, string> = {
  nouvelle: "Pas encore commencée",
  lue: "Leçon lue",
  reussie: "Quiz réussi",
};

// Indicateur d'état dessiné en SVG, pour obtenir exactement les trois formes
// voulues (une icône toute faite n'a pas de cercle à moitié rempli).
// Le cercle fait 24 pixels : centre en (12, 12), rayon 10.
function Indicateur({ etat }: { etat: EtatLecon }) {
  return (
    <svg className={`indicateur-etat ${etat}`} viewBox="0 0 24 24" aria-hidden="true">
      {/* Le contour, présent dans les trois cas. */}
      <circle cx="12" cy="12" r="10" className="indicateur-contour" />

      {/* Leçon lue : la moitié gauche du cercle est remplie.
          Le chemin part du haut (12, 2), trace un demi-cercle vers le bas
          (12, 22) en passant par la gauche, puis remonte tout droit. */}
      {etat === "lue" && <path d="M12 2 A10 10 0 0 0 12 22 Z" className="indicateur-remplissage" />}

      {/* Quiz réussi : cercle entièrement rempli, avec une coche blanche. */}
      {etat === "reussie" && (
        <>
          <circle cx="12" cy="12" r="10" className="indicateur-remplissage" />
          <path d="M7.5 12.5 L10.5 15.5 L16.5 9" className="indicateur-coche" />
        </>
      )}
    </svg>
  );
}

export function Categorie() {
  // Slug de la catégorie demandée dans l'adresse.
  const { slugCategorie } = useParams<{ slugCategorie: string }>();

  // Données chargées depuis le backend.
  const [sujets, setSujets] = useState<Sujet[] | null>(null);
  const [progression, setProgression] = useState<ProgressionSujet[] | null>(null);

  // Erreur de chargement et compteur pour réessayer.
  const [erreur, setErreur] = useState<string | null>(null);
  const [tentative, setTentative] = useState(0);

  // Chargement des sujets et de la progression, en même temps.
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

  // La catégorie qui correspond au slug de l'adresse (undefined si aucune).
  const categorie = useMemo(() => {
    if (!sujets || !progression) return undefined;
    return regrouperParCategorie(sujets, progression).find((c) => c.slug === slugCategorie);
  }, [sujets, progression, slugCategorie]);

  // Progression rangée par slug, pour connaître l'état de chaque leçon.
  const index = useMemo(() => indexerProgression(progression ?? []), [progression]);

  // Lien de retour, présent dans tous les cas.
  const lienRetour = (
    <Link to="/cours" className="lien-retour">
      <ArrowLeft size={18} aria-hidden="true" />
      Mes cours
    </Link>
  );

  // Erreur de chargement.
  if (erreur) {
    return (
      <div className="page">
        {lienRetour}
        <div className="etat-vide">
          <TriangleAlert size={32} aria-hidden="true" />
          <p>{erreur}</p>
          <button
            type="button"
            className="bouton bouton-secondaire"
            onClick={() => setTentative((n) => n + 1)}
          >
            <RotateCcw size={18} aria-hidden="true" />
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Chargement en cours.
  if (!sujets || !progression) {
    return (
      <div className="page" aria-busy="true" aria-label="Chargement de la catégorie">
        {lienRetour}
        <div className="squelette squelette-titre" />
        <div className="squelette squelette-bloc" />
      </div>
    );
  }

  // Le slug de l'adresse ne correspond à aucune catégorie (lien mal recopié...).
  if (!categorie) {
    return (
      <div className="page">
        {lienRetour}
        <div className="etat-vide">
          <p>Cette catégorie n'existe pas.</p>
          <Link to="/cours" className="bouton bouton-secondaire">
            Voir toutes les catégories
          </Link>
        </div>
      </div>
    );
  }

  const total = categorie.sujets.length;
  const pourcentage = Math.round((categorie.vues / total) * 100);

  // Prochaine leçon conseillée : la première qui n'a pas encore été ouverte.
  const prochaine = categorie.sujets.find((s) => etatLecon(s.slug, index) === "nouvelle");

  return (
    <div className="page">
      {lienRetour}

      {/* En-tête : grande vignette, puis nom, chiffres et barre de progression. */}
      <header className="categorie-entete">
        <VignetteCategorie nom={categorie.nom} grande />
        <div className="categorie-titres">
          <h1>{categorie.nom}</h1>
          <p className="texte-secondaire">
            {/* Les mots s'accordent avec le nombre : "1 consultée", "2 consultées". */}
            {total} leçons, {categorie.vues} {categorie.vues > 1 ? "consultées" : "consultée"},{" "}
            {categorie.reussies} quiz {categorie.reussies > 1 ? "réussis" : "réussi"}
          </p>
          <div
            className="barre-progression categorie-barre"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={categorie.vues}
            aria-label={`${categorie.vues} leçons consultées sur ${total}`}
          >
            <div style={{ width: `${pourcentage}%` }} />
          </div>
        </div>
      </header>

      {/* La liste des leçons, numérotées comme des chapitres. "ol" est une
          liste ordonnée : l'ordre des leçons a un sens. */}
      <ol className="liste-chapitres">
        {categorie.sujets.map((sujet, i) => {
          const etat = etatLecon(sujet.slug, index);
          const score = index.get(sujet.slug)?.meilleur_pourcentage;
          const estProchaine = sujet.slug === prochaine?.slug;

          return (
            <li key={sujet.slug}>
              <Link to={`/lecons/${sujet.slug}`} className="chapitre">
                <Indicateur etat={etat} />

                <span className="chapitre-texte">
                  <span className="chapitre-numero">Chapitre {i + 1}</span>
                  <span className="chapitre-titre">{sujet.titre}</span>
                  <span className="chapitre-etat">
                    {LIBELLES[etat]}
                    {/* Le meilleur score, s'il existe, est ajouté au libellé. */}
                    {score !== null && score !== undefined && ` · meilleur score ${score} %`}
                  </span>
                </span>

                {/* Étiquette sur la prochaine leçon conseillée. */}
                {estProchaine && <span className="etiquette-prochaine">À suivre</span>}

                <ChevronRight size={20} className="chapitre-fleche" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
