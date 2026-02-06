import { useEffect, useRef } from 'react';

/**
 * Hook pour empêcher le scroll chaining (propagation du scroll au parent)
 * Utilisé pour les listes scrollables dans des containers scrollables
 *
 * @param {boolean} enabled - Si le hook est actif
 * @returns {React.RefObject} - Ref à attacher au container scrollable
 */
export function useScrollChaining(enabled = true) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!enabled || !scrollContainer) return;

    function preventScrollChaining(e) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const isAtTop = scrollTop <= 1;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

      // Bloquer seulement aux limites
      if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    scrollContainer.addEventListener('wheel', preventScrollChaining, { passive: false });

    return () => {
      scrollContainer.removeEventListener('wheel', preventScrollChaining);
    };
  }, [enabled]);

  return scrollRef;
}
