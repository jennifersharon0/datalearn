# Archives : la première version du projet

Ce dossier garde les fichiers de la première version de DataLearn, un
chatbot qui fonctionnait dans le terminal, avant l'application web. Ils ne
sont plus utilisés, mais ils montrent comment le projet a évolué.

## Les étapes

1. **Reconnaître l'intention de l'utilisateur par TF-IDF**
   (`Chatbot_NLP_TF-IDF.py`) : le message était comparé à des phrases
   d'exemple, mot par mot.
2. **Passer aux embeddings** (`Chatbot_Embedding_SentenceTransformer.py`,
   `chatbot_embeddings.py`, `embedding_par_intention.py`,
   `test_embeddings.py`, `representations.py`) : les phrases étaient
   comparées par leur sens grâce à sentence-transformers, ce qui reconnaît
   aussi les reformulations.
3. **Confier la compréhension à un LLM** (`nlu_llm.py`, `chatbot.py`) :
   avec 190 sujets proches les uns des autres, la comparaison par
   similarité devenait peu fiable. Le LLM reçoit le catalogue complet et
   choisit directement le sujet et l'intention.
4. **Passer à l'application web** (racine du projet) : l'utilisateur
   choisit lui-même sa leçon dans l'interface, et l'assistant répond aux
   questions sur la leçon ouverte. La détection d'intention n'est plus
   nécessaire.

Les autres fichiers sont des essais (`attention_test.py`,
`transformer_test.py`, `test_groq.py`), d'anciennes données (`lessons.py`,
`quizzes.py`) l'ancienne connexion à Supabase (`auth_supabase.py`) et un premier essai
d'interface avec Streamlit (`app.py`).

Ces fichiers ne sont plus maintenus. Certains dépendent de bibliothèques
qui ne figurent pas dans requirements.txt (torch, sentence-transformers,
scikit-learn) : il faut les installer à part pour les relancer.