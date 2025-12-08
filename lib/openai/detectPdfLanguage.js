import { trackOpenAIUsage } from '@/lib/telemetry/openai';

/**
 * Detecte la langue d'un CV PDF via Vision API
 * Utilise detail: 'low' pour minimiser les couts (~85 tokens)
 *
 * @param {string} imageBase64 - Premiere page du PDF en base64
 * @param {Object} client - Client OpenAI
 * @param {string} model - Modele a utiliser
 * @param {string} userId - ID utilisateur pour telemetrie
 * @param {AbortSignal} signal - Signal pour annuler la requete
 * @returns {Promise<string>} - Code langue ('fr', 'en', 'es', 'de')
 */
export async function detectPdfLanguage(imageBase64, client, model, userId = null, signal = null) {
  const startTime = Date.now();

  try {
    const fetchOptions = signal ? { signal } : {};
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'Detect the language of this CV/resume document. Reply with ONLY one of these codes: fr, en, es, de. Nothing else.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What language is this CV written in?' },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'low' // Minimise les tokens (~85 vs ~1000+ pour high)
              }
            }
          ]
        }
      ],
      max_tokens: 5
    }, fetchOptions);

    const duration = Date.now() - startTime;

    // Check if cancelled after API call
    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }
    const content = response.choices?.[0]?.message?.content?.trim().toLowerCase();
    const validLanguages = ['fr', 'en', 'es', 'de'];
    const detectedLanguage = validLanguages.includes(content) ? content : 'fr';

    console.log(`[detectPdfLanguage] Langue detectee: ${detectedLanguage} (raw: "${content}")`);

    // Tracking telemetrie
    if (userId && response.usage) {
      try {
        await trackOpenAIUsage({
          userId,
          featureName: 'detect_pdf_language',
          model,
          promptTokens: response.usage.prompt_tokens || 0,
          completionTokens: response.usage.completion_tokens || 0,
          cachedTokens: response.usage.prompt_tokens_details?.cached_tokens || 0,
          duration,
        });
      } catch (trackError) {
        console.error('[detectPdfLanguage] Failed to track usage:', trackError);
      }
    }

    return detectedLanguage;
  } catch (error) {
    console.error('[detectPdfLanguage] Erreur detection langue:', error.message);
    // Fallback vers francais en cas d'erreur
    return 'fr';
  }
}
