"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

export default function LoadingOverlay() {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);

  // useLayoutEffect pour appliquer les styles AVANT le paint (synchrone)
  useLayoutEffect(() => {
    // Bloquer le scroll du body pendant le loading - appliqué immédiatement
    if (isLoading) {
      const htmlElement = document.documentElement;
      const bodyElement = document.body;

      // Bloquer html et body
      htmlElement.style.overflow = 'hidden';
      htmlElement.style.position = 'fixed';
      htmlElement.style.width = '100%';
      htmlElement.style.height = '100%';
      htmlElement.style.top = '0';
      htmlElement.style.left = '0';

      bodyElement.style.overflow = 'hidden';
      bodyElement.style.position = 'fixed';
      bodyElement.style.width = '100%';
      bodyElement.style.height = '100%';
      bodyElement.style.top = '0';
      bodyElement.style.left = '0';
    } else {
      const htmlElement = document.documentElement;
      const bodyElement = document.body;

      htmlElement.style.overflow = '';
      htmlElement.style.position = '';
      htmlElement.style.width = '';
      htmlElement.style.height = '';
      htmlElement.style.top = '';
      htmlElement.style.left = '';

      bodyElement.style.overflow = '';
      bodyElement.style.position = '';
      bodyElement.style.width = '';
      bodyElement.style.height = '';
      bodyElement.style.top = '';
      bodyElement.style.left = '';
    }
  }, [isLoading]);

  // IMPORTANT: useEffect doit être appelé avant tout return conditionnel
  useEffect(() => {
    // Ne pas exécuter la logique sur les pages d'authentification
    if (pathname.startsWith("/auth")) {
      setIsLoading(false);
      return;
    }

    let attempts = 0;
    const maxAttempts = 60; // 60 tentatives * 100ms = 6 secondes max

    // Attendre que le composant TopBar soit monté et réellement rendu
    const checkTopBarReady = () => {
      attempts++;

      // Vérifier si on est dans l'EmptyState (pas de CVs)
      // Si oui, masquer immédiatement le loading
      const emptyStateTitle = document.querySelector('h1.text-4xl.font-bold.text-slate-800');
      if (emptyStateTitle) {
        setIsLoading(false);
        return;
      }

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
  }, [pathname, isLoading]);

  if (!isLoading) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '-100px',
        left: '-100px',
        right: '-100px',
        bottom: '-100px',
        width: 'calc(100vw + 200px)',
        height: 'calc(100vh + 200px)',
        maxHeight: 'calc(100dvh + 200px)',
        backgroundColor: 'rgb(2, 6, 23)',
        opacity: isLoading ? 1 : 0,
        zIndex: 999999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'opacity 300ms',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div className="flex flex-col items-center gap-6">
        {/* Loading spinner with elegant animation */}
        <div className="relative h-16 w-16">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-4 border-white/20"></div>
          {/* Spinning ring */}
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-white border-r-white"></div>
          {/* Inner pulsing dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-3 w-3 rounded-full bg-white animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
