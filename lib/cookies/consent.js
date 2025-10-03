/**
 * Gestion du consentement des cookies conforme RGPD
 */

/**
 * Helper pour logger le consentement en base (appel API non-bloquant)
 * Ne bloque pas l'utilisateur en cas d'erreur
 */
async function logConsentToDatabase(action, preferences) {
  if (typeof window === 'undefined') return;

  try {
    await fetch('/api/consent/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, preferences }),
    });
  } catch (error) {
    // Erreur silencieuse - ne pas bloquer l'utilisateur
    console.warn('[Consent] Impossible de logger en base:', error);
  }
}

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

  // Récupérer l'ancien consentement pour détecter les changements
  const oldConsent = getConsent();

  const consentWithTimestamp = {
    ...consent,
    timestamp: Date.now(),
    version: '1.0',
  };

  const value = encodeURIComponent(JSON.stringify(consentWithTimestamp));
  const maxAge = CONSENT_DURATION / 1000; // En secondes

  // Cookie avec SameSite=Lax pour la sécurité
  // Secure uniquement en HTTPS (production)
  const isSecure = window.location.protocol === 'https:';
  const secureFlag = isSecure ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE_NAME}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${secureFlag}`;

  // Révoquer les cookies si le consentement a été retiré
  if (oldConsent) {
    Object.values(COOKIE_CATEGORIES).forEach(category => {
      if (category !== COOKIE_CATEGORIES.NECESSARY) {
        const wasAccepted = oldConsent[category] === true;
        const isAccepted = consent[category] === true;

        // Si le cookie était accepté mais ne l'est plus, le révoquer
        if (wasAccepted && !isAccepted) {
          revokeCookiesByCategory(category);
        }
      }
    });
  }

  // Logger en base de données (non-bloquant)
  const action = oldConsent ? 'updated' : 'created';
  logConsentToDatabase(action, consent).catch(() => {});

  // Notifier les autres onglets via BroadcastChannel
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel('cookie_consent_channel');
      channel.postMessage({ type: 'consent-updated', consent: consentWithTimestamp });
      channel.close();
    } catch (error) {
      console.error('Erreur lors de la notification BroadcastChannel:', error);
    }
  }
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

  // Révoquer tous les cookies non nécessaires
  revokeAllNonEssentialCookies();

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

  // Logger la révocation avant de supprimer
  const currentConsent = getConsent();
  if (currentConsent) {
    logConsentToDatabase('revoked', currentConsent).catch(() => {});
  }

  document.cookie = `${CONSENT_COOKIE_NAME}=; path=/; max-age=0`;

  // Notifier les autres onglets
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel('cookie_consent_channel');
      channel.postMessage({ type: 'consent-updated', consent: null });
      channel.close();
    } catch (error) {
      console.error('Erreur lors de la notification BroadcastChannel:', error);
    }
  }
}

/**
 * Révoque les cookies d'une catégorie spécifique
 * Supprime les cookies, localStorage et sessionStorage liés
 */
export function revokeCookiesByCategory(category) {
  if (typeof window === 'undefined') return;

  // Map des cookies par catégorie
  const cookiesByCategory = {
    [COOKIE_CATEGORIES.FUNCTIONAL]: [
      // Ajouter ici les cookies fonctionnels si nécessaire
    ],
    [COOKIE_CATEGORIES.ANALYTICS]: [
      '_ga', '_gid', '_gat', '_ga_*', // Google Analytics
    ],
    [COOKIE_CATEGORIES.MARKETING]: [
      '_fbp', '_fbc', // Facebook Pixel
      'fr', // Facebook
      'IDE', 'test_cookie', // Google Ads
    ],
  };

  const cookiesToDelete = cookiesByCategory[category] || [];

  // Supprimer les cookies
  cookiesToDelete.forEach(cookieName => {
    // Support des wildcards (ex: _ga_*)
    if (cookieName.includes('*')) {
      const prefix = cookieName.replace('*', '');
      const allCookies = document.cookie.split(';');
      allCookies.forEach(cookie => {
        const name = cookie.split('=')[0].trim();
        if (name.startsWith(prefix)) {
          deleteCookie(name);
        }
      });
    } else {
      deleteCookie(cookieName);
    }
  });

  // Nettoyer localStorage pour analytics
  if (category === COOKIE_CATEGORIES.ANALYTICS) {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('_ga') || key.includes('analytics')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Impossible de nettoyer localStorage:', e);
    }
  }
}

/**
 * Supprime un cookie spécifique
 */
function deleteCookie(name) {
  // Supprimer pour tous les chemins et domaines possibles
  document.cookie = `${name}=; path=/; max-age=0`;
  document.cookie = `${name}=; path=/; max-age=0; domain=${window.location.hostname}`;
  document.cookie = `${name}=; path=/; max-age=0; domain=.${window.location.hostname}`;
}

/**
 * Révoque tous les cookies non nécessaires
 */
export function revokeAllNonEssentialCookies() {
  revokeCookiesByCategory(COOKIE_CATEGORIES.FUNCTIONAL);
  revokeCookiesByCategory(COOKIE_CATEGORIES.ANALYTICS);
  revokeCookiesByCategory(COOKIE_CATEGORIES.MARKETING);
}