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
    duration: '6 mois',
    purpose: 'Stocke les préférences de consentement aux cookies de l\'utilisateur',
    provider: 'First-party',
    type: 'cookie'
  },
  {
    name: 'next-auth.session-token',
    category: COOKIE_CATEGORIES.NECESSARY,
    duration: '30 jours',
    purpose: 'Authentification - Maintient la session utilisateur active',
    provider: 'First-party (NextAuth.js)',
    type: 'cookie'
  },
  {
    name: '__Secure-next-auth.session-token',
    category: COOKIE_CATEGORIES.NECESSARY,
    duration: '30 jours',
    purpose: 'Authentification sécurisée en production - Token de session',
    provider: 'First-party (NextAuth.js)',
    type: 'cookie'
  },
  {
    name: 'next-auth.csrf-token',
    category: COOKIE_CATEGORIES.NECESSARY,
    duration: 'Session',
    purpose: 'Sécurité - Protection contre les attaques CSRF',
    provider: 'First-party (NextAuth.js)',
    type: 'cookie'
  },
  {
    name: '__Host-next-auth.csrf-token',
    category: COOKIE_CATEGORIES.NECESSARY,
    duration: 'Session',
    purpose: 'Sécurité renforcée en production - Protection CSRF',
    provider: 'First-party (NextAuth.js)',
    type: 'cookie'
  },
  {
    name: 'next-auth.callback-url',
    category: COOKIE_CATEGORIES.NECESSARY,
    duration: 'Session',
    purpose: 'Redirection après authentification',
    provider: 'First-party (NextAuth.js)',
    type: 'cookie'
  },

  // ========== COOKIES FONCTIONNELS ==========
  {
    name: 'theme',
    category: COOKIE_CATEGORIES.FUNCTIONAL,
    duration: '1 an',
    purpose: 'Mémorise le thème choisi par l\'utilisateur (clair/sombre)',
    provider: 'First-party',
    type: 'localStorage'
  },
  {
    name: 'language',
    category: COOKIE_CATEGORIES.FUNCTIONAL,
    duration: '1 an',
    purpose: 'Mémorise la langue choisie par l\'utilisateur',
    provider: 'First-party',
    type: 'localStorage'
  },

  // ========== COOKIES ANALYTIQUES ==========
  {
    name: '_ga',
    category: COOKIE_CATEGORIES.ANALYTICS,
    duration: '2 ans',
    purpose: 'Google Analytics - Distingue les utilisateurs uniques',
    provider: 'Third-party (Google)',
    type: 'cookie'
  },
  {
    name: '_gid',
    category: COOKIE_CATEGORIES.ANALYTICS,
    duration: '24 heures',
    purpose: 'Google Analytics - Distingue les utilisateurs',
    provider: 'Third-party (Google)',
    type: 'cookie'
  },
  {
    name: '_gat',
    category: COOKIE_CATEGORIES.ANALYTICS,
    duration: '1 minute',
    purpose: 'Google Analytics - Limite le taux de requêtes',
    provider: 'Third-party (Google)',
    type: 'cookie'
  },
  {
    name: '_ga_*',
    category: COOKIE_CATEGORIES.ANALYTICS,
    duration: '2 ans',
    purpose: 'Google Analytics 4 - Persistance de l\'état de la session',
    provider: 'Third-party (Google)',
    type: 'cookie'
  },

  // ========== COOKIES MARKETING ==========
  {
    name: '_fbp',
    category: COOKIE_CATEGORIES.MARKETING,
    duration: '3 mois',
    purpose: 'Facebook Pixel - Suivi des conversions et publicité ciblée',
    provider: 'Third-party (Meta)',
    type: 'cookie'
  },
  {
    name: '_fbc',
    category: COOKIE_CATEGORIES.MARKETING,
    duration: '3 mois',
    purpose: 'Facebook - Stocke et suit les visites sur plusieurs sites web',
    provider: 'Third-party (Meta)',
    type: 'cookie'
  },
  {
    name: 'fr',
    category: COOKIE_CATEGORIES.MARKETING,
    duration: '3 mois',
    purpose: 'Facebook - Diffusion de publicités ciblées',
    provider: 'Third-party (Meta)',
    type: 'cookie'
  },
  {
    name: 'IDE',
    category: COOKIE_CATEGORIES.MARKETING,
    duration: '13 mois',
    purpose: 'Google Ads - Suivi publicitaire et reciblage',
    provider: 'Third-party (Google)',
    type: 'cookie'
  },
  {
    name: 'test_cookie',
    category: COOKIE_CATEGORIES.MARKETING,
    duration: '15 minutes',
    purpose: 'Google Ads - Teste si le navigateur accepte les cookies',
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
