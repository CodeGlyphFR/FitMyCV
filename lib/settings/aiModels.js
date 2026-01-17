import prisma from '@/lib/prisma';

/**
 * Récupère un setting de modèle IA depuis la base de données
 * Note: Pas de cache pour garantir que les changements de settings sont pris en compte immédiatement
 * @param {string} settingName - Nom du setting (ex: "model_cv_generation", "model_match_score")
 * @returns {Promise<string>} - Nom du modèle
 * @throws {Error} Si le setting n'existe pas en DB
 */
export async function getAiModelSetting(settingName) {
  try {
    const setting = await prisma.setting.findUnique({
      where: { settingName },
      select: { value: true }
    });

    if (!setting) {
      throw new Error(`Setting "${settingName}" non trouvé en base de données. Exécutez le seed.`);
    }

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
 * Fonction conservée pour compatibilité API (no-op)
 * @deprecated Plus de cache - les settings sont lus directement depuis la DB
 */
export function clearAiModelCache() {
  // No-op - plus de cache
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
 * Récupère le modèle pour l'optimisation des langues (Pipeline V2)
 * @returns {Promise<string>} - Nom du modèle
 * @throws {Error} Si le setting n'existe pas
 */
export async function getImproveLanguagesModel() {
  return await getAiModelSetting('model_improve_languages');
}

/**
 * Récupère le modèle pour les extras (certifications, hobbies, etc.) (Pipeline V2)
 * Fallback sur le modèle languages si le setting n'existe pas
 * @returns {Promise<string>} - Nom du modèle
 */
export async function getImproveExtrasModel() {
  try {
    return await getAiModelSetting('model_improve_extras');
  } catch {
    // Fallback sur le modèle languages (même niveau de complexité)
    return await getAiModelSetting('model_improve_languages');
  }
}

/**
 * Fonction conservée pour compatibilité (no-op)
 * @deprecated Plus de cache - les settings sont lus directement depuis la DB
 */
export async function preloadAiModelSettings() {
  // No-op - plus de cache
}
