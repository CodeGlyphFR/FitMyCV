/**
 * Utilitaires pour la localisation des messages Stripe Checkout
 * Réutilise les traductions i18n existantes
 */

// Import des traductions subscription pour chaque langue
import frSubscription from '@/locales/fr/subscription.json';
import enSubscription from '@/locales/en/subscription.json';
import esSubscription from '@/locales/es/subscription.json';
import deSubscription from '@/locales/de/subscription.json';

const translations = {
  fr: frSubscription,
  en: enSubscription,
  es: esSubscription,
  de: deSubscription,
};

/**
 * Construit le message d'acceptation des CGV pour Stripe Checkout
 * Format: "J'accepte les [Conditions Générales de Vente](url)."
 * @param {string} locale - Code langue (fr, en, es, de)
 * @returns {string} Message formaté avec lien markdown
 */
export function getTermsMessage(locale = 'fr') {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const t = translations[locale] || translations['en'];

  // Utilise les clés existantes: comparison.upgradeModal.termsLabel + comparison.upgradeModal.termsLink
  const termsLabel = t.subscription?.comparison?.upgradeModal?.termsLabel || "I accept the";
  const termsLink = t.subscription?.comparison?.upgradeModal?.termsLink || "Terms of Service";

  return `${termsLabel} [${termsLink}](${baseUrl}/terms).`;
}
