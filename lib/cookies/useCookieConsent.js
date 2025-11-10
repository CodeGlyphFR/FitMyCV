'use client';

import { useState, useEffect } from 'react';
import { getConsent, isCategoryAccepted, COOKIE_CATEGORIES } from './consent';

const CONSENT_CHANNEL_NAME = 'cookie_consent_channel';

/**
 * Hook React pour gérer le consentement des cookies
 *
 * @returns {Object} État du consentement et méthodes utilitaires
 *
 * @example
 * const { hasConsent, isNecessaryAccepted, isFunctionalAccepted } = useCookieConsent();
 *
 * if (isFunctionalAccepted) {
 *   // Charger les fonctionnalités optionnelles
 * }
 */
export function useCookieConsent() {
  const [consent, setConsent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentConsent = getConsent();
    setConsent(currentConsent);
    setLoading(false);

    // BroadcastChannel pour synchronisation multi-onglets (plus performant que polling)
    let channel = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CONSENT_CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === 'consent-updated') {
          setConsent(event.data.consent);
        }
      };
    }

    // Storage event pour détecter les changements dans d'autres onglets (fallback)
    const handleStorageChange = (e) => {
      if (e.key === 'cookie_consent' || e.key === null) {
        const newConsent = getConsent();
        setConsent(newConsent);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (channel) {
        channel.close();
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return {
    consent,
    loading,
    hasConsent: consent !== null,
    isNecessaryAccepted: consent ? consent[COOKIE_CATEGORIES.NECESSARY] === true : true,
    isFunctionalAccepted: consent ? consent[COOKIE_CATEGORIES.FUNCTIONAL] === true : false,
    isAnalyticsAccepted: consent ? consent[COOKIE_CATEGORIES.ANALYTICS] === true : false,
    isMarketingAccepted: consent ? consent[COOKIE_CATEGORIES.MARKETING] === true : false,
  };
}

/**
 * Hook pour conditionner le chargement d'un script selon le consentement
 *
 * @param {string} category - Catégorie de cookie requise
 * @param {Function} loadScript - Fonction pour charger le script
 *
 * @example
 * useConditionalScript(COOKIE_CATEGORIES.ANALYTICS, () => {
 *   // Charger Google Analytics
 *   window.gtag('config', 'GA_MEASUREMENT_ID');
 * });
 */
export function useConditionalScript(category, loadScript) {
  const { hasConsent, consent } = useCookieConsent();

  useEffect(() => {
    if (hasConsent && isCategoryAccepted(category)) {
      loadScript();
    }
  }, [hasConsent, consent, category, loadScript]);
}