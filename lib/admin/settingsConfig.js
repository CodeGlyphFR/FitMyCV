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
  pdf_import: 'Import PDF (Vision)',
  cv_display: 'Affichage CV',
};

// Mapping des settings individuels vers des labels lisibles
export const SETTING_LABELS = {
  // Modèles IA - Génération CV
  model_cv_generation: 'Génération CV',

  // Modèles IA - Pipeline Adaptation CV
  model_cv_classify: 'Classification (KEEP/REMOVE/MOVE)',
  model_cv_batch_experience: 'Adaptation Expériences',
  model_cv_batch_projects: 'Adaptation Projets',
  model_cv_batch_extras: 'Adaptation Extras',
  model_cv_batch_skills: 'Adaptation Compétences',
  model_cv_batch_summary: 'Adaptation Summary',

  // Modèles IA - Pipeline Amélioration CV
  model_improve_preprocess: 'Préparation Suggestions',
  model_improve_experience: 'Amélioration Expérience',
  model_improve_project: 'Amélioration Projet',
  model_improve_summary: 'Amélioration Summary',
  model_improve_classify_skills: 'Classification Skills',
  model_improve_languages: 'Amélioration Langues',
  model_improve_extras: 'Amélioration Extras',

  // Modèles IA - Autres
  model_extract_job_offer: 'Extraction d\'offre',
  model_generate_from_job_title: 'Barre de recherche',
  model_match_score: 'Score de match',
  model_translate_cv: 'Traduction',
  model_import_pdf: 'Import PDF',
  model_first_import_pdf: 'Premier Import PDF',
  model_optimize_cv: 'Optimisation (Legacy)',
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
  subscription_mode_enabled: 'Mode abonnement',
  welcome_credits: 'Crédits de bienvenue',
  cv_max_versions: 'Versions max par CV',

  // Credits
  credits_create_cv_manual: 'Création manuelle CV',
  credits_edit_cv: 'Édition CV',
  credits_export_cv: 'Export PDF',
  credits_match_score: 'Score de matching',
  credits_translate_cv: 'Traduction CV',
  credits_gpt_cv_generation: 'Génération CV',
  credits_optimize_cv: 'Optimisation CV',
  credits_generate_from_job_title: 'Génération depuis titre',
  credits_import_pdf: 'Import PDF',

  // PDF Import (Vision)
  pdf_image_max_width: 'Largeur max image (px)',
  pdf_image_density: 'Densité (DPI)',
  pdf_image_quality: 'Qualité JPEG (%)',
  pdf_vision_detail: 'Détail Vision API',
  temperature_import_pdf: 'Température GPT',
  top_p_import_pdf: 'Top P (nucleus sampling)',
  seed_import_pdf: 'Seed (reproductibilité)',

  // CV Display
  cv_section_order: 'Ordre des sections',
};

// Structure hiérarchique pour les modèles IA
export const AI_MODELS_STRUCTURE = {
  'Génération CV': ['model_cv_generation'],
  'Adaptation CV': [
    'model_cv_classify',
    'model_cv_batch_experience',
    'model_cv_batch_projects',
    'model_cv_batch_extras',
    'model_cv_batch_skills',
    'model_cv_batch_summary',
  ],
  'Amélioration CV': [
    'model_improve_preprocess',
    'model_improve_classify_skills',
    'model_improve_experience',
    'model_improve_project',
    'model_improve_extras',
    'model_improve_languages',
    'model_improve_summary',
  ],
  'Extraction d\'offre': ['model_extract_job_offer'],
  'Barre de recherche': ['model_generate_from_job_title'],
  'Score de match': ['model_match_score'],
  'Traduction': ['model_translate_cv'],
  'Import PDF': ['model_import_pdf', 'model_first_import_pdf'],
  'Optimisation (Legacy)': ['model_optimize_cv'],
  'Détection de langue': ['model_detect_language'],
};

// Structure hiérarchique pour les crédits par feature
export const CREDITS_STRUCTURE = {
  'Inscription': [
    'welcome_credits',
  ],
  'Génération CV': [
    'credits_gpt_cv_generation',
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

// Structure pour les paramètres PDF Import
export const PDF_IMPORT_STRUCTURE = {
  'Conversion Image': [
    'pdf_image_max_width',
    'pdf_image_density',
    'pdf_image_quality',
  ],
  'Vision API': ['pdf_vision_detail', 'temperature_import_pdf', 'top_p_import_pdf', 'seed_import_pdf'],
};

// Configuration des inputs pour PDF Import
export const PDF_IMPORT_CONFIG = {
  pdf_image_max_width: {
    type: 'slider',
    min: 500,
    max: 1500,
    step: 100,
    unit: 'px',
  },
  pdf_image_density: {
    type: 'slider',
    min: 72,
    max: 150,
    step: 10,
    unit: 'DPI',
  },
  pdf_image_quality: {
    type: 'slider',
    min: 50,
    max: 100,
    step: 5,
    unit: '%',
  },
  pdf_vision_detail: {
    type: 'select',
    options: ['low', 'auto', 'high'],
  },
  temperature_import_pdf: {
    type: 'slider',
    min: 0,
    max: 2,
    step: 0.1,
    unit: '',
  },
  top_p_import_pdf: {
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.05,
    unit: '',
  },
  seed_import_pdf: {
    type: 'slider',
    min: 0,
    max: 1000,
    step: 1,
    unit: '',
  },
};

// Liste des sections CV pour l'ordre
export const CV_SECTIONS = [
  { id: 'header', label: 'En-tête', icon: 'User' },
  { id: 'summary', label: 'Résumé', icon: 'FileText' },
  { id: 'skills', label: 'Compétences', icon: 'Star' },
  { id: 'experience', label: 'Expérience', icon: 'Briefcase' },
  { id: 'education', label: 'Formation', icon: 'GraduationCap' },
  { id: 'languages', label: 'Langues', icon: 'Globe' },
  { id: 'extras', label: 'Extras', icon: 'Plus' },
  { id: 'projects', label: 'Projets', icon: 'Folder' },
];

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
 * Vérifier si une catégorie est celle de l'import PDF
 */
export function isPdfImportCategory(category) {
  return category === 'pdf_import';
}

/**
 * Vérifier si une catégorie est celle de l'affichage CV
 */
export function isCvDisplayCategory(category) {
  return category === 'cv_display';
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

/**
 * Obtenir la structure pour les paramètres PDF Import
 */
export function getPdfImportStructure() {
  return PDF_IMPORT_STRUCTURE;
}

/**
 * Obtenir la configuration des inputs pour PDF Import
 */
export function getPdfImportConfig() {
  return PDF_IMPORT_CONFIG;
}

/**
 * Obtenir la liste des sections CV
 */
export function getCvSections() {
  return CV_SECTIONS;
}
