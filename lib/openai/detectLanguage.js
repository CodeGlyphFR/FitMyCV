import { getOpenAIClient, addTemperatureIfSupported } from './client.js';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';
import {
  MAX_CHARS_FOR_DETECTION,
  DEFAULT_LANGUAGE,
} from '@/lib/cv/languageConstants';

/**
 * Detect CV language using OpenAI API
 * Sends up to MAX_CHARS_FOR_DETECTION characters of the summary to OpenAI
 *
 * @param {Object} params - Detection parameters
 * @param {string} params.summaryDescription - The CV summary text to analyze
 * @param {AbortSignal} [params.signal] - Optional abort signal for cancellation
 * @param {string} [params.userId] - Optional user ID for telemetry tracking
 * @returns {Promise<string>} - Language code ('fr', 'en', or 'es')
 */
export async function detectCvLanguageWithOpenAI({
  summaryDescription,
  signal = null,
  userId = null
}) {
  const startTime = Date.now();

  // If summary is empty, default to French (no API call)
  if (!summaryDescription || summaryDescription.trim().length === 0) {
    console.log(`[detectCvLanguageWithOpenAI] Summary vide, defaulting to ${DEFAULT_LANGUAGE}`);
    return DEFAULT_LANGUAGE;
  }

  // Extract first N characters for analysis (up to MAX_CHARS_FOR_DETECTION)
  const textToAnalyze = summaryDescription.trim().substring(0, MAX_CHARS_FOR_DETECTION);

  try {
    // Get model from admin settings
    const model = await getAiModelSetting('model_detect_language');
    const client = getOpenAIClient();

    // Call OpenAI with minimal prompt
    const requestOptions = addTemperatureIfSupported({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a language detection assistant. Analyze the text and respond with ONLY "fr" for French, "en" for English, or "es" for Spanish. No other text.'
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

    // Parse response and validate
    const content = response.choices?.[0]?.message?.content?.trim().toLowerCase();
    // Support fr, en, es - default to 'fr' if unclear
    const validLanguages = ['fr', 'en', 'es'];
    const detectedLanguage = validLanguages.includes(content) ? content : 'fr';

    console.log(`[detectCvLanguageWithOpenAI] Detected language: ${detectedLanguage} (raw response: "${content}")`);

    // Track usage for telemetry
    if (userId && response.usage) {
      await trackOpenAIUsage({
        userId,
        featureName: 'detect_cv_language',
        model,
        promptTokens: response.usage.prompt_tokens || 0,
        completionTokens: response.usage.completion_tokens || 0,
        cachedTokens: response.usage.prompt_tokens_details?.cached_tokens || 0,
        duration: Date.now() - startTime,
      });
    }

    return detectedLanguage;
  } catch (error) {
    console.error('[detectCvLanguageWithOpenAI] Error detecting language:', error);
    // Default to French on error
    return DEFAULT_LANGUAGE;
  }
}
