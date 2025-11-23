"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { emitOnboardingEvent, ONBOARDING_EVENTS } from "@/lib/onboarding/onboardingEvents";
import { LOADING_EVENTS, onLoadingEvent, emitLoadingEvent } from "@/lib/loading/loadingEvents";

export default function LoadingOverlay() {
  const pathname = usePathname();

  useEffect(() => {
    // Ne pas exécuter la logique sur les pages d'authentification
    if (pathname.startsWith("/auth")) {
      removeInitialLoader('authPage');
      return;
    }

    let cleanupFunctions = [];
    let safetyTimeout;

    // Fonction pour supprimer le loader CSS initial
    const removeInitialLoader = (trigger) => {
      const initialOverlay = document.getElementById('initial-loading-overlay');
      if (!initialOverlay) return;

      // Log en développement
      if (process.env.NODE_ENV === 'development') {
        console.log('[LoadingOverlay] Hiding initial CSS loader, trigger:', trigger);
      }

      // Émettre événement AVANT de commencer à cacher
      emitLoadingEvent(LOADING_EVENTS.LOADING_HIDING, {
        trigger,
        timestamp: Date.now(),
      });

      // Émettre événement onboarding pour déclencher la suite
      emitOnboardingEvent(ONBOARDING_EVENTS.LOADING_SCREEN_CLOSED, {
        trigger,
        timestamp: Date.now(),
      });

      // Ajouter classe pour fade-out CSS
      initialOverlay.classList.add('hiding');

      // Après la transition (300ms), supprimer complètement du DOM
      setTimeout(() => {
        if (initialOverlay.parentNode) {
          initialOverlay.parentNode.removeChild(initialOverlay);
        }

        // Émettre événement de fin
        emitLoadingEvent(LOADING_EVENTS.LOADING_HIDDEN, {
          trigger,
          timestamp: Date.now(),
        });
      }, 300);
    };

    // Écouter l'événement TOPBAR_READY (émis par TopBar)
    const cleanupTopBar = onLoadingEvent(LOADING_EVENTS.TOPBAR_READY, (data) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[LoadingOverlay] TopBar ready, hiding loading screen', data);
      }
      removeInitialLoader('topBarReady');
    });
    cleanupFunctions.push(cleanupTopBar);

    // Écouter l'événement PAGE_READY (émis par EmptyState)
    const cleanupPageReady = onLoadingEvent(LOADING_EVENTS.PAGE_READY, (data) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[LoadingOverlay] Page ready, hiding loading screen', data);
      }
      removeInitialLoader('pageReady');
    });
    cleanupFunctions.push(cleanupPageReady);

    // Timeout de sécurité absolu : masquer le loader après 3 secondes maximum
    safetyTimeout = setTimeout(() => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[LoadingOverlay] Safety timeout reached, forcing hide');
      }
      removeInitialLoader('safetyTimeout');
    }, 3000);

    return () => {
      // Cleanup tous les event listeners
      cleanupFunctions.forEach(cleanup => cleanup());

      // Cleanup timeout
      if (safetyTimeout) {
        clearTimeout(safetyTimeout);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Ce composant ne rend rien - il gère juste le loader CSS du <head>
  return null;
}
