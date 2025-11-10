'use client';

import { useEffect } from 'react';
import { useCookieConsent } from '@/lib/cookies/useCookieConsent';

/**
 * Composant exemple pour charger Google Analytics conditionnellement
 * selon le consentement de l'utilisateur
 */
export default function ConditionalAnalytics() {
  const { isAnalyticsAccepted, hasConsent } = useCookieConsent();

  useEffect(() => {
    if (!hasConsent) {
      console.log('[Analytics] En attente du consentement utilisateur');
      return;
    }

    if (isAnalyticsAccepted) {
      console.log('[Analytics] Consentement accordé - Analytics activés');
      // Ici, vous pouvez charger Google Analytics ou autre
      // Exemple :
      // window.gtag('config', 'GA_MEASUREMENT_ID');
    } else {
      console.log('[Analytics] Consentement refusé - Analytics désactivés');
    }
  }, [isAnalyticsAccepted, hasConsent]);

  return null; // Ce composant n'affiche rien
}