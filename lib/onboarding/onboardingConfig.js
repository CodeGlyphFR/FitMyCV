/**
 * Configuration centralisée pour le système d'onboarding
 * Tous les délais, durées et constantes en un seul endroit
 */

/**
 * Timings pour le système d'onboarding
 */
export const ONBOARDING_TIMINGS = {
  // Transitions entre steps
  STEP_TRANSITION_DELAY: 2000, // 1s - délai standard entre étapes (permet à l'utilisateur de voir les changements)
  STEPS_WITHOUT_TIMER: ['ai_generation', 'task_manager'], // Steps qui s'enchaînent immédiatement (génération IA → task manager → CV généré)

  // Welcome modal
  WELCOME_MORPH_DURATION: 700, // 0.7s - animation morphing du modal vers la checklist

  // Modals et animations
  MODAL_CLOSE_ANIMATION_DURATION: 300, // 0.3s - durée de fermeture des modals
  STEP_VALIDATION_DELAY: 500, // 0.5s - délai avant validation automatique d'un step
  STEP_CELEBRATION_DURATION: 1500, // 1.5s - durée de la célébration (confetti + son) entre les étapes

  // Polling et retry
  BUTTON_POLLING_INTERVAL: 200, // 0.2s - intervalle de recherche des boutons dans le DOM
  BUTTON_POLLING_TIMEOUT: 10000, // 10s - timeout max avant abandon de la recherche

  // Element position retry (useElementPosition hook)
  ELEMENT_POSITION_RETRY_INTERVAL: 100, // 0.1s - intervalle entre tentatives de recherche d'élément
  ELEMENT_POSITION_MAX_RETRIES: 50, // 50 tentatives max (5 secondes au total)

  // Délai entre fermeture loading screen et onboarding
  LOADING_TO_ONBOARDING_DELAY: 1000, // 1s - délai entre fermeture loading screen et welcome modal
};

/**
 * Configuration API et cache
 */
export const ONBOARDING_API = {
  CACHE_TTL: 1000, // 1s - durée de vie du cache API (synchronisé avec debounce persistence)
  MAX_RETRY_ATTEMPTS: 3, // Nombre max de tentatives de retry en cas d'erreur API
};

/**
 * Mapping step number → modal key
 * Utilisé pour identifier quel modal correspond à quel step
 * Seuls les steps avec modals sont inclus
 */
export const STEP_TO_MODAL_KEY = {
  0: 'welcome', // Step 0 = Welcome modal (affiché au démarrage)
  1: 'step1', // Mode édition (3 écrans)
  2: 'step2', // Génération IA (3 écrans)
  5: 'step5', // Review IA (2 écrans)
  7: 'step7', // Optimisation (2 écrans)
  9: 'step9', // Export PDF (2 écrans)
  // Steps 3, 4, 6, 8 n'ont pas de modals
};
