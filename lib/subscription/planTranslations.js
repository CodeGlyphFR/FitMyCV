/**
 * Traduction des noms de plans d'abonnement
 *
 * Les noms de plans sont stockés en français dans la base de données.
 * Cette fonction les traduit selon la langue active.
 */

const PLAN_TRANSLATIONS = {
  'Gratuit': {
    en: 'Free',
    fr: 'Gratuit',
    es: 'Gratuito',
    de: 'Kostenlos'
  },
  'Business': {
    en: 'Business',
    fr: 'Business',
    es: 'Business',
    de: 'Business'
  },
  'Pro': {
    en: 'Pro',
    fr: 'Pro',
    es: 'Pro',
    de: 'Pro'
  },
  'Premium': {
    en: 'Premium',
    fr: 'Premium',
    es: 'Premium',
    de: 'Premium'
  },
  'Enterprise': {
    en: 'Enterprise',
    fr: 'Enterprise',
    es: 'Enterprise',
    de: 'Enterprise'
  }
};

/**
 * Traduit le nom d'un plan selon la langue
 * @param {string} planName - Nom du plan en français (ex: "Gratuit")
 * @param {string} language - Code langue ('fr' ou 'en')
 * @returns {string} Nom traduit du plan
 */
export function translatePlanName(planName, language = 'fr') {
  if (!planName) return '';

  const translation = PLAN_TRANSLATIONS[planName];
  if (!translation) {
    // Si pas de traduction trouvée, retourner le nom original
    console.warn(`No translation found for plan: ${planName}`);
    return planName;
  }

  return translation[language] || planName;
}
