/**
 * Configuration centralisée pour le système d'onboarding
 * Tous les délais, durées et constantes en un seul endroit
 */

/**
 * Timings pour le système d'onboarding
 */
export const ONBOARDING_TIMINGS = {
  // Transitions entre steps
  STEP_TRANSITION_DELAY: 2000, // 2s - délai standard entre étapes (permet à l'utilisateur de voir les changements)
  STEPS_WITHOUT_TIMER: [2, 3], // Steps qui s'enchaînent immédiatement (génération IA → task manager → CV généré)

  // Welcome modal
  WELCOME_MORPH_DURATION: 700, // 0.7s - animation morphing du modal vers la checklist

  // Modals et animations
  MODAL_CLOSE_ANIMATION_DURATION: 300, // 0.3s - durée de fermeture des modals
  STEP_VALIDATION_DELAY: 500, // 0.5s - délai avant validation automatique d'un step

  // Polling et retry
  BUTTON_POLLING_INTERVAL: 200, // 0.2s - intervalle de recherche des boutons dans le DOM
  BUTTON_POLLING_TIMEOUT: 10000, // 10s - timeout max avant abandon de la recherche

  // Délai entre fermeture loading screen et onboarding
  LOADING_TO_ONBOARDING_DELAY: 500, // 3s - délai entre fermeture loading screen et welcome modal
};
