/**
 * Système de gestion des coûts en crédits par feature
 *
 * Récupère le coût en crédits depuis les Settings de la base de données.
 * Pas de cache : chaque appel fait une requête DB pour permettre la modification
 * dynamique des coûts via l'interface admin.
 */

import { getNumericSettingValue } from '@/lib/settings/settingsUtils';

// Valeurs par défaut si le setting n'existe pas en DB
const DEFAULT_CREDIT_COSTS = {
  create_cv_manual: 1,
  edit_cv: 1,
  export_cv: 1,
  match_score: 1,
  translate_cv: 1,
  // add_skills supprimé - fusionné dans optimize_cv
  gpt_cv_generation: 2,
  optimize_cv: 2,  // Coût unique pour toute optimisation (skills et/ou suggestions)
  generate_cv_from_job_title: 3,
  import_pdf: 5,
};

/**
 * Récupère le coût en crédits pour une feature donnée
 * @param {string} featureName - Nom de la feature (gpt_cv_generation, import_pdf, etc.)
 * @returns {Promise<{cost: number, premiumRequired: boolean, settingName: string}>}
 */
export async function getCreditCostForFeature(featureName) {
  const settingName = `credits_${featureName}`;
  const defaultCost = DEFAULT_CREDIT_COSTS[featureName] ?? 1;

  try {
    // Récupérer la valeur depuis la DB (pas de cache)
    const cost = await getNumericSettingValue(settingName, defaultCost);

    // 0 = Premium requis (bloquer même avec crédits)
    const premiumRequired = cost === 0;

    console.log(
      `[CreditCost] Feature: ${featureName} → Setting: ${settingName} → Cost: ${cost}${premiumRequired ? ' (Premium requis)' : ''}`
    );

    return {
      cost,
      premiumRequired,
      settingName,
    };
  } catch (error) {
    console.error(`[CreditCost] Erreur lors de la récupération du coût pour ${settingName}:`, error);

    // En cas d'erreur, utiliser la valeur par défaut
    return {
      cost: defaultCost,
      premiumRequired: defaultCost === 0,
      settingName,
    };
  }
}

/**
 * Vérifie si une feature est réservée aux abonnés Premium
 * (utile pour affichage UI)
 * @param {string} featureName - Nom de la feature
 * @returns {Promise<boolean>}
 */
export async function isPremiumOnlyFeature(featureName) {
  const { premiumRequired } = await getCreditCostForFeature(featureName);
  return premiumRequired;
}
