import React from "react";

/**
 * Hook pour détecter quand les éléments d'un conteneur flex wrappent sur plusieurs lignes
 * Basé sur la hauteur du conteneur avec une baseline fixe
 *
 * @param {React.RefObject} containerRef - Ref du conteneur flex à observer
 * @param {boolean} enabled - Active/désactive l'observation
 * @returns {boolean} - true si les éléments ont wrappé, false sinon
 */
export function useWrapDetection(containerRef, enabled = true) {
  const [hasWrapped, setHasWrapped] = React.useState(false);
  const rafIdRef = React.useRef(null);
  const hasWrappedRef = React.useRef(false);

  // Hauteur de référence fixe pour une seule ligne
  // h-8 (32px) + p-3 top (12px) + p-3 bottom (12px) = 56px
  // + un peu de marge = 58px
  const SINGLE_LINE_HEIGHT = 58;

  React.useEffect(() => {
    hasWrappedRef.current = hasWrapped;
  }, [hasWrapped]);

  React.useEffect(() => {
    if (!enabled || !containerRef?.current) {
      setHasWrapped(false);
      return;
    }

    let resizeObserver = null;
    let isCleanedUp = false;

    const checkHeight = () => {
      if (rafIdRef.current !== null || isCleanedUp) return;

      rafIdRef.current = requestAnimationFrame(() => {
        const container = containerRef.current;
        if (!container || isCleanedUp) {
          rafIdRef.current = null;
          return;
        }

        const currentHeight = container.offsetHeight;
        const currentlyWrapped = hasWrappedRef.current;

        // Hystérésis pour éviter les oscillations
        // Seuil pour activer le wrap : hauteur > baseline + 15px (= ~73px, clairement 2 lignes)
        // Seuil pour désactiver le wrap : hauteur < baseline - 2px (= ~56px, vraiment 1 ligne)
        const shouldWrap = currentlyWrapped
          ? currentHeight > SINGLE_LINE_HEIGHT - 2
          : currentHeight > SINGLE_LINE_HEIGHT + 15;

        if (shouldWrap !== currentlyWrapped) {
          setHasWrapped(shouldWrap);
        }

        rafIdRef.current = null;
      });
    };

    // ResizeObserver pour détecter les changements de hauteur
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(checkHeight);
      resizeObserver.observe(containerRef.current);
    } else {
      window.addEventListener("resize", checkHeight);
    }

    // Initial check
    checkHeight();

    return () => {
      isCleanedUp = true;
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", checkHeight);
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [containerRef, enabled]);

  return hasWrapped;
}
