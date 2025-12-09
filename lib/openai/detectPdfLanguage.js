import { trackOpenAIUsage } from '@/lib/telemetry/openai';
import { getAiModelSetting } from '@/lib/settings/aiModels';

/**
 * Detecte la langue d'un CV PDF via Vision API
 * Utilise le setting pdf_vision_detail pour le niveau de detail (configurable)
 * Utilise le setting model_detect_language depuis la DB
 *
 * @param {string} imageBase64 - Premiere page du PDF en base64
 * @param {Object} client - Client OpenAI
 * @param {string} userId - ID utilisateur pour telemetrie
 * @param {AbortSignal} signal - Signal pour annuler la requete
 * @param {string} visionDetail - Niveau de detail Vision API ('low', 'auto', 'high')
 * @returns {Promise<string>} - Code langue ('fr', 'en', 'es', 'de')
 */
export async function detectPdfLanguage(imageBase64, client, userId = null, signal = null, visionDetail = 'auto') {
  // Charger le modèle depuis Settings (cohérent avec detectLanguage.js)
  const model = await getAiModelSetting('model_detect_language');
  const startTime = Date.now();

  try {
    const fetchOptions = signal ? { signal } : {};
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are an expert language detector for CV/resume documents.

TASK: Identify the PRIMARY language of this CV by analyzing:
1. Job titles and descriptions
2. Section headers (Experience, Education, Skills, etc.)
3. Body text content
4. NOT names, company names, or technical terms (these can be in any language)

IMPORTANT: Focus on the CONTENT language, not formatting or proper nouns.

Reply with EXACTLY one code: fr, en, es, de`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is the primary language of this CV? Analyze the job descriptions, section headers, and body text.' },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: visionDetail
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

    console.log(`[detectPdfLanguage] Langue detectee: ${detectedLanguage} (raw: "${content}", detail: ${visionDetail})`);

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
