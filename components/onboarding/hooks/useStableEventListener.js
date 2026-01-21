import { useEffect, useRef } from 'react';

/**
 * Hook pour créer un event listener stable avec une ref callback
 * Évite les re-registrations quand les dépendances changent
 *
 * @param {string} eventName - Nom de l'événement
 * @param {Function} handler - Handler qui sera appelé (peut changer)
 * @param {Object} options - Options
 * @param {boolean} options.enabled - Si true, le listener est actif
 * @param {EventTarget} options.target - Cible de l'événement (défaut: window)
 */
export function useStableEventListener(eventName, handler, options = {}) {
  const { enabled = true, target = null } = options;
  const handlerRef = useRef(handler);

  // Mettre à jour la ref quand le handler change
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // Enregistrer le listener une seule fois
  useEffect(() => {
    if (!enabled) return;

    const eventTarget = target || (typeof window !== 'undefined' ? window : null);
    if (!eventTarget) return;

    const stableHandler = (event) => handlerRef.current?.(event);

    eventTarget.addEventListener(eventName, stableHandler);
    return () => eventTarget.removeEventListener(eventName, stableHandler);
  }, [eventName, enabled, target]);
}

/**
 * Hook pour créer plusieurs event listeners avec le même pattern
 */
export function useStableEventListeners(listeners) {
  listeners.forEach(({ eventName, handler, enabled = true, target = null }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useStableEventListener(eventName, handler, { enabled, target });
  });
}
