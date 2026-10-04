# Fichier : topics.py
#
# Le catalogue des sujets du projet : 190 sujets répartis en 16 catégories.
# C'est la source de vérité sur ce qui est enseigné. generer_base_connaissances.py
# le parcourt pour créer chaque leçon, et l'ordre des sujets à l'intérieur
# d'une catégorie est aussi l'ordre d'apprentissage proposé dans l'interface.
#
# Chaque sujet est identifié par un slug : un nom technique en minuscules,
# sans accents ni espaces (ex : "regression_lineaire"). Les slugs servent
# dans les adresses web et dans la base de données, ils ne doivent donc
# jamais changer une fois utilisés. Le titre affiché à l'écran est défini
# à part, dans TITRES, et peut être modifié librement.


# Catalogue : pour chaque catégorie, la liste ordonnée de ses sujets.
TOPICS = {

    "Fondamentaux de la Data Science": [
        "data_science_definition", "cycle_de_vie_projet_data",
        "types_de_donnees", "data_wrangling", "feature_engineering",
        "exploration_de_donnees_eda", "donnees_manquantes",
        "outliers_valeurs_aberrantes", "echantillonnage",
        "biais_variance", "train_test_split", "validation_croisee",
    ],

    "Mathématiques & Statistiques": [
        "algebre_lineaire_pour_ml", "vecteurs_et_matrices",
        "derivees_et_gradients", "probabilites_de_base",
        "distributions_de_probabilite", "loi_normale",
        "esperance_variance", "theoreme_central_limite",
        "tests_d_hypothese", "p_value", "correlation_vs_causalite",
        "regression_lineaire_maths", "bayes_theoreme",
        "entropie_et_information", "optimisation_convexe",
    ],

    "Programmation & Outils": [
        "python_pour_la_data", "numpy", "pandas", "sql_bases",
        "git_versioning", "environnements_virtuels",
        "notebooks_jupyter", "apis_rest", "web_scraping",
        "structures_de_donnees_algorithmes",
    ],

    "Machine Learning Classique": [
        "machine_learning_definition", "apprentissage_supervise",
        "apprentissage_non_supervise", "regression_lineaire",
        "regression_logistique", "arbres_de_decision",
        "random_forest", "gradient_boosting", "xgboost",
        "svm_machines_a_vecteurs_de_support", "knn",
        "naive_bayes", "clustering_kmeans", "clustering_hierarchique",
        "dbscan", "reduction_de_dimension_pca", "overfitting_underfitting",
        "regularisation_l1_l2", "metriques_de_classification",
        "metriques_de_regression",
    ],

    "Deep Learning": [
        "reseau_de_neurones_perceptron", "fonctions_d_activation",
        "backpropagation", "descente_de_gradient", "optimiseurs_adam_sgd",
        "batch_normalization", "dropout", "cnn_reseaux_convolutifs",
        "rnn_reseaux_recurrents", "lstm_gru", "transfer_learning",
        "autoencodeurs", "gans_reseaux_antagonistes", "vanishing_gradient",
        "hyperparametres_deep_learning",
    ],

    "NLP (Traitement du Langage)": [
        "nlp_definition", "tokenisation", "stemming_lemmatisation",
        "tf_idf", "word2vec", "glove", "pos_tagging",
        "reconnaissance_d_entites_nommees_ner", "analyse_de_sentiment",
        "modeles_seq2seq", "mecanisme_d_attention", "bpe_byte_pair_encoding",
    ],

    "LLMs & Prompt Engineering": [
        "grands_modeles_de_langage_llm", "architecture_transformer",
        "tokenizer_llm", "fine_tuning", "rlhf", "prompt_engineering",
        "few_shot_learning", "chain_of_thought", "context_window",
        "hallucinations_llm", "quantization_de_modeles", "lora_qlora",
        "agents_llm", "function_calling", "mixture_of_experts",
    ],

    "Embeddings & Recherche Vectorielle": [
        "embeddings_definition", "similarite_cosinus",
        "sentence_transformers", "bases_de_donnees_vectorielles",
        "recherche_approximative_ann", "reduction_de_dimension_tsne",
        "reduction_de_dimension_umap", "clustering_d_embeddings",
    ],

    "RAG & Systèmes de Récupération": [
        "rag_definition", "chunking_de_documents",
        "pipeline_de_retrieval", "reranking", "recherche_hybride",
        "faiss", "chroma_db", "evaluation_d_un_systeme_rag",
    ],

    "Recherche Opérationnelle & Optimisation": [
        "recherche_operationnelle_definition", "programmation_lineaire",
        "algorithme_du_simplexe", "programmation_dynamique",
        "theorie_des_graphes", "probleme_du_voyageur_de_commerce",
        "probleme_d_affectation", "optimisation_combinatoire",
        "algorithmes_genetiques", "recuit_simule",
        "gestion_de_files_d_attente", "optimisation_sous_contraintes",
    ],

    "MLOps & Déploiement": [
        "mlops_definition", "versioning_de_modeles", "ci_cd_pour_ml",
        "monitoring_de_modeles_en_production", "data_drift_model_drift",
        "conteneurisation_docker", "api_de_modele_fastapi",
        "scalabilite_des_modeles", "ab_testing", "feature_store",
    ],

    "Data Engineering": [
        "etl_definition", "pipelines_de_donnees",
        "bases_de_donnees_sql_vs_nosql", "big_data_definition",
        "apache_spark", "data_warehousing", "streaming_de_donnees",
        "orchestration_airflow", "qualite_des_donnees",
        "architecture_data_lake",
    ],

    "Visualisation de Données": [
        "principes_de_dataviz", "matplotlib", "seaborn", "plotly",
        "choix_du_bon_graphique", "storytelling_avec_la_donnee",
        "dashboards_interactifs", "visualisation_de_donnees_multidimensionnelles",
    ],

    "Éthique & IA Responsable": [
        "biais_algorithmique", "explicabilite_ia_xai", "shap_lime",
        "vie_privee_et_donnees", "ia_generative_et_droits_d_auteur",
        "reglementation_rgpd", "ai_act_europeen", "ia_frugale",
    ],

    "Apprentissage par Renforcement": [
        "reinforcement_learning_definition", "processus_de_decision_markovien",
        "q_learning", "politique_et_recompense", "deep_reinforcement_learning",
        "exploration_vs_exploitation", "reward_shaping", "multi_agent_rl",
    ],

    "Outils & Plateformes Récentes": [
        "dataiku", "make_automatisation", "n8n_automatisation",
        "zapier", "knime", "databricks", "snowflake",
        "dbt_data_build_tool", "langchain", "llamaindex",
        "huggingface_hub", "mlflow", "weights_and_biases",
        "streamlit", "gradio", "ollama_plateforme", "groq_plateforme",
        "bases_vectorielles_pinecone_weaviate_qdrant",
        "automl_datarobot_h2o",
    ],
}


# Titre affiché pour chaque sujet, avec accents et majuscules corrects.
# Un slug ne peut pas contenir d'accents, et le deviner à partir du slug
# donnait des titres comme "Types De Donnees" : on les écrit donc à la main.
TITRES = {
    "data_science_definition": "Qu'est-ce que la data science ?",
    "cycle_de_vie_projet_data": "Le cycle de vie d'un projet data",
    "types_de_donnees": "Les types de données",
    "data_wrangling": "Data wrangling : préparer les données",
    "feature_engineering": "Feature engineering",
    "exploration_de_donnees_eda": "Analyse exploratoire des données (EDA)",
    "donnees_manquantes": "Les données manquantes",
    "outliers_valeurs_aberrantes": "Outliers et valeurs aberrantes",
    "echantillonnage": "L'échantillonnage",
    "biais_variance": "Le compromis biais-variance",
    "train_test_split": "Séparer les données d'entraînement et de test (train/test split)",
    "validation_croisee": "La validation croisée",
    "algebre_lineaire_pour_ml": "Algèbre linéaire pour le machine learning",
    "vecteurs_et_matrices": "Vecteurs et matrices",
    "derivees_et_gradients": "Dérivées et gradients",
    "probabilites_de_base": "Les bases des probabilités",
    "distributions_de_probabilite": "Les distributions de probabilité",
    "loi_normale": "La loi normale",
    "esperance_variance": "Espérance et variance",
    "theoreme_central_limite": "Le théorème central limite",
    "tests_d_hypothese": "Les tests d'hypothèse",
    "p_value": "La p-value",
    "correlation_vs_causalite": "Corrélation et causalité",
    "regression_lineaire_maths": "Les mathématiques de la régression linéaire",
    "bayes_theoreme": "Le théorème de Bayes",
    "entropie_et_information": "Entropie et théorie de l'information",
    "optimisation_convexe": "L'optimisation convexe",
    "python_pour_la_data": "Python pour la data",
    "numpy": "NumPy",
    "pandas": "pandas",
    "sql_bases": "Les bases de SQL",
    "git_versioning": "Git et le versioning de code",
    "environnements_virtuels": "Les environnements virtuels",
    "notebooks_jupyter": "Les notebooks Jupyter",
    "apis_rest": "Les API REST",
    "web_scraping": "Le web scraping",
    "structures_de_donnees_algorithmes": "Structures de données et algorithmes",
    "machine_learning_definition": "Qu'est-ce que le machine learning ?",
    "apprentissage_supervise": "L'apprentissage supervisé",
    "apprentissage_non_supervise": "L'apprentissage non supervisé",
    "regression_lineaire": "La régression linéaire",
    "regression_logistique": "La régression logistique",
    "arbres_de_decision": "Les arbres de décision",
    "random_forest": "Random forest",
    "gradient_boosting": "Le gradient boosting",
    "xgboost": "XGBoost",
    "svm_machines_a_vecteurs_de_support": "Machines à vecteurs de support (SVM)",
    "knn": "Les k plus proches voisins (k-NN)",
    "naive_bayes": "Naive Bayes",
    "clustering_kmeans": "Le clustering k-means",
    "clustering_hierarchique": "Le clustering hiérarchique",
    "dbscan": "DBSCAN",
    "reduction_de_dimension_pca": "Réduction de dimension avec la PCA",
    "overfitting_underfitting": "Surapprentissage et sous-apprentissage",
    "regularisation_l1_l2": "La régularisation L1 et L2",
    "metriques_de_classification": "Les métriques de classification",
    "metriques_de_regression": "Les métriques de régression",
    "reseau_de_neurones_perceptron": "Réseaux de neurones et perceptron",
    "fonctions_d_activation": "Les fonctions d'activation",
    "backpropagation": "La rétropropagation (backpropagation)",
    "descente_de_gradient": "La descente de gradient",
    "optimiseurs_adam_sgd": "Les optimiseurs : SGD et Adam",
    "batch_normalization": "La batch normalization",
    "dropout": "Le dropout",
    "cnn_reseaux_convolutifs": "Les réseaux convolutifs (CNN)",
    "rnn_reseaux_recurrents": "Les réseaux récurrents (RNN)",
    "lstm_gru": "LSTM et GRU",
    "transfer_learning": "Le transfer learning",
    "autoencodeurs": "Les autoencodeurs",
    "gans_reseaux_antagonistes": "Les réseaux antagonistes génératifs (GAN)",
    "vanishing_gradient": "Le problème du gradient qui disparaît",
    "hyperparametres_deep_learning": "Les hyperparamètres en deep learning",
    "nlp_definition": "Qu'est-ce que le NLP ?",
    "tokenisation": "La tokenisation",
    "stemming_lemmatisation": "Stemming et lemmatisation",
    "tf_idf": "TF-IDF",
    "word2vec": "Word2Vec",
    "glove": "GloVe",
    "pos_tagging": "L'étiquetage grammatical (POS tagging)",
    "reconnaissance_d_entites_nommees_ner": "La reconnaissance d'entités nommées (NER)",
    "analyse_de_sentiment": "L'analyse de sentiment",
    "modeles_seq2seq": "Les modèles seq2seq",
    "mecanisme_d_attention": "Le mécanisme d'attention",
    "bpe_byte_pair_encoding": "Le Byte Pair Encoding (BPE)",
    "grands_modeles_de_langage_llm": "Les grands modèles de langage (LLM)",
    "architecture_transformer": "L'architecture Transformer",
    "tokenizer_llm": "Le tokenizer d'un LLM",
    "fine_tuning": "Le fine-tuning",
    "rlhf": "L'apprentissage par renforcement avec retour humain (RLHF)",
    "prompt_engineering": "Le prompt engineering",
    "few_shot_learning": "Le few-shot learning",
    "chain_of_thought": "Le raisonnement étape par étape (chain of thought)",
    "context_window": "La fenêtre de contexte",
    "hallucinations_llm": "Les hallucinations des LLM",
    "quantization_de_modeles": "La quantization des modèles",
    "lora_qlora": "LoRA et QLoRA",
    "agents_llm": "Les agents LLM",
    "function_calling": "Le function calling",
    "mixture_of_experts": "Le mixture of experts (MoE)",
    "embeddings_definition": "Qu'est-ce qu'un embedding ?",
    "similarite_cosinus": "La similarité cosinus",
    "sentence_transformers": "Sentence Transformers",
    "bases_de_donnees_vectorielles": "Les bases de données vectorielles",
    "recherche_approximative_ann": "La recherche approximative des plus proches voisins (ANN)",
    "reduction_de_dimension_tsne": "Réduction de dimension avec t-SNE",
    "reduction_de_dimension_umap": "Réduction de dimension avec UMAP",
    "clustering_d_embeddings": "Le clustering d'embeddings",
    "rag_definition": "Qu'est-ce que le RAG ?",
    "chunking_de_documents": "Le découpage de documents (chunking)",
    "pipeline_de_retrieval": "Le pipeline de récupération (retrieval)",
    "reranking": "Le reranking",
    "recherche_hybride": "La recherche hybride",
    "faiss": "FAISS",
    "chroma_db": "ChromaDB",
    "evaluation_d_un_systeme_rag": "Évaluer un système RAG",
    "recherche_operationnelle_definition": "Qu'est-ce que la recherche opérationnelle ?",
    "programmation_lineaire": "La programmation linéaire",
    "algorithme_du_simplexe": "L'algorithme du simplexe",
    "programmation_dynamique": "La programmation dynamique",
    "theorie_des_graphes": "La théorie des graphes",
    "probleme_du_voyageur_de_commerce": "Le problème du voyageur de commerce",
    "probleme_d_affectation": "Le problème d'affectation",
    "optimisation_combinatoire": "L'optimisation combinatoire",
    "algorithmes_genetiques": "Les algorithmes génétiques",
    "recuit_simule": "Le recuit simulé",
    "gestion_de_files_d_attente": "La théorie des files d'attente",
    "optimisation_sous_contraintes": "L'optimisation sous contraintes",
    "mlops_definition": "Qu'est-ce que le MLOps ?",
    "versioning_de_modeles": "Le versioning de modèles",
    "ci_cd_pour_ml": "CI/CD pour le machine learning",
    "monitoring_de_modeles_en_production": "Surveiller un modèle en production",
    "data_drift_model_drift": "Data drift et model drift",
    "conteneurisation_docker": "La conteneurisation avec Docker",
    "api_de_modele_fastapi": "Exposer un modèle avec FastAPI",
    "scalabilite_des_modeles": "La scalabilité des modèles",
    "ab_testing": "L'A/B testing",
    "feature_store": "Le feature store",
    "etl_definition": "Qu'est-ce que l'ETL ?",
    "pipelines_de_donnees": "Les pipelines de données",
    "bases_de_donnees_sql_vs_nosql": "Bases de données SQL et NoSQL",
    "big_data_definition": "Qu'est-ce que le big data ?",
    "apache_spark": "Apache Spark",
    "data_warehousing": "Le data warehousing",
    "streaming_de_donnees": "Le streaming de données",
    "orchestration_airflow": "L'orchestration avec Airflow",
    "qualite_des_donnees": "La qualité des données",
    "architecture_data_lake": "L'architecture data lake",
    "principes_de_dataviz": "Les principes de la dataviz",
    "matplotlib": "Matplotlib",
    "seaborn": "Seaborn",
    "plotly": "Plotly",
    "choix_du_bon_graphique": "Choisir le bon graphique",
    "storytelling_avec_la_donnee": "Le storytelling avec la donnée",
    "dashboards_interactifs": "Les tableaux de bord interactifs",
    "visualisation_de_donnees_multidimensionnelles": "Visualiser des données multidimensionnelles",
    "biais_algorithmique": "Les biais algorithmiques",
    "explicabilite_ia_xai": "L'explicabilité de l'IA (XAI)",
    "shap_lime": "SHAP et LIME",
    "vie_privee_et_donnees": "Vie privée et données personnelles",
    "ia_generative_et_droits_d_auteur": "IA générative et droits d'auteur",
    "reglementation_rgpd": "Le RGPD",
    "ai_act_europeen": "L'AI Act européen",
    "ia_frugale": "L'IA frugale",
    "reinforcement_learning_definition": "Qu'est-ce que l'apprentissage par renforcement ?",
    "processus_de_decision_markovien": "Les processus de décision markoviens",
    "q_learning": "Le Q-learning",
    "politique_et_recompense": "Politique et récompense",
    "deep_reinforcement_learning": "Le deep reinforcement learning",
    "exploration_vs_exploitation": "Le dilemme exploration et exploitation",
    "reward_shaping": "Le reward shaping",
    "multi_agent_rl": "L'apprentissage par renforcement multi-agent",
    "dataiku": "Dataiku",
    "make_automatisation": "Make : automatiser sans coder",
    "n8n_automatisation": "n8n : automatiser ses workflows",
    "zapier": "Zapier",
    "knime": "KNIME",
    "databricks": "Databricks",
    "snowflake": "Snowflake",
    "dbt_data_build_tool": "dbt (data build tool)",
    "langchain": "LangChain",
    "llamaindex": "LlamaIndex",
    "huggingface_hub": "Le Hugging Face Hub",
    "mlflow": "MLflow",
    "weights_and_biases": "Weights & Biases",
    "streamlit": "Streamlit",
    "gradio": "Gradio",
    "ollama_plateforme": "Ollama",
    "groq_plateforme": "Groq",
    "bases_vectorielles_pinecone_weaviate_qdrant": "Pinecone, Weaviate et Qdrant",
    "automl_datarobot_h2o": "L'AutoML : DataRobot et H2O",
}


# Acronymes à écrire correctement si un sujet n'a pas de titre dans TITRES
# (par exemple un sujet ajouté récemment). Sert uniquement de solution de secours.
ACRONYMES = {
    "llm": "LLM", "llms": "LLMs", "rag": "RAG", "ia": "IA",
    "nlp": "NLP", "cnn": "CNN", "rnn": "RNN", "lstm": "LSTM",
    "gru": "GRU", "svm": "SVM", "knn": "k-NN", "pca": "PCA",
    "tsne": "t-SNE", "umap": "UMAP", "ann": "ANN", "faiss": "FAISS",
    "mlops": "MLOps", "etl": "ETL", "api": "API", "sql": "SQL",
    "nosql": "NoSQL", "gan": "GAN", "gans": "GANs", "xai": "XAI",
    "shap": "SHAP", "lime": "LIME", "bpe": "BPE", "dbt": "dbt",
    "rgpd": "RGPD", "rlhf": "RLHF", "lora": "LoRA", "qlora": "QLoRA",
    "ci": "CI", "cd": "CD", "gpu": "GPU", "cpu": "CPU", "sgd": "SGD",
    "glove": "GloVe", "ner": "NER", "pos": "POS", "eda": "EDA",
    "h2o": "H2O", "n8n": "n8n", "ab": "A/B", "rl": "RL",
    "kmeans": "k-means", "dbscan": "DBSCAN", "ai": "IA",
}


def nombre_total_de_sujets():
    """Nombre total de sujets, toutes catégories confondues."""
    return sum(len(sujets) for sujets in TOPICS.values())


def titre_lisible(slug):
    """
    Renvoie le titre à afficher pour un slug.

    On cherche d'abord le titre écrit à la main dans TITRES. S'il n'existe
    pas, on le fabrique à partir du slug : chaque mot prend une majuscule,
    sauf les acronymes connus, écrits comme dans ACRONYMES.
    """

    if slug in TITRES:
        return TITRES[slug]

    mots_affiches = []

    for mot in slug.split("_"):
        if mot.lower() in ACRONYMES:
            mots_affiches.append(ACRONYMES[mot.lower()])
        else:
            mots_affiches.append(mot.capitalize())

    return " ".join(mots_affiches)


def tous_les_sujets_a_plat():
    """Renvoie la liste de tous les sujets sous la forme (slug, catégorie, titre)."""

    resultat = []

    for categorie, sujets in TOPICS.items():
        for slug in sujets:
            resultat.append((slug, categorie, titre_lisible(slug)))

    return resultat


# Lancé directement (python topics.py), le fichier affiche un résumé du
# catalogue et signale les sujets qui n'ont pas encore de titre dans TITRES.
if __name__ == "__main__":
    print(f"Nombre total de sujets : {nombre_total_de_sujets()}")
    for categorie, sujets in TOPICS.items():
        print(f"- {categorie} : {len(sujets)} sujets")

    sans_titre = [slug for slug, _, _ in tous_les_sujets_a_plat() if slug not in TITRES]
    if sans_titre:
        print(f"Avertissement : sujets sans titre dans TITRES : {', '.join(sans_titre)}")