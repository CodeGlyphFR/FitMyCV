/**
 * Configuration pour l'affichage des settings dans le dashboard admin
 */

// Liste des modèles OpenAI disponibles
export const AVAILABLE_AI_MODELS = [
  'gpt-5-nano-2025-08-07',
  'gpt-5-mini-2025-08-07',
  'gpt-5-2025-08-07',
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-4o-mini-tts',
  'gpt-4o-mini-transcribe',
  'gpt-4.1-2025-04-14',
  'o4-mini-deep-research-2025-06-26',
  'o3-deep-research-2025-06-26',
  'gpt-oss-20b',
  'gpt-oss-120b',
];

// Mapping des catégories vers des titres lisibles
export const CATEGORY_LABELS = {
  ai_models: 'Modèles IA',
  features: 'Fonctionnalités',
  rate_limiting: 'Limitation de requêtes',
  system: 'Système',
};

// Mapping des settings individuels vers des labels lisibles
export const SETTING_LABELS = {
  // Modèles IA - Analyse
  model_analysis_rapid: 'Rapide',
  model_analysis_medium: 'Normal',
  model_analysis_deep: 'Approfondi',

  // Modèles IA - Autres
  model_extract_job_offer: 'Extraction d\'offre',
  model_generate_from_job_title: 'Barre de recherche',
  model_match_score: 'Score de match',
  model_translate_cv: 'Traduction',

  // Features
  feature_ai_generation: 'Génération IA (bouton GPT)',
  feature_edit_mode: 'Mode édition',
  feature_export: 'Export PDF',
  feature_feedback: 'Système de feedback',
  feature_history: 'Historique des liens',
  feature_import: 'Import PDF',
  feature_language_switcher: 'Sélecteur de langue',
  feature_manual_cv: 'Création manuelle (bouton +)',
  feature_match_score: 'Score de correspondance',
  feature_optimize: 'Optimisation de CV',
  feature_search_bar: 'Barre de recherche par titre',
  feature_translate: 'Traduction',

  // Rate limiting
  token_default_limit: 'Nombre de tokens par défaut',
  token_reset_hours: 'Délai de reset (heures)',

  // System
  registration_enabled: 'Inscriptions activées',
};

// Structure hiérarchique pour les modèles IA
export const AI_MODELS_STRUCTURE = {
  'Analyse': [
    'model_analysis_rapid',
    'model_analysis_medium',
    'model_analysis_deep',
  ],
  'Extraction d\'offre': ['model_extract_job_offer'],
  'Barre de recherche': ['model_generate_from_job_title'],
  'Score de match': ['model_match_score'],
  'Traduction': ['model_translate_cv'],
};

/**
 * Obtenir le label d'un setting
 */
export function getSettingLabel(settingName) {
  return SETTING_LABELS[settingName] || settingName;
}

/**
 * Obtenir le label d'une catégorie
 */
export function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

/**
 * Vérifier si une catégorie doit être affichée avec une structure hiérarchique
 */
export function isHierarchicalCategory(category) {
  return category === 'ai_models';
}

/**
 * Obtenir la structure hiérarchique pour les modèles IA
 */
export function getAIModelsStructure() {
  return AI_MODELS_STRUCTURE;
}
