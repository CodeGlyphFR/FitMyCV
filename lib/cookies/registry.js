/**
 * Registre complet des cookies utilisés sur le site
 * Conforme RGPD - Liste tous les cookies avec leurs caractéristiques
 */

import { COOKIE_CATEGORIES } from './consent';

/**
 * Structure d'un cookie dans le registre:
 * - name: nom du cookie
 * - category: catégorie (necessary, analytics)
 * - duration: durée de vie
 * - purpose: finalité du cookie
 * - provider: fournisseur (first-party / third-party)
 * - type: type de stockage (cookie / localStorage / sessionStorage)
 *
 * Note RGPD v2.0:
 * - Les catégories 'functional' et 'marketing' ont été supprimées (inutilisées)
 * - La préférence de langue est désormais classée comme nécessaire (UX essentielle)
 * - La catégorie 'analytics' est préparée pour Plausible (privacy-friendly)
 * - La télémétrie interne (erreurs, usage API) est collectée sur base d'intérêt légitime
 */

export const COOKIE_REGISTRY = [
  // ========== COOKIES NÉCESSAIRES ==========
  {
    name: 'cookie_consent',
    category: COOKIE_CATEGORIES.NECESSARY,
    duration: '6_months',
    purpose: 'cookie_consent',
    provider: 'First-party',
    type: 'cookie'
  },
  {
    name: 'next-auth.session-token',
    category: COOKIE_CATEGORIES.NECESSARY,
    duration: '30_days',
    purpose: 'session_token',
    provider: 'First-party (NextAuth.js)',
    type: 'cookie'
  },
  {
    name: '__Secure-next-auth.session-token',
    category: COOKIE_CATEGORIES.NECESSARY,
    duration: '30_days',
    purpose: 'secure_session_token',
    provider: 'First-party (NextAuth.js)',
    type: 'cookie'
  },
  {
    name: 'next-auth.csrf-token',
    category: COOKIE_CATEGORIES.NECESSARY,
    duration: 'session',
    purpose: 'csrf_protection',
    provider: 'First-party (NextAuth.js)',
    type: 'cookie'
  },
  {
    name: '__Host-next-auth.csrf-token',
    category: COOKIE_CATEGORIES.NECESSARY,
    duration: 'session',
    purpose: 'secure_csrf_protection',
    provider: 'First-party (NextAuth.js)',
    type: 'cookie'
  },
  {
    name: 'next-auth.callback-url',
    category: COOKIE_CATEGORIES.NECESSARY,
    duration: 'session',
    purpose: 'auth_callback',
    provider: 'First-party (NextAuth.js)',
    type: 'cookie'
  },
  // Langue déplacée vers NECESSARY (essentiel pour l'UX)
  {
    name: 'language',
    category: COOKIE_CATEGORIES.NECESSARY,
    duration: '1_year',
    purpose: 'language_preference',
    provider: 'First-party',
    type: 'localStorage'
  },

  // ========== COOKIES ANALYTIQUES ==========
  // Préparé pour Plausible Analytics (privacy-friendly, sans cookies par défaut)
  // Les cookies seront ajoutés ici si Plausible est configuré avec cookies optionnels
];

/**
 * Récupère tous les cookies d'une catégorie
 */
export function getCookiesByCategory(category) {
  return COOKIE_REGISTRY.filter(cookie => cookie.category === category);
}

/**
 * Récupère un cookie spécifique par son nom
 */
export function getCookieByName(name) {
  return COOKIE_REGISTRY.find(cookie => cookie.name === name);
}

/**
 * Compte le nombre de cookies par catégorie
 */
export function getCookieCountByCategory() {
  return {
    [COOKIE_CATEGORIES.NECESSARY]: getCookiesByCategory(COOKIE_CATEGORIES.NECESSARY).length,
    [COOKIE_CATEGORIES.ANALYTICS]: getCookiesByCategory(COOKIE_CATEGORIES.ANALYTICS).length,
  };
}

/**
 * Récupère tous les fournisseurs tiers
 */
export function getThirdPartyProviders() {
  const providers = new Set();
  COOKIE_REGISTRY.forEach(cookie => {
    if (cookie.provider.toLowerCase().includes('third-party')) {
      const providerName = cookie.provider.match(/\(([^)]+)\)/)?.[1];
      if (providerName) {
        providers.add(providerName);
      }
    }
  });
  return Array.from(providers);
}
