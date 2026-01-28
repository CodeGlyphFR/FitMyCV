/**
 * Job Offer Language Detection
 *
 * Detects the language of extracted job offer content using OpenAI.
 * Called AFTER extraction to correct the language field based on actual content.
 *
 * PRIORITÉ : Les responsibilities (missions) sont utilisées en priorité car elles
 * définissent la langue du CV à produire. Les benefits ne sont utilisés qu'en fallback.
 */

import { getOpenAIClient, addTemperatureIfSupported } from '@/lib/openai-core/client';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';

const MAX_CHARS_FOR_DETECTION = 150;
const DEFAULT_LANGUAGE = 'fr';

/**
 * Detect job offer language using OpenAI API
 * Analyzes extracted content (responsibilities, benefits) to determine actual language
 *
 * @param {Object} params - Detection parameters
 * @param {Object} params.extraction - The extracted job offer content
 * @param {AbortSignal} [params.signal] - Optional abort signal for cancellation
 * @param {string} [params.userId] - Optional user ID for telemetry tracking
 * @returns {Promise<string>} - Language code ('fr', 'en', 'es', or 'de')
 */
export async function detectJobOfferLanguageWithOpenAI({
  extraction,
  signal = null,
  userId = null,
}) {
  const startTime = Date.now();

  // Build text sample from extracted content
  // PRIORITÉ : responsibilities uniquement (définissent la langue du CV à produire)
  // Fallback sur benefits si pas de responsibilities
  const responsibilities = extraction.responsibilities || [];
  const benefits = extraction.benefits || [];

  const textSamples = responsibilities.length > 0
    ? responsibilities.slice(0, 5)
    : benefits.slice(0, 5);

  const textToAnalyze = textSamples.join(' ').trim().substring(0, MAX_CHARS_FOR_DETECTION);

  // If not enough content, keep original language
  if (textToAnalyze.length < 20) {
    console.log(`[detectJobOfferLanguageWithOpenAI] Not enough content, keeping original: ${extraction.language || DEFAULT_LANGUAGE}`);
    return extraction.language || DEFAULT_LANGUAGE;
  }

  try {
    const model = await getAiModelSetting('model_detect_language');
    const client = getOpenAIClient();

    const requestOptions = addTemperatureIfSupported({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a language detection assistant. Analyze the text and respond with ONLY "fr" for French, "en" for English, "es" for Spanish, or "de" for German. No other text.'
        },
        {
          role: 'user',
          content: `Detect the language: "${textToAnalyze}"`
        }
      ],
      max_completion_tokens: 5,
    }, 0.1);

    const response = await client.chat.completions.create(
      requestOptions,
      signal ? { signal } : {}
    );

    const content = response.choices?.[0]?.message?.content?.trim().toLowerCase();
    const validLanguages = ['fr', 'en', 'es', 'de'];
    const detectedLanguage = validLanguages.includes(content) ? content : DEFAULT_LANGUAGE;

    // Log correction if different from original
    if (extraction.language && extraction.language !== detectedLanguage) {
      console.log(`[detectJobOfferLanguageWithOpenAI] Corrected: ${extraction.language} → ${detectedLanguage}`);
    } else {
      console.log(`[detectJobOfferLanguageWithOpenAI] Detected: ${detectedLanguage}`);
    }

    // Track usage for telemetry (featureName dédié pour séparer des coûts d'extraction)
    if (userId && response.usage) {
      await trackOpenAIUsage({
        userId,
        featureName: 'detect_language',
        model,
        promptTokens: response.usage.prompt_tokens || 0,
        completionTokens: response.usage.completion_tokens || 0,
        cachedTokens: response.usage.prompt_tokens_details?.cached_tokens || 0,
        duration: Date.now() - startTime,
      });
    }

    return detectedLanguage;
  } catch (error) {
    console.error('[detectJobOfferLanguageWithOpenAI] Error:', error);
    return extraction.language || DEFAULT_LANGUAGE;
  }
}
