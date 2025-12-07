import OpenAI from 'openai';
import { getCvGenerationModel } from '@/lib/settings/aiModels';

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.openaiKeyMissing' }));
  }

  const client = new OpenAI({ apiKey });
  return client;
}

/**
 * Récupère le modèle OpenAI à utiliser pour la génération de CV
 * @returns {Promise<string>} - Nom du modèle OpenAI
 */
export async function getCvModel() {
  return await getCvGenerationModel();
}

/**
 * Ajoute conditionnellement le paramètre temperature selon le modèle
 * GPT-5 ne supporte pas le paramètre temperature
 * @param {Object} requestOptions - Options de requête OpenAI
 * @param {number} temperature - Valeur de température (0-2)
 * @returns {Object} - Options avec temperature ajoutée si supportée
 */
export function addTemperatureIfSupported(requestOptions, temperature = 0.1) {
  const model = requestOptions.model || '';

  // GPT-5 ne supporte pas le paramètre temperature
  if (!model.includes('gpt-5')) {
    requestOptions.temperature = temperature;
  }

  return requestOptions;
}

/**
 * Ajoute le paramètre prompt_cache_retention pour les modèles GPT-5.x
 * GPT-5 models support extended 24h cache retention
 * @param {Object} requestOptions - Options de requête OpenAI
 * @returns {Object} - Options avec cache retention si applicable
 */
export function addCacheRetentionIfSupported(requestOptions) {
  const model = requestOptions.model || '';

  // GPT-5 models support 24h cache retention
  if (model.startsWith('gpt-5')) {
    return { ...requestOptions, prompt_cache_retention: '24h' };
  }

  return requestOptions;
}

/**
 * Vérifie rapidement si le compte OpenAI a des crédits disponibles
 * Fait un appel minimal (<1 token) pour détecter les erreurs de quota
 * @throws {Error} Si quota dépassé ou autre erreur API
 * @returns {Promise<boolean>} true si crédits OK
 */
export async function checkOpenAICredits() {
  const client = getOpenAIClient();

  try {
    // Appel minimal avec le modèle le moins cher et 1 token max
    await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'ok' }],
      max_completion_tokens: 1
    });

    return true;
  } catch (error) {
    // Détecter spécifiquement les erreurs de quota
    const isQuotaError = error.message && /insufficient_quota|exceeded your current quota/i.test(error.message);

    if (isQuotaError) {
      throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.openaiQuotaExceeded' }));
    }

    // Autres erreurs API
    throw error;
  }
}
