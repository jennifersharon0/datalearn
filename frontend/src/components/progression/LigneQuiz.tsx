// Fichier : src/components/progression/LigneQuiz.tsx


import { Link } from "react-router-dom";

import type { HistoriqueQuizLigne } from "../../lib/apiClient";
import { formaterJourCourt, quizReussi } from "../../lib/statistiques";

interface Proprietes {
  quiz: HistoriqueQuizLigne;
  titre: string | undefined; // titre lisible du sujet, s'il existe encore
}

export function LigneQuiz({ quiz, titre }: Proprietes) {
  const reussi = quizReussi(quiz);

  return (
    <li>
      {/* Lien vers la leçon. Si le sujet n'existe plus, on affiche son
          slug à la place du titre. encodeURIComponent protège l'adresse
          contre les caractères spéciaux. */}
      <Link to={`/lecons/${encodeURIComponent(quiz.sujet_slug)}`} className="tdb-historique-sujet">
        {titre ?? quiz.sujet_slug}
      </Link>
      <span className="tdb-historique-date">{formaterJourCourt(quiz.date)}</span>

      {/* Le score est écrit en entier, et le mot "réussi" ou "à revoir"
          accompagne la couleur de la pastille : la couleur seule ne porte
          jamais l'information. */}
      <span className={reussi ? "tdb-score reussi" : "tdb-score a-revoir"}>
        {quiz.score} / {quiz.total}
        <span className="tdb-score-etat">{reussi ? "réussi" : "à revoir"}</span>
      </span>
    </li>
  );
}
