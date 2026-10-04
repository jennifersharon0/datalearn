// Fichier : src/pages/Cours.tsx


import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

// Icônes de la page.
import { ChevronRight, RotateCcw, Search, TriangleAlert, X } from "lucide-react";

// Appels au backend et types.
import { api, type ProgressionSujet, type Sujet } from "../lib/apiClient";

// Regroupement des sujets par catégorie (fichier categories.ts).
import { regrouperParCategorie } from "../lib/categories";

// Vignette illustrée de chaque catégorie.
import { VignetteCategorie } from "../components/VignetteCategorie";

// Styles propres à cette page.
import "./Cours.css";

// Met un texte en minuscules sans accents, pour que "regression" trouve
// aussi "Régression" (même fonction que dans l'ancienne page des sujets).
function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Nombre maximal de résultats affichés pendant une recherche.
const RESULTATS_MAX = 30;

export function Cours() {
  // Données chargées depuis le backend.
  const [sujets, setSujets] = useState<Sujet[] | null>(null);
  const [progression, setProgression] = useState<ProgressionSujet[] | null>(null);

  // Erreur de chargement et compteur pour réessayer.
  const [erreur, setErreur] = useState<string | null>(null);
  const [tentative, setTentative] = useState(0);

  // Texte tapé dans la barre de recherche.
  const [recherche, setRecherche] = useState("");

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

  // Les catégories avec leurs compteurs, recalculées seulement si les données changent.
  const categories = useMemo(
    () => (sujets && progression ? regrouperParCategorie(sujets, progression) : []),
    [sujets, progression],
  );

  // Leçons qui correspondent à la recherche (vide si rien n'est tapé).
  const resultats = useMemo(() => {
    const motCle = normaliser(recherche.trim());
    if (!sujets || !motCle) return [];
    return sujets.filter((s) => normaliser(s.titre).includes(motCle)).slice(0, RESULTATS_MAX);
  }, [sujets, recherche]);

  const enRecherche = recherche.trim() !== "";

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Mes cours</h1>
        <p className="texte-secondaire">
          {sujets ? `${sujets.length} leçons réparties en ${categories.length} catégories` : "Chargement..."}
        </p>
      </header>

      {/* Erreur de chargement. */}
      {erreur && (
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
      )}

      {/* Chargement : six cartes grises. */}
      {!erreur && !sujets && (
        <div className="grille-categories" aria-busy="true" aria-label="Chargement des cours">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="carte-categorie squelette" />
          ))}
        </div>
      )}

      {sujets && (
        <>
          {/* Recherche d'une leçon. */}
          <div className="recherche">
            <Search size={18} className="recherche-icone" aria-hidden="true" />
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher une leçon..."
              aria-label="Rechercher une leçon"
            />
            {recherche && (
              <button
                type="button"
                className="recherche-effacer"
                onClick={() => setRecherche("")}
                aria-label="Effacer la recherche"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Pendant une recherche : la liste des leçons trouvées. */}
          {enRecherche && (
            <section aria-label="Résultats de la recherche">
              {resultats.length === 0 ? (
                <p className="etat-vide">Aucune leçon ne correspond à cette recherche.</p>
              ) : (
                <ul className="liste-resultats">
                  {resultats.map((sujet) => (
                    <li key={sujet.slug}>
                      <Link to={`/lecons/${sujet.slug}`} className="resultat">
                        <span>
                          <span className="resultat-titre">{sujet.titre}</span>
                          <span className="resultat-categorie">{sujet.categorie}</span>
                        </span>
                        <ChevronRight size={18} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Sans recherche : les cartes des catégories. */}
          {!enRecherche && (
            <div className="grille-categories">
              {categories.map((categorie) => {
                const total = categorie.sujets.length;
                const pourcentage = Math.round((categorie.vues / total) * 100);

                return (
                  <Link key={categorie.slug} to={`/cours/${categorie.slug}`} className="carte-categorie">
                    {/* Illustration en haut de la carte. */}
                    <VignetteCategorie nom={categorie.nom} />

                    {/* Partie texte, sous l'illustration. */}
                    <div className="carte-categorie-corps">
                      <h2 className="carte-categorie-nom">{categorie.nom}</h2>
                      <p className="carte-categorie-detail">
                        {total} {total > 1 ? "leçons" : "leçon"}
                      </p>

                      {/* Barre de progression : part des leçons déjà ouvertes. */}
                      <div className="carte-categorie-progression">
                        <div
                          className="barre-progression"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={total}
                          aria-valuenow={categorie.vues}
                          aria-label={`${categorie.vues} leçons consultées sur ${total}`}
                        >
                          <div style={{ width: `${pourcentage}%` }} />
                        </div>
                        <span>
                          {categorie.vues} / {total}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
