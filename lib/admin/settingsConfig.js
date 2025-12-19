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
  credits: 'Crédits par feature',
  features: 'Fonctionnalités',
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
  model_import_pdf: 'Import PDF',
  model_first_import_pdf: 'Premier Import PDF',
  model_optimize_cv: 'Optimisation',
  model_detect_language: 'Détection de langue',

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

  // System
  registration_enabled: 'Inscriptions activées',
  maintenance_enabled: 'Mode maintenance',

  // Credits
  credits_create_cv_manual: 'Création manuelle CV',
  credits_edit_cv: 'Édition CV',
  credits_export_cv: 'Export PDF',
  credits_match_score: 'Score de matching',
  credits_translate_cv: 'Traduction CV',
  credits_gpt_cv_generation_rapid: 'Génération CV (rapide)',
  credits_gpt_cv_generation_medium: 'Génération CV (normal)',
  credits_gpt_cv_generation_deep: 'Génération CV (approfondi)',
  credits_optimize_cv: 'Optimisation CV',
  credits_generate_from_job_title: 'Génération depuis titre',
  credits_import_pdf: 'Import PDF',
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
  'Import PDF': ['model_import_pdf', 'model_first_import_pdf'],
  'Optimisation': ['model_optimize_cv'],
  'Détection de langue': ['model_detect_language'],
};

// Structure hiérarchique pour les crédits par feature
export const CREDITS_STRUCTURE = {
  'Génération CV': [
    'credits_gpt_cv_generation_rapid',
    'credits_gpt_cv_generation_medium',
    'credits_gpt_cv_generation_deep',
  ],
  'Opérations CV': [
    'credits_create_cv_manual',
    'credits_edit_cv',
    'credits_export_cv',
    'credits_optimize_cv',
  ],
  'Import & Analyse': [
    'credits_import_pdf',
    'credits_match_score',
    'credits_generate_from_job_title',
  ],
  'Traduction': ['credits_translate_cv'],
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
  return category === 'ai_models' || category === 'credits';
}

/**
 * Vérifier si une catégorie est celle des crédits
 */
export function isCreditsCategory(category) {
  return category === 'credits';
}

/**
 * Obtenir la structure hiérarchique pour les modèles IA
 */
export function getAIModelsStructure() {
  return AI_MODELS_STRUCTURE;
}

/**
 * Obtenir la structure hiérarchique pour les crédits
 */
export function getCreditsStructure() {
  return CREDITS_STRUCTURE;
}
