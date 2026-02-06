'use client';

import { useEffect } from 'react';

/**
 * Composant qui vérifie si on doit scroller en haut au montage
 * Utilisé après retour depuis la page de gestion des cookies
 */
export default function ScrollToTopOnMount() {
  useEffect(() => {
    // Vérifier si on a marqué qu'on veut scroller en haut
    if (typeof window !== 'undefined') {
      const shouldScroll = sessionStorage.getItem('scrollToTop');
      if (shouldScroll === 'true') {
        // Scroller en haut
        window.scrollTo(0, 0);
        // Nettoyer le flag
        sessionStorage.removeItem('scrollToTop');
      }
    }
  }, []);

  return null; // Ce composant n'affiche rien
}
