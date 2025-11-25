/**
 * @file loadingEvents.js
 * @description Système d'events centralisé pour gérer l'état de chargement de l'application
 *
 * Ce système permet une communication event-driven entre les composants
 * pour contrôler l'affichage du LoadingOverlay de manière fiable.
 */

// ============================================================================
// EVENTS CONSTANTS
// ============================================================================

export const LOADING_EVENTS = {
  /**
   * Émis par TopBar quand il est complètement monté et prêt
   */
  TOPBAR_READY: 'loading:topbar-ready',

  /**
   * Émis par EmptyState quand il est monté (pas de CVs)
   */
  PAGE_READY: 'loading:page-ready',

  /**
   * Émis par LoadingOverlay quand il commence à se cacher
   */
  LOADING_HIDING: 'loading:hiding',

  /**
   * Émis par LoadingOverlay quand il est complètement caché
   */
  LOADING_HIDDEN: 'loading:hidden',
};

// ============================================================================
// EVENT EMITTER
// ============================================================================

/**
 * Émet un event de chargement avec des données optionnelles
 *
 * @param {string} eventName - Nom de l'event (utiliser LOADING_EVENTS constants)
 * @param {Object} data - Données additionnelles à passer avec l'event
 *
 * @example
 * emitLoadingEvent(LOADING_EVENTS.TOPBAR_READY, { hasButtons: true });
 */
export function emitLoadingEvent(eventName, data = {}) {
  if (typeof window === 'undefined') return;

  const event = new CustomEvent(eventName, {
    detail: {
      ...data,
      timestamp: Date.now(),
    },
  });

  window.dispatchEvent(event);

  // Log en développement uniquement
  if (process.env.NODE_ENV === 'development') {
    console.log(`[LoadingEvent] ${eventName}`, data);
  }
}

// ============================================================================
// EVENT LISTENER
// ============================================================================

/**
 * Écoute un event de chargement
 *
 * @param {string} eventName - Nom de l'event à écouter
 * @param {Function} callback - Fonction appelée quand l'event est émis
 * @returns {Function} Fonction de cleanup pour supprimer le listener
 *
 * @example
 * const cleanup = onLoadingEvent(LOADING_EVENTS.TOPBAR_READY, (data) => {
 *   console.log('TopBar ready!', data);
 * });
 *
 * // Plus tard, pour cleanup:
 * cleanup();
 */
export function onLoadingEvent(eventName, callback) {
  if (typeof window === 'undefined') return () => {};

  const handler = (event) => {
    callback(event.detail);
  };

  window.addEventListener(eventName, handler);

  // Retourne fonction de cleanup
  return () => {
    window.removeEventListener(eventName, handler);
  };
}

// ============================================================================
// HELPER: WAIT FOR EVENT
// ============================================================================

/**
 * Retourne une Promise qui se résout quand l'event est émis
 * Utile pour attendre un event spécifique
 *
 * @param {string} eventName - Nom de l'event à attendre
 * @param {number} timeout - Timeout en ms (optionnel)
 * @returns {Promise<Object>} Promise qui se résout avec les données de l'event
 *
 * @example
 * const data = await waitForLoadingEvent(LOADING_EVENTS.TOPBAR_READY, 5000);
 * console.log('TopBar is ready!', data);
 */
export function waitForLoadingEvent(eventName, timeout = null) {
  return new Promise((resolve, reject) => {
    let cleanup;
    let timeoutId;

    cleanup = onLoadingEvent(eventName, (data) => {
      if (timeoutId) clearTimeout(timeoutId);
      cleanup();
      resolve(data);
    });

    if (timeout) {
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for event: ${eventName}`));
      }, timeout);
    }
  });
}
