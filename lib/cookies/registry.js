/**
 * Registre complet des cookies utilisés sur le site
 * Conforme RGPD - Liste tous les cookies avec leurs caractéristiques
 */

import { COOKIE_CATEGORIES } from './consent';

/**
 * Structure d'un cookie dans le registre:
 * - name: nom du cookie
 * - category: catégorie (necessary, functional, analytics, marketing)
 * - duration: durée de vie
 * - purpose: finalité du cookie
 * - provider: fournisseur (first-party / third-party)
 * - type: type de stockage (cookie / localStorage / sessionStorage)
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

  // ========== COOKIES FONCTIONNELS ==========
  {
    name: 'theme',
    category: COOKIE_CATEGORIES.FUNCTIONAL,
    duration: '1_year',
    purpose: 'theme_preference',
    provider: 'First-party',
    type: 'localStorage'
  },
  {
    name: 'language',
    category: COOKIE_CATEGORIES.FUNCTIONAL,
    duration: '1_year',
    purpose: 'language_preference',
    provider: 'First-party',
    type: 'localStorage'
  },

  // ========== COOKIES ANALYTIQUES ==========
  {
    name: '_ga',
    category: COOKIE_CATEGORIES.ANALYTICS,
    duration: '2_years',
    purpose: 'ga_unique_users',
    provider: 'Third-party (Google)',
    type: 'cookie'
  },
  {
    name: '_gid',
    category: COOKIE_CATEGORIES.ANALYTICS,
    duration: '24_hours',
    purpose: 'ga_distinguish_users',
    provider: 'Third-party (Google)',
    type: 'cookie'
  },
  {
    name: '_gat',
    category: COOKIE_CATEGORIES.ANALYTICS,
    duration: '1_minute',
    purpose: 'ga_rate_limit',
    provider: 'Third-party (Google)',
    type: 'cookie'
  },
  {
    name: '_ga_*',
    category: COOKIE_CATEGORIES.ANALYTICS,
    duration: '2_years',
    purpose: 'ga4_session_state',
    provider: 'Third-party (Google)',
    type: 'cookie'
  },

  // ========== COOKIES MARKETING ==========
  {
    name: '_fbp',
    category: COOKIE_CATEGORIES.MARKETING,
    duration: '3_months',
    purpose: 'fb_pixel_tracking',
    provider: 'Third-party (Meta)',
    type: 'cookie'
  },
  {
    name: '_fbc',
    category: COOKIE_CATEGORIES.MARKETING,
    duration: '3_months',
    purpose: 'fb_cross_site_tracking',
    provider: 'Third-party (Meta)',
    type: 'cookie'
  },
  {
    name: 'fr',
    category: COOKIE_CATEGORIES.MARKETING,
    duration: '3_months',
    purpose: 'fb_targeted_ads',
    provider: 'Third-party (Meta)',
    type: 'cookie'
  },
  {
    name: 'IDE',
    category: COOKIE_CATEGORIES.MARKETING,
    duration: '13_months',
    purpose: 'google_ads_retargeting',
    provider: 'Third-party (Google)',
    type: 'cookie'
  },
  {
    name: 'test_cookie',
    category: COOKIE_CATEGORIES.MARKETING,
    duration: '15_minutes',
    purpose: 'google_ads_cookie_test',
    provider: 'Third-party (Google)',
    type: 'cookie'
  }
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
    [COOKIE_CATEGORIES.FUNCTIONAL]: getCookiesByCategory(COOKIE_CATEGORIES.FUNCTIONAL).length,
    [COOKIE_CATEGORIES.ANALYTICS]: getCookiesByCategory(COOKIE_CATEGORIES.ANALYTICS).length,
    [COOKIE_CATEGORIES.MARKETING]: getCookiesByCategory(COOKIE_CATEGORIES.MARKETING).length,
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
