/**
 * Mapping des types de tâches vers les featureNames de télémétrie
 *
 * Ce fichier centralise le mapping entre les types de BackgroundTask
 * et les featureNames utilisés dans OpenAICall pour la télémétrie.
 *
 * NOTE: Les types de tâches ici correspondent aux valeurs réelles utilisées
 * dans les routes API (background-tasks), pas aux constantes TASK_TYPES.
 */

/**
 * Mapping task types → featureNames pour requêtes télémétrie
 * Un type de tâche peut correspondre à plusieurs featureNames
 *
 * IMPORTANT: Les clés doivent correspondre aux types réels utilisés dans
 * les routes API background-tasks, PAS aux TASK_TYPES
 */
export const TASK_TYPE_TO_FEATURES = {
  // Types réels utilisés dans les routes API
  'generation': ['generate_cv_url', 'generate_cv_pdf'],
  'template-creation': ['create_template_cv_url', 'create_template_cv_pdf'],
  'import': ['first_import_pdf', 'import_pdf'],  // Note: type='import' pas 'import-pdf'
  'translate-cv': ['translate_cv'],
  'calculate-match-score': ['match_score'],
  'job-title-generation': ['generate_from_job_title'],  // Génération depuis job title
  'improve-cv': [
    'optimize_cv',
    'cv_improvement_preprocess',
    'cv_improvement_experience',
    'cv_improvement_project',
    'cv_improvement_summary',
    'cv_improvement_classify',
  ],
};

/**
 * Configuration des phases pour les tâches avec progression temps réel
 * Les phases sont utilisées pour afficher une barre de progression détaillée
 */
export const TASK_PHASES = {
  'improve-cv': [
    { name: 'Classification + Preprocessing', weight: 0.2 },
    { name: 'Amélioration expériences', weight: 0.4 },
    { name: 'Amélioration projets', weight: 0.2 },
    { name: 'Summary + Fusion', weight: 0.2 },
  ],
};

/**
 * Durées par défaut (en ms) quand pas assez de données télémétrie
 * Basées sur des estimations réalistes par type de tâche
 *
 * IMPORTANT: Les clés doivent correspondre aux types réels (voir TASK_TYPE_TO_FEATURES)
 */
export const DEFAULT_DURATIONS = {
  'generation': 35000,             // 35s - Génération CV complète
  'template-creation': 40000,      // 40s - Template création
  'import': 60000,                 // 60s - Import PDF avec extraction
  'translate-cv': 20000,           // 20s - Traduction CV
  'calculate-match-score': 15000,  // 15s - Calcul score match
  'job-title-generation': 30000,   // 30s - Génération depuis job title
  'improve-cv': 25000,             // 25s - Optimisation CV
};

/**
 * Nombre minimum de calls requis pour utiliser la moyenne télémétrie
 * En dessous, on utilise la durée par défaut
 * Note: Mis à 1 pour utiliser les données dès qu'elles existent
 */
export const MIN_CALLS_FOR_AVERAGE = 1;

/**
 * Récupère les featureNames pour un type de tâche
 * @param {string} taskType - Type de tâche (ex: 'generation')
 * @returns {string[]} Liste des featureNames associés
 */
export function getFeaturesForTaskType(taskType) {
  return TASK_TYPE_TO_FEATURES[taskType] || [];
}

/**
 * Récupère la durée par défaut pour un type de tâche
 * @param {string} taskType - Type de tâche
 * @returns {number} Durée en millisecondes
 */
export function getDefaultDuration(taskType) {
  return DEFAULT_DURATIONS[taskType] || 30000; // 30s fallback
}
