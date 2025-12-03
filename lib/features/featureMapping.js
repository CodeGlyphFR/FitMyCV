/**
 * Feature Mapping Helper
 * Centralise les correspondances entre features métier (featureKey) et leurs implémentations techniques
 * (Setting, OpenAICall, SubscriptionPlanFeatureLimit)
 */

import prisma from '@/lib/prisma';

// Cache en mémoire pour les feature mappings
const featureMappingCache = new Map();

/**
 * Récupère le mapping complet d'une feature
 * @param {string} featureKey - Clé de la feature (ex: "match_score", "gpt_cv_generation")
 * @returns {Promise<{featureKey: string, displayName: string, settingNames: string[], openAICallNames: string[], planFeatureNames: string[]}>}
 * @throws {Error} Si la feature n'existe pas
 */
export async function getFeatureMapping(featureKey) {
  // Vérifier le cache d'abord
  if (featureMappingCache.has(featureKey)) {
    return featureMappingCache.get(featureKey);
  }

  try {
    const mapping = await prisma.featureMapping.findUnique({
      where: { featureKey },
    });

    if (!mapping) {
      throw new Error(`Feature mapping "${featureKey}" non trouvé en base de données.`);
    }

    // Les champs sont déjà des arrays grâce au type Json de Prisma
    const result = {
      featureKey: mapping.featureKey,
      displayName: mapping.displayName,
      settingNames: mapping.settingNames,
      openAICallNames: mapping.openAICallNames,
      planFeatureNames: mapping.planFeatureNames,
    };

    // Mettre en cache
    featureMappingCache.set(featureKey, result);

    return result;
  } catch (error) {
    console.error(`[getFeatureMapping] Erreur lors de la récupération de ${featureKey}:`, error);
    throw error;
  }
}

/**
 * Récupère tous les feature mappings
 * @returns {Promise<Array>}
 */
export async function getAllFeatureMappings() {
  try {
    const mappings = await prisma.featureMapping.findMany({
      orderBy: { featureKey: 'asc' },
    });

    return mappings.map((m) => ({
      featureKey: m.featureKey,
      displayName: m.displayName,
      settingNames: m.settingNames,
      openAICallNames: m.openAICallNames,
      planFeatureNames: m.planFeatureNames,
    }));
  } catch (error) {
    console.error('[getAllFeatureMappings] Erreur:', error);
    throw error;
  }
}

/**
 * Récupère uniquement les noms de settings pour une feature
 * @param {string} featureKey - Clé de la feature
 * @returns {Promise<string[]>} - Liste des settingNames
 */
export async function getSettingNamesForFeature(featureKey) {
  const mapping = await getFeatureMapping(featureKey);
  return mapping.settingNames;
}

/**
 * Récupère uniquement les noms OpenAI pour une feature
 * @param {string} featureKey - Clé de la feature
 * @returns {Promise<string[]>} - Liste des openAICallNames
 */
export async function getOpenAICallNamesForFeature(featureKey) {
  const mapping = await getFeatureMapping(featureKey);
  return mapping.openAICallNames;
}

/**
 * Récupère uniquement les noms de plan features pour une feature
 * @param {string} featureKey - Clé de la feature
 * @returns {Promise<string[]>} - Liste des planFeatureNames
 */
export async function getPlanFeatureNamesForFeature(featureKey) {
  const mapping = await getFeatureMapping(featureKey);
  return mapping.planFeatureNames;
}

/**
 * Trouve la featureKey à partir d'un nom OpenAICall
 * @param {string} openAICallName - Nom du featureName dans OpenAICall
 * @returns {Promise<string|null>} - featureKey correspondante ou null
 */
export async function getFeatureKeyFromOpenAICallName(openAICallName) {
  const allMappings = await getAllFeatureMappings();

  for (const mapping of allMappings) {
    if (mapping.openAICallNames.includes(openAICallName)) {
      return mapping.featureKey;
    }
  }

  return null;
}

/**
 * Trouve la featureKey à partir d'un nom Setting
 * @param {string} settingName - Nom du setting (ex: "model_match_score")
 * @returns {Promise<string|null>} - featureKey correspondante ou null
 */
export async function getFeatureKeyFromSettingName(settingName) {
  const allMappings = await getAllFeatureMappings();

  for (const mapping of allMappings) {
    if (mapping.settingNames.includes(settingName)) {
      return mapping.featureKey;
    }
  }

  return null;
}

/**
 * Invalide le cache des feature mappings
 * Utilisé après modification des mappings (ex: depuis le dashboard admin)
 */
export function clearFeatureMappingCache() {
  featureMappingCache.clear();
  console.log('[clearFeatureMappingCache] Cache des feature mappings invalidé');
}

/**
 * Précharge tous les feature mappings en cache
 * Optimisation optionnelle au démarrage de l'application
 */
export async function preloadFeatureMappings() {
  try {
    const mappings = await getAllFeatureMappings();
    mappings.forEach((mapping) => {
      featureMappingCache.set(mapping.featureKey, mapping);
    });
    console.log(`[preloadFeatureMappings] ${mappings.length} feature mappings préchargés en cache`);
  } catch (error) {
    console.error('[preloadFeatureMappings] Erreur lors du préchargement:', error);
    // Ne pas throw pour ne pas bloquer le démarrage de l'app
  }
}
