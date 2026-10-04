// Fichier : src/App.tsx


// ReactNode est le type d'un contenu affichable.
import type { ReactNode } from "react";

// BrowserRouter active la navigation par adresse, Routes et Route associent
// une adresse à une page, Navigate redirige vers une autre adresse.
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

// Nos composants et nos pages.
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Accueil } from "./pages/Accueil";
import { Cours } from "./pages/Cours";
import { Categorie } from "./pages/Categorie";
import { Lesson } from "./pages/Lesson";
import { Dashboard } from "./pages/Dashboard";
import { HistoriqueQuiz } from "./pages/HistoriqueQuiz";
import { NotionDuJour } from "./pages/NotionDuJour";
import { Profil } from "./pages/Profil";

// Écran affiché pendant que l'on vérifie si une session existe.
function EcranChargement() {
  return (
    <div className="ecran-chargement" aria-busy="true" aria-label="Chargement">
      <span className="spinner spinner-grand" aria-hidden="true" />
    </div>
  );
}

// Protège les pages réservées aux utilisateurs connectés.
// "children" est la page à protéger.
function RouteProtegee({ children }: { children: ReactNode }) {
  const { session, chargement } = useAuth();

  // Tant que la vérification n'est pas finie, on n'affiche rien de définitif.
  // Sinon, une personne connectée serait brièvement renvoyée vers /login.
  if (chargement) return <EcranChargement />;

  // Pas de session : direction la page de connexion.
  // "replace" remplace l'adresse dans l'historique, pour que le bouton
  // Retour du navigateur ne ramène pas sur la page protégée.
  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

// Empêche une personne déjà connectée de revoir la page de connexion.
function RoutePublique({ children }: { children: ReactNode }) {
  const { session, chargement } = useAuth();

  if (chargement) return <EcranChargement />;
  if (session) return <Navigate to="/" replace />;

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      {/* Le thème englobe tout, y compris la page de connexion. */}
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Page publique : connexion et inscription. */}
              <Route
                path="/login"
                element={
                  <RoutePublique>
                    <Login />
                  </RoutePublique>
                }
              />

              {/* Pages protégées, toutes affichées à l'intérieur du Layout.
                Cette Route n'a pas de "path" : elle sert seulement de cadre,
                et ses Routes enfants s'affichent dans l'Outlet du Layout. */}
              <Route
                element={
                  <RouteProtegee>
                    <Layout />
                  </RouteProtegee>
                }
              >
                {/* "index" désigne la page d'accueil, à l'adresse "/". */}
                <Route index element={<Accueil />} />
                {/* Mes cours : la liste des catégories, puis la page d'une catégorie.
                  ":slugCategorie" est la partie variable de l'adresse, lue par
                  useParams dans Categorie.tsx (ex : /cours/deep-learning). */}
                <Route path="cours" element={<Cours />} />
                <Route path="cours/:slugCategorie" element={<Categorie />} />
                {/* ":slug" est une partie variable, lue par useParams dans Lesson. */}
                <Route path="lecons/:slug" element={<Lesson />} />
                {/* Une notion encore jamais vue, proposée chaque jour. */}
                <Route path="notion-du-jour" element={<NotionDuJour />} />
                <Route path="tableau-de-bord" element={<Dashboard />} />
                {/* Historique complet des quiz, ouvert depuis "Ma progression". */}
                <Route path="tableau-de-bord/quiz" element={<HistoriqueQuiz />} />
                {/* Prénom, mot de passe, thème et déconnexion. */}
                <Route path="profil" element={<Profil />} />
              </Route>

              {/* Toute autre adresse renvoie vers l'accueil. */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
