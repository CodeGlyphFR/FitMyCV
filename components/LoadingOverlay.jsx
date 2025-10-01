"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export default function LoadingOverlay() {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);

  // Ne pas afficher le loading sur la page de connexion
  if (pathname === "/auth") {
    return null;
  }

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 60; // 60 tentatives * 100ms = 6 secondes max

    // Attendre que le composant TopBar soit monté et réellement rendu
    const checkTopBarReady = () => {
      attempts++;

      // Vérifier si la TopBar est présente ET visible avec son contenu
      const topBar = document.querySelector('.sticky.top-0');

      if (topBar) {
        // Vérifier que la TopBar contient des boutons (signe qu'elle est complètement chargée)
        const hasButtons = topBar.querySelector('button');
        // Vérifier qu'il n'y a pas de texte "loading" ou "chargement"
        const isNotLoading = !topBar.textContent.toLowerCase().includes('loading') &&
                            !topBar.textContent.toLowerCase().includes('chargement');

        // Vérifier que la TopBar a une hauteur réelle (est visible)
        const isVisible = topBar.offsetHeight > 0;

        if (hasButtons && isNotLoading && isVisible) {
          // Petit délai pour s'assurer que le rendu visuel est complet
          setTimeout(() => {
            setIsLoading(false);
          }, 200);
          return;
        }
      }

      // Continuer à vérifier si pas encore prêt et pas dépassé le max
      if (attempts < maxAttempts) {
        setTimeout(checkTopBarReady, 100);
      } else {
        // Timeout atteint, masquer quand même
        setIsLoading(false);
      }
    };

    // Lancer la vérification
    checkTopBarReady();

    // Timeout de sécurité absolu : masquer le loader après 7 secondes maximum
    const maxTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 7000);

    return () => {
      clearTimeout(maxTimeout);
    };
  }, []);

  if (!isLoading) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-white/80 backdrop-blur-md transition-opacity duration-300"
      style={{
        opacity: isLoading ? 1 : 0,
        height: '100vh',
        height: '100dvh',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Loading spinner */}
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        <p className="text-sm text-gray-600">Chargement...</p>
      </div>
    </div>
  );
}
