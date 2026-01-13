import prisma from '@/lib/prisma';

// Cache en mémoire pour les settings de modèles IA
const aiModelCache = new Map();

/**
 * Récupère un setting de modèle IA depuis la base de données
 * @param {string} settingName - Nom du setting (ex: "model_cv_generation", "model_match_score")
 * @returns {Promise<string>} - Nom du modèle
 * @throws {Error} Si le setting n'existe pas en DB
 */
export async function getAiModelSetting(settingName) {
  // Vérifier le cache d'abord
  if (aiModelCache.has(settingName)) {
    return aiModelCache.get(settingName);
  }

  try {
    const setting = await prisma.setting.findUnique({
      where: { settingName },
      select: { value: true }
    });

    if (!setting) {
      throw new Error(`Setting "${settingName}" non trouvé en base de données. Exécutez le seed.`);
    }

    // Mettre en cache
    aiModelCache.set(settingName, setting.value);

    return setting.value;
  } catch (error) {
    console.error(`[getAiModelSetting] Erreur lors de la récupération de ${settingName}:`, error);
    throw error;
  }
}

/**
 * Récupère le modèle pour la génération CV
 * @returns {Promise<string>} - Nom du modèle
 * @throws {Error} Si le setting n'existe pas
 */
export async function getCvGenerationModel() {
  return await getAiModelSetting('model_cv_generation');
}

/**
 * Invalide le cache des modèles IA
 * Utilisé après modification des settings (ex: depuis le dashboard admin)
 */
export function clearAiModelCache() {
  aiModelCache.clear();
  console.log('[clearAiModelCache] Cache des modèles IA invalidé');
}

/**
 * Récupère le modèle pour l'amélioration d'expérience (Pipeline V2)
 * @returns {Promise<string>} - Nom du modèle
 * @throws {Error} Si le setting n'existe pas
 */
export async function getImproveExperienceModel() {
  return await getAiModelSetting('model_improve_experience');
}

/**
 * Récupère le modèle pour l'amélioration de projet (Pipeline V2)
 * @returns {Promise<string>} - Nom du modèle
 * @throws {Error} Si le setting n'existe pas
 */
export async function getImproveProjectModel() {
  return await getAiModelSetting('model_improve_project');
}

/**
 * Récupère le modèle pour l'amélioration du summary (Pipeline V2)
 * @returns {Promise<string>} - Nom du modèle
 * @throws {Error} Si le setting n'existe pas
 */
export async function getImproveSummaryModel() {
  return await getAiModelSetting('model_improve_summary');
}

/**
 * Récupère le modèle pour la classification des skills (Pipeline V2)
 * @returns {Promise<string>} - Nom du modèle
 * @throws {Error} Si le setting n'existe pas
 */
export async function getImproveClassifySkillsModel() {
  return await getAiModelSetting('model_improve_classify_skills');
}

/**
 * Récupère le modèle pour le preprocessing des suggestions (Pipeline V2)
 * @returns {Promise<string>} - Nom du modèle
 * @throws {Error} Si le setting n'existe pas
 */
export async function getImprovePreprocessModel() {
  return await getAiModelSetting('model_improve_preprocess');
}

/**
 * Précharge tous les settings de modèles IA en cache
 * Optimisation optionnelle au démarrage de l'application
 */
export async function preloadAiModelSettings() {
  try {
    const settings = await prisma.setting.findMany({
      where: { category: 'ai_models' },
      select: { settingName: true, value: true }
    });

    settings.forEach(setting => {
      aiModelCache.set(setting.settingName, setting.value);
    });

    console.log(`[preloadAiModelSettings] ${settings.length} settings de modèles IA préchargés en cache`);
  } catch (error) {
    console.error('[preloadAiModelSettings] Erreur lors du préchargement:', error);
    // Ne pas throw pour ne pas bloquer le démarrage de l'app
  }
}
