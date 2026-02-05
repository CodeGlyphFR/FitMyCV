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
 * Patterns pour identifier les modèles de raisonnement (o1, o3, o4, gpt-5)
 * Ces modèles ont des comportements spéciaux:
 * - Ne supportent pas le paramètre temperature
 * - Utilisent une partie de max_completion_tokens pour le raisonnement interne
 */
const REASONING_MODEL_PATTERNS = [
  /^o1/i,     // o1, o1-mini, o1-preview, o1-pro
  /^o3/i,     // o3, o3-mini
  /^o4/i,     // o4, o4-mini
  /gpt-5/i,   // gpt-5, gpt-5-mini, gpt-5-nano
];

/**
 * Vérifie si un modèle est un modèle de raisonnement (o1, o3, o4, gpt-5)
 * Ces modèles utilisent une partie de max_completion_tokens pour le raisonnement
 * interne avant de générer la sortie visible.
 * @param {string} model - Nom du modèle
 * @returns {boolean} - true si le modèle est un modèle de raisonnement
 */
export function isReasoningModel(model) {
  if (!model) return false;
  return REASONING_MODEL_PATTERNS.some(pattern => pattern.test(model));
}

/**
 * Ajuste max_completion_tokens pour les modèles de raisonnement
 *
 * Les modèles de raisonnement (o1, o3, o4, gpt-5) utilisent une partie de
 * max_completion_tokens pour le raisonnement interne. Si la limite est trop basse,
 * le modèle peut manquer de tokens pour générer la réponse JSON → content = null.
 *
 * @param {Object} requestOptions - Options de requête OpenAI
 * @param {number} defaultTokens - Limite par défaut pour les modèles classiques
 * @param {number} reasoningTokens - Limite pour les modèles de raisonnement (défaut: 16000)
 * @returns {Object} - Options avec max_completion_tokens ajusté
 */
export function adjustTokensForReasoningModel(requestOptions, defaultTokens, reasoningTokens = 16000) {
  const model = requestOptions.model || '';
  requestOptions.max_completion_tokens = isReasoningModel(model) ? reasoningTokens : defaultTokens;
  return requestOptions;
}

/**
 * Vérifie si un modèle supporte le paramètre temperature
 * Les modèles o1, o3, o4 et gpt-5 ne supportent pas temperature
 * @param {string} model - Nom du modèle
 * @returns {boolean} - true si le modèle supporte temperature
 */
export function supportsTemperature(model) {
  if (!model) return true;

  // Les modèles de raisonnement ne supportent pas temperature
  return !isReasoningModel(model);
}

/**
 * Ajoute conditionnellement le paramètre temperature selon le modèle
 * GPT-5 et les modèles o1/o3/o4 ne supportent pas le paramètre temperature
 * @param {Object} requestOptions - Options de requête OpenAI
 * @param {number} temperature - Valeur de température (0-2)
 * @returns {Object} - Options avec temperature ajoutée si supportée
 */
export function addTemperatureIfSupported(requestOptions, temperature = 0.1) {
  const model = requestOptions.model || '';

  if (supportsTemperature(model)) {
    requestOptions.temperature = temperature;
  }

  return requestOptions;
}

const VALID_REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'];

/**
 * Ajoute conditionnellement le paramètre reasoning_effort selon le modèle
 * Les modèles o1, o3, o4 et gpt-5 supportent ce paramètre pour contrôler
 * l'intensité du raisonnement interne.
 *
 * @param {Object} requestOptions - Options de requête OpenAI
 * @param {string} effort - Niveau ('none'|'minimal'|'low'|'medium'|'high'|'xhigh')
 * @returns {Object} - Options avec reasoning_effort ajouté si supporté
 */
export function addReasoningEffortIfSupported(requestOptions, effort = 'medium') {
  const model = requestOptions.model || '';
  if (!isReasoningModel(model)) return requestOptions;
  if (!VALID_REASONING_EFFORTS.includes(effort)) {
    console.warn(`[openai-client] Invalid reasoning_effort: ${effort}, defaulting to 'medium'`);
    effort = 'medium';
  }
  requestOptions.reasoning_effort = effort;
  return requestOptions;
}

/**
 * Ajoute conditionnellement le paramètre top_p selon le modèle
 * GPT-5 ne supporte pas le paramètre top_p
 * @param {Object} requestOptions - Options de requête OpenAI
 * @param {number} topP - Valeur de top_p (0-1)
 * @returns {Object} - Options avec top_p ajouté si supporté
 */
export function addTopPIfSupported(requestOptions, topP = 1) {
  const model = requestOptions.model || '';

  // GPT-5 ne supporte pas le paramètre top_p
  if (!model.includes('gpt-5')) {
    requestOptions.top_p = topP;
  }

  return requestOptions;
}

/**
 * Ajoute le paramètre seed si non-nul
 * seed=0 signifie "désactivé" (comportement aléatoire par défaut)
 * @param {Object} requestOptions - Options de requête OpenAI
 * @param {number} seed - Valeur du seed (0 = désactivé)
 * @returns {Object} - Options avec seed ajouté si > 0
 */
export function addSeedIfSet(requestOptions, seed) {
  if (seed && seed > 0) {
    requestOptions.seed = seed;
  }
  return requestOptions;
}

/**
 * Ajoute le paramètre prompt_cache_retention pour les modèles GPT-5.x
 * GPT-5 models support extended 24h cache retention (except mini and nano variants)
 * @param {Object} requestOptions - Options de requête OpenAI
 * @returns {Object} - Options avec cache retention si applicable
 */
export function addCacheRetentionIfSupported(requestOptions) {
  const model = requestOptions.model || '';

  // GPT-5 models support 24h cache retention (except gpt-5-mini and gpt-5-nano)
  if (model.startsWith('gpt-5') && !model.includes('mini') && !model.includes('nano')) {
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
