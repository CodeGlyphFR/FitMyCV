/**
 * Macro-features configuration for subscription management
 * Each macro-feature groups several micro-features from OpenAI tracking
 */
export const MACRO_FEATURES = {
  gpt_cv_generation: {
    name: 'Adaptation de CV par IA',
    icon: '🤖',
    description: 'Bouton GPT - Adaptation CV, Analyse offre, Modèle CV (URL + PDF)',
    microFeatures: [
      'generate_cv_url',
      'generate_cv_pdf',
      'extract_job_offer_url',
      'extract_job_offer_pdf',
      'create_template_cv_url',
      'create_template_cv_pdf'
    ],
    isAIFeature: true
  },
  import_pdf: {
    name: 'Import de CV',
    icon: '📥',
    description: 'Import de CV depuis PDF',
    microFeatures: ['import_pdf', 'first_import_pdf', 'import_cv'],
    isAIFeature: true
  },
  translate_cv: {
    name: 'Traduction de CV',
    icon: '🌍',
    description: 'Traduction de CV',
    microFeatures: ['translate_cv'],
    isAIFeature: true
  },
  match_score: {
    name: 'Score de match',
    icon: '🎯',
    description: 'Calcul du score de match avec l\'offre',
    microFeatures: ['match_score'],
    isAIFeature: true
  },
  optimize_cv: {
    name: 'Optimisation',
    icon: '✨',
    description: 'Optimisation automatique du CV',
    microFeatures: ['optimize_cv'],
    isAIFeature: true
  },
  generate_from_job_title: {
    name: 'Création de CV fictif',
    icon: '💼',
    description: 'Génération depuis un titre de poste',
    microFeatures: ['generate_from_job_title'],
    isAIFeature: true
  },
  export_cv: {
    name: 'Export de CV',
    icon: '💾',
    description: 'Export du CV en PDF',
    microFeatures: ['export_cv'],
    isAIFeature: false
  },
  edit_cv: {
    name: 'Edition de CV',
    icon: '✏️',
    description: 'Mode édition du CV',
    microFeatures: ['edit_cv'],
    isAIFeature: false
  },
  create_cv_manual: {
    name: 'Création de CV',
    icon: '📝',
    description: 'Création manuelle de CV (bouton +)',
    microFeatures: ['create_cv_manual'],
    isAIFeature: false
  }
};

/**
 * AI Features (with Token mode)
 */
export const AI_FEATURES = Object.entries(MACRO_FEATURES)
  .filter(([_, config]) => config.isAIFeature)
  .map(([key]) => key);

/**
 * Get default feature limits for a new plan
 */
export function getDefaultFeatureLimits() {
  const defaultFeatures = {};
  Object.keys(MACRO_FEATURES).forEach((featureName) => {
    defaultFeatures[featureName] = {
      isEnabled: true,
      usageLimit: -1,
    };
  });
  return defaultFeatures;
}

/**
 * Load feature limits from a plan, filling in defaults for missing features
 */
export function loadFeatureLimitsFromPlan(plan) {
  const existingFeatures = {};

  // Load existing features from plan
  plan.featureLimits.forEach((fl) => {
    existingFeatures[fl.featureName] = {
      isEnabled: fl.isEnabled,
      usageLimit: fl.usageLimit,
    };
  });

  // Add missing features with defaults
  Object.keys(MACRO_FEATURES).forEach((featureName) => {
    if (!existingFeatures[featureName]) {
      existingFeatures[featureName] = {
        isEnabled: true,
        usageLimit: -1,
      };
    }
  });

  return existingFeatures;
}
