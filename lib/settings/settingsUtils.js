/**
 * Utilitaires pour récupérer les settings depuis la base de données
 */

import prisma from '@/lib/prisma';

/**
 * Récupère la valeur d'un setting spécifique depuis la base de données
 * @param {string} settingName - Nom du setting à récupérer
 * @param {any} defaultValue - Valeur par défaut si le setting n'existe pas
 * @returns {Promise<any>} La valeur du setting ou la valeur par défaut
 */
export async function getSettingValue(settingName, defaultValue = null) {
  try {
    const setting = await prisma.setting.findUnique({
      where: { settingName },
      select: { value: true },
    });

    if (!setting) {
      return defaultValue;
    }

    return setting.value;
  } catch (error) {
    console.error(`[settingsUtils] Erreur lors de la récupération du setting "${settingName}":`, error);
    return defaultValue;
  }
}

/**
 * Récupère la valeur d'un setting numérique
 * @param {string} settingName - Nom du setting à récupérer
 * @param {number} defaultValue - Valeur par défaut si le setting n'existe pas
 * @returns {Promise<number>} La valeur du setting convertie en nombre
 */
export async function getNumericSettingValue(settingName, defaultValue = 0) {
  const value = await getSettingValue(settingName, defaultValue.toString());
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Récupère la valeur d'un setting booléen (converti depuis "1"/"0")
 * @param {string} settingName - Nom du setting à récupérer
 * @param {boolean} defaultValue - Valeur par défaut si le setting n'existe pas
 * @returns {Promise<boolean>} La valeur du setting convertie en booléen
 */
export async function getBooleanSettingValue(settingName, defaultValue = false) {
  const value = await getSettingValue(settingName, defaultValue ? '1' : '0');
  return value === '1' || value === 'true';
}

/**
 * Récupère le nombre de tokens par défaut pour les nouveaux utilisateurs
 * @returns {Promise<number>} Nombre de tokens par défaut
 */
export async function getDefaultTokenLimit() {
  return await getNumericSettingValue('token_default_limit', 10);
}
