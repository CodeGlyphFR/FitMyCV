import OpenAI from 'openai';
import { getAiModelForAnalysisLevel } from '@/lib/settings/aiModels';

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY est manquant.");
  }

  const client = new OpenAI({ apiKey });
  return client;
}

/**
 * Récupère le modèle OpenAI à utiliser selon le niveau d'analyse
 * @param {string} analysisLevel - Niveau d'analyse ('rapid', 'medium', 'deep')
 * @param {string|null} requestedModel - Modèle spécifique demandé (prioritaire)
 * @returns {Promise<string>} - Nom du modèle OpenAI
 */
export async function getModelForAnalysisLevel(analysisLevel, requestedModel = null) {
  // Si un modèle spécifique est demandé, le prioriser
  if (requestedModel) {
    return requestedModel;
  }

  // Sinon, récupérer depuis la base de données
  return await getAiModelForAnalysisLevel(analysisLevel);
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
      throw new Error('Quota OpenAI dépassé. Vérifiez votre facturation.');
    }

    // Autres erreurs API
    throw error;
  }
}
