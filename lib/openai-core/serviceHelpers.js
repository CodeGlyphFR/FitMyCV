/**
 * Helpers communs pour les services OpenAI
 *
 * Factorise le boilerplate répétitif :
 * - Vérification des crédits
 * - Appels OpenAI avec timing et tracking
 * - Gestion des erreurs (abort, quota)
 */

import { getOpenAIClient, checkOpenAICredits, addTemperatureIfSupported } from './client';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';

/**
 * Vérifie les crédits OpenAI avec logging standardisé
 * @param {string} serviceName - Nom du service pour les logs
 */
export async function verifyOpenAICredits(serviceName) {
  console.log(`[${serviceName}] Vérification des crédits OpenAI...`);
  try {
    await checkOpenAICredits();
    console.log(`[${serviceName}] ✅ Crédits OpenAI disponibles`);
  } catch (error) {
    console.error(`[${serviceName}] ❌ Erreur crédits OpenAI:`, error.message);
    throw error;
  }
}

/**
 * Exécute un appel OpenAI avec timing et tracking automatiques
 *
 * @param {Object} options
 * @param {string} options.serviceName - Nom du service pour logs/tracking
 * @param {string} options.modelSetting - Clé du setting pour le modèle (ex: 'model_translate_cv')
 * @param {string} options.featureName - Nom de la feature pour tracking
 * @param {Array} options.messages - Messages pour l'API
 * @param {Object} [options.responseFormat] - Format de réponse (défaut: { type: 'json_object' })
 * @param {number} [options.temperature] - Température (défaut: 0.3)
 * @param {number} [options.maxTokens] - Max tokens (optionnel)
 * @param {AbortSignal} [options.signal] - Signal d'annulation
 * @param {string} [options.userId] - ID utilisateur pour tracking
 * @returns {Promise<{content: string, usage: object, duration: number}>}
 */
export async function executeOpenAICall({
  serviceName,
  modelSetting,
  featureName,
  messages,
  responseFormat = { type: 'json_object' },
  temperature = 0.3,
  maxTokens,
  signal,
  userId,
}) {
  const client = getOpenAIClient();
  const model = await getAiModelSetting(modelSetting);

  console.log(`[${serviceName}] Modèle GPT utilisé: ${model}`);

  const requestOptions = addTemperatureIfSupported({
    model,
    messages,
    response_format: responseFormat,
    ...(maxTokens && { max_completion_tokens: maxTokens }),
  }, temperature);

  try {
    const startTime = Date.now();
    const response = await client.chat.completions.create(requestOptions, { signal });
    const duration = Date.now() - startTime;

    // Track usage
    if (userId && response.usage) {
      try {
        await trackOpenAIUsage({
          userId,
          featureName,
          model,
          promptTokens: response.usage.prompt_tokens || 0,
          completionTokens: response.usage.completion_tokens || 0,
          cachedTokens: response.usage.prompt_tokens_details?.cached_tokens || 0,
          duration,
        });
      } catch (trackError) {
        console.error(`[${serviceName}] Failed to track OpenAI usage:`, trackError);
      }
    }

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.noGptResponse' }));
    }

    return { content: content.trim(), usage: response.usage, duration };
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      console.log(`[${serviceName}] Opération annulée par l'utilisateur`);
      throw new Error('Task cancelled');
    }
    throw error;
  }
}

/**
 * Wrapper complet pour un service OpenAI simple
 * Combine vérification crédits + appel + gestion erreurs
 *
 * @param {Object} options - Mêmes options que executeOpenAICall
 * @returns {Promise<{content: string, usage: object, duration: number}>}
 */
export async function executeOpenAIService(options) {
  await verifyOpenAICredits(options.serviceName);
  return executeOpenAICall(options);
}
