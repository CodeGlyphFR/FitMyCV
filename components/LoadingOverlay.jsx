"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { emitOnboardingEvent, ONBOARDING_EVENTS } from "@/lib/onboarding/onboardingEvents";

export default function LoadingOverlay() {
  const pathname = usePathname();

  // État pour détecter si on est monté côté client (évite hydration mismatch)
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Détecter le montage côté client pour éviter l'hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

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
    const maxAttempts = 60; // 60 tentatives * 50ms = 3 secondes max

    // Attendre que le composant TopBar soit monté et réellement rendu
    const checkTopBarReady = () => {
      attempts++;

      // Vérifier si on est dans l'EmptyState (pas de CVs)
      // Si oui, masquer immédiatement le loading
      const emptyStateTitle = document.querySelector('h1.text-4xl.font-bold.text-white');
      if (emptyStateTitle) {
        // Émettre événement pour déclencher l'onboarding après un délai (voir OnboardingProvider)
        emitOnboardingEvent(ONBOARDING_EVENTS.LOADING_SCREEN_CLOSED, {
          trigger: 'emptyState',
          timestamp: Date.now(),
        });
        setIsLoading(false);
        return;
      }

      // Vérifier si la TopBar est présente ET visible avec son contenu
      const topBar = document.querySelector('.sticky.top-0');

      if (topBar) {
        // Vérification simplifiée : TopBar visible + boutons présents
        const hasButtons = topBar.querySelector('button');
        const isVisible = topBar.offsetHeight > 0;

        if (hasButtons && isVisible) {
          // Émettre événement pour déclencher l'onboarding après un délai (voir OnboardingProvider)
          emitOnboardingEvent(ONBOARDING_EVENTS.LOADING_SCREEN_CLOSED, {
            trigger: 'topBarReady',
            timestamp: Date.now(),
          });
          // Masquer immédiatement sans délai supplémentaire
          setIsLoading(false);
          return;
        }
      }

      // Continuer à vérifier si pas encore prêt et pas dépassé le max
      if (attempts < maxAttempts) {
        setTimeout(checkTopBarReady, 50);
      } else {
        // Timeout atteint, masquer quand même
        setIsLoading(false);
      }
    };

    // Lancer la vérification
    checkTopBarReady();

    // Timeout de sécurité absolu : masquer le loader après 3 secondes maximum
    const maxTimeout = setTimeout(() => {
      // Emit event BEFORE hiding (safety net)
      emitOnboardingEvent(ONBOARDING_EVENTS.LOADING_SCREEN_CLOSED, {
        trigger: 'safetyTimeout',
        timestamp: Date.now(),
      });
      setIsLoading(false);
    }, 3000);

    return () => {
      clearTimeout(maxTimeout);
      // Ensure event is emitted if component unmounts while loading
      if (isLoading) {
        emitOnboardingEvent(ONBOARDING_EVENTS.LOADING_SCREEN_CLOSED, {
          trigger: 'componentUnmount',
          timestamp: Date.now(),
        });
      }
    };
  }, [pathname, isLoading]);

  // Ne pas rendre côté serveur pour éviter l'hydration mismatch
  if (!isMounted) return null;

  // Ne pas rendre si pas en chargement
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
