import OpenAI from 'openai';

const ANALYSIS_MODEL_MAP = Object.freeze({
  rapid: "gpt-5-nano-2025-08-07",
  medium: "gpt-5-mini-2025-08-07",
  deep: "gpt-5-2025-08-07",
});

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY est manquant.");
  }

  const client = new OpenAI({ apiKey });
  return client;
}

export function getModelForAnalysisLevel(analysisLevel, requestedModel = null) {
  return (
    requestedModel ||
    ANALYSIS_MODEL_MAP[analysisLevel] ||
    ANALYSIS_MODEL_MAP.medium
  );
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
