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
  gpt_cv_generation_rapid: 1,
  gpt_cv_generation_medium: 2,
  gpt_cv_generation_deep: 0, // 0 = Premium requis
  optimize_cv: 2,
  generate_cv_from_job_title: 3,
  import_pdf: 5,
};

/**
 * Construit le nom du setting en fonction de la feature et du niveau d'analyse
 * @param {string} featureName - Nom de la feature
 * @param {string|null} analysisLevel - Niveau d'analyse (pour gpt_cv_generation)
 * @returns {string} Nom du setting
 */
function buildSettingName(featureName, analysisLevel) {
  // Pour gpt_cv_generation, inclure le niveau d'analyse
  if (featureName === 'gpt_cv_generation' && analysisLevel) {
    return `credits_gpt_cv_generation_${analysisLevel}`;
  }

  // Pour les autres features, utiliser directement le nom
  return `credits_${featureName}`;
}

/**
 * Construit la clé par défaut pour récupérer la valeur de fallback
 * @param {string} featureName - Nom de la feature
 * @param {string|null} analysisLevel - Niveau d'analyse
 * @returns {string} Clé pour DEFAULT_CREDIT_COSTS
 */
function buildDefaultKey(featureName, analysisLevel) {
  if (featureName === 'gpt_cv_generation' && analysisLevel) {
    return `gpt_cv_generation_${analysisLevel}`;
  }
  return featureName;
}

/**
 * Récupère le coût en crédits pour une feature donnée
 * @param {string} featureName - Nom de la feature (gpt_cv_generation, import_pdf, etc.)
 * @param {string|null} analysisLevel - Niveau d'analyse pour gpt_cv_generation ('rapid', 'medium', 'deep')
 * @returns {Promise<{cost: number, premiumRequired: boolean, settingName: string}>}
 */
export async function getCreditCostForFeature(featureName, analysisLevel = null) {
  const settingName = buildSettingName(featureName, analysisLevel);
  const defaultKey = buildDefaultKey(featureName, analysisLevel);
  const defaultCost = DEFAULT_CREDIT_COSTS[defaultKey] ?? 1;

  try {
    // Récupérer la valeur depuis la DB (pas de cache)
    const cost = await getNumericSettingValue(settingName, defaultCost);

    // 0 = Premium requis (bloquer même avec crédits)
    const premiumRequired = cost === 0;

    console.log(
      `[CreditCost] Feature: ${featureName}${analysisLevel ? ` (${analysisLevel})` : ''} → Setting: ${settingName} → Cost: ${cost}${premiumRequired ? ' (Premium requis)' : ''}`
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
 * @param {string|null} analysisLevel - Niveau d'analyse
 * @returns {Promise<boolean>}
 */
export async function isPremiumOnlyFeature(featureName, analysisLevel = null) {
  const { premiumRequired } = await getCreditCostForFeature(featureName, analysisLevel);
  return premiumRequired;
}
