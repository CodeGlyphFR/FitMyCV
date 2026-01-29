/**
 * Utilitaires de gestion des langues pour le Pipeline CV v2
 *
 * Fonctions:
 * - detectJobOfferLanguage: Detecte la langue de l'offre d'emploi
 * - getTargetLanguageName: Convertit code langue en nom complet
 * - detectLanguageFromText: Detection automatique depuis un texte
 */

import { getOpenAIClient, addTemperatureIfSupported } from '@/lib/openai-core/client';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';

/**
 * Mapping code langue -> nom complet (pour les prompts)
 */
const LANGUAGE_NAMES = {
  fr: 'francais',
  en: 'anglais',
  de: 'allemand',
  es: 'espagnol',
  it: 'italien',
  pt: 'portugais',
  nl: 'neerlandais',
};

/**
 * Mapping inverse nom -> code
 */
const LANGUAGE_CODES = {
  francais: 'fr',
  français: 'fr',
  french: 'fr',
  anglais: 'en',
  english: 'en',
  allemand: 'de',
  german: 'de',
  deutsch: 'de',
  espagnol: 'es',
  spanish: 'es',
  español: 'es',
  italien: 'it',
  italian: 'it',
  italiano: 'it',
  portugais: 'pt',
  portuguese: 'pt',
  português: 'pt',
  neerlandais: 'nl',
  dutch: 'nl',
  nederlands: 'nl',
};

/**
 * Convertit un code langue en nom complet pour les prompts
 * @param {string} languageCode - Code langue (fr, en, de, es)
 * @returns {string} Nom complet de la langue
 */
export function getTargetLanguageName(languageCode) {
  return LANGUAGE_NAMES[languageCode] || LANGUAGE_NAMES.fr;
}

/**
 * Convertit un nom de langue en code
 * @param {string} languageName - Nom de la langue
 * @returns {string} Code langue
 */
export function getLanguageCode(languageName) {
  if (!languageName) return 'fr';
  const normalized = languageName.toLowerCase().trim();
  return LANGUAGE_CODES[normalized] || normalized;
}

/**
 * Detecte la langue de l'offre d'emploi
 *
 * Priorite:
 * 1. Champ `language` explicite dans JobOffer.content
 * 2. Detection automatique depuis le titre et la description
 * 3. Fallback vers la langue du CV source
 * 4. Default: francais
 *
 * @param {Object} jobOffer - L'offre d'emploi (avec content JSON)
 * @param {string} fallbackLanguage - Langue de fallback (code: fr, en, etc.)
 * @param {string} [userId] - Optional user ID for telemetry tracking
 * @returns {Promise<{code: string, name: string, source: string}>}
 */
export async function detectJobOfferLanguage(jobOffer, fallbackLanguage = 'fr', userId = null) {
  // 1. Verifier si la langue est explicitement definie dans l'offre
  const content = jobOffer.content || jobOffer;
  const explicitLanguage = content.language;

  if (explicitLanguage && LANGUAGE_NAMES[explicitLanguage]) {
    console.log(`[language] Using explicit language from job offer: ${explicitLanguage}`);
    return {
      code: explicitLanguage,
      name: LANGUAGE_NAMES[explicitLanguage],
      source: 'job_offer_explicit',
    };
  }

  // 2. Tenter une detection automatique depuis le contenu
  const textToAnalyze = [
    content.title || '',
    content.description || '',
    ...(content.responsibilities || []).slice(0, 3),
  ].join(' ').trim();

  if (textToAnalyze.length > 50) {
    try {
      const detectedCode = await detectLanguageFromText(textToAnalyze.substring(0, 500), userId);
      if (detectedCode && LANGUAGE_NAMES[detectedCode]) {
        console.log(`[language] Detected language from job offer content: ${detectedCode}`);
        return {
          code: detectedCode,
          name: LANGUAGE_NAMES[detectedCode],
          source: 'auto_detected',
        };
      }
    } catch (error) {
      console.warn(`[language] Auto-detection failed:`, error.message);
    }
  }

  // 3. Utiliser la langue de fallback (CV source ou default)
  const fallbackCode = fallbackLanguage || 'fr';
  console.log(`[language] Using fallback language: ${fallbackCode}`);

  return {
    code: fallbackCode,
    name: LANGUAGE_NAMES[fallbackCode] || 'francais',
    source: 'fallback',
  };
}

/**
 * Detecte la langue d'un texte via OpenAI
 *
 * @param {string} text - Texte a analyser
 * @param {string} [userId] - Optional user ID for telemetry tracking
 * @returns {Promise<string>} Code langue (fr, en, de, es)
 */
export async function detectLanguageFromText(text, userId = null) {
  if (!text || text.length < 20) {
    return 'fr'; // Default si texte trop court
  }

  const startTime = Date.now();

  try {
    const model = await getAiModelSetting('model_detect_language');
    const client = getOpenAIClient();

    let requestOptions = {
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a language detection assistant. Analyze the text and respond with ONLY the language code: "fr" for French, "en" for English, "de" for German, "es" for Spanish. No other text.',
        },
        {
          role: 'user',
          content: `Detect the language: "${text.substring(0, 300)}"`,
        },
      ],
      max_completion_tokens: 5,
    };

    // Ajouter temperature uniquement si le modèle le supporte (pas o1/o3/o4/gpt-5)
    requestOptions = addTemperatureIfSupported(requestOptions, 0.1);

    const response = await client.chat.completions.create(requestOptions);

    // Track usage for telemetry
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

    const content = response.choices?.[0]?.message?.content?.trim().toLowerCase();
    const validLanguages = ['fr', 'en', 'de', 'es'];

    return validLanguages.includes(content) ? content : 'fr';
  } catch (error) {
    console.error('[language] Detection error:', error.message);
    return 'fr';
  }
}

/**
 * Genere l'instruction de langue pour les prompts
 *
 * @param {string} targetLanguage - Nom de la langue cible (francais, anglais, etc.)
 * @returns {string} Instruction formatee pour le prompt
 */
export function getLanguageInstruction(targetLanguage) {
  const instructions = {
    francais: 'Redige TOUT le contenu en FRANCAIS. Utilise un style professionnel et naturel.',
    anglais: 'Write ALL content in ENGLISH. Use a professional and natural style.',
    allemand: 'Verfasse ALLE Inhalte auf DEUTSCH. Verwende einen professionellen und natürlichen Stil.',
    espagnol: 'Escribe TODO el contenido en ESPAÑOL. Usa un estilo profesional y natural.',
    italien: 'Scrivi TUTTO il contenuto in ITALIANO. Usa uno stile professionale e naturale.',
    portugais: 'Escreva TODO o conteúdo em PORTUGUÊS. Use um estilo profissional e natural.',
  };

  return instructions[targetLanguage] || instructions.francais;
}

/**
 * Verifie si une traduction est necessaire
 *
 * @param {string} sourceLanguage - Langue du CV source (code)
 * @param {string} targetLanguage - Langue cible (code)
 * @returns {boolean}
 */
export function needsTranslation(sourceLanguage, targetLanguage) {
  const sourceCode = getLanguageCode(sourceLanguage);
  const targetCode = getLanguageCode(targetLanguage);
  return sourceCode !== targetCode;
}
