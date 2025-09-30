/**
 * Gestion du consentement des cookies conforme RGPD
 */

// Types de cookies
export const COOKIE_CATEGORIES = {
  NECESSARY: 'necessary',      // Cookies nécessaires (toujours actifs)
  FUNCTIONAL: 'functional',    // Cookies fonctionnels
  ANALYTICS: 'analytics',      // Cookies analytiques
  MARKETING: 'marketing',      // Cookies marketing
};

// Durée de validité du consentement (6 mois en millisecondes)
export const CONSENT_DURATION = 6 * 30 * 24 * 60 * 60 * 1000;

// Nom du cookie de consentement
export const CONSENT_COOKIE_NAME = 'cookie_consent';

/**
 * Structure du consentement par défaut
 */
export const DEFAULT_CONSENT = {
  [COOKIE_CATEGORIES.NECESSARY]: true,    // Toujours actif
  [COOKIE_CATEGORIES.FUNCTIONAL]: false,
  [COOKIE_CATEGORIES.ANALYTICS]: false,
  [COOKIE_CATEGORIES.MARKETING]: false,
  timestamp: null,
  version: '1.0',
};

/**
 * Récupère le consentement depuis les cookies
 */
export function getConsent() {
  if (typeof window === 'undefined') return null;

  try {
    const cookies = document.cookie.split(';');
    const consentCookie = cookies.find(c => c.trim().startsWith(`${CONSENT_COOKIE_NAME}=`));

    if (!consentCookie) return null;

    const value = consentCookie.split('=')[1];
    const consent = JSON.parse(decodeURIComponent(value));

    // Vérifier si le consentement est encore valide
    if (consent.timestamp && Date.now() - consent.timestamp > CONSENT_DURATION) {
      return null;
    }

    return consent;
  } catch (error) {
    console.error('Erreur lors de la lecture du consentement:', error);
    return null;
  }
}

/**
 * Sauvegarde le consentement dans un cookie
 */
export function saveConsent(consent) {
  if (typeof window === 'undefined') return;

  const consentWithTimestamp = {
    ...consent,
    timestamp: Date.now(),
    version: '1.0',
  };

  const value = encodeURIComponent(JSON.stringify(consentWithTimestamp));
  const maxAge = CONSENT_DURATION / 1000; // En secondes

  // Cookie avec SameSite=Lax pour la sécurité
  document.cookie = `${CONSENT_COOKIE_NAME}=${value}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
}

/**
 * Accepte tous les cookies
 */
export function acceptAllCookies() {
  const consent = {
    [COOKIE_CATEGORIES.NECESSARY]: true,
    [COOKIE_CATEGORIES.FUNCTIONAL]: true,
    [COOKIE_CATEGORIES.ANALYTICS]: true,
    [COOKIE_CATEGORIES.MARKETING]: true,
  };
  saveConsent(consent);
  return consent;
}

/**
 * Refuse tous les cookies non nécessaires
 */
export function rejectAllCookies() {
  const consent = {
    [COOKIE_CATEGORIES.NECESSARY]: true,
    [COOKIE_CATEGORIES.FUNCTIONAL]: false,
    [COOKIE_CATEGORIES.ANALYTICS]: false,
    [COOKIE_CATEGORIES.MARKETING]: false,
  };
  saveConsent(consent);
  return consent;
}

/**
 * Vérifie si une catégorie de cookie est acceptée
 */
export function isCategoryAccepted(category) {
  const consent = getConsent();
  if (!consent) return false;
  return consent[category] === true;
}

/**
 * Supprime le consentement (pour tester)
 */
export function clearConsent() {
  if (typeof window === 'undefined') return;
  document.cookie = `${CONSENT_COOKIE_NAME}=; path=/; max-age=0`;
}