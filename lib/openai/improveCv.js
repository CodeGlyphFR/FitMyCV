import { getOpenAIClient, checkOpenAICredits } from './client.js';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { loadPrompt, loadPromptWithVars } from './promptLoader.js';
import { detectCvLanguage, getLanguageName } from '@/lib/cv/detectLanguage.js';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';

/**
 * Améliore un CV existant en se basant sur les suggestions
 * @param {Object} params
 * @param {string} params.cvContent - Le CV actuel en JSON
 * @param {string} params.jobOfferContent - Le contenu de l'offre d'emploi déjà extrait
 * @param {number} params.currentScore - Le score actuel
 * @param {Array} params.suggestions - Les suggestions d'amélioration
 * @param {AbortSignal} params.signal - Signal pour annulation
 * @param {string} [params.userId] - User ID for telemetry tracking (optional)
 * @returns {Promise<Object>} - CV amélioré avec détails des changements
 */
export async function improveCv({
  cvContent,
  jobOfferContent,
  currentScore,
  suggestions = [],
  signal = null,
  userId = null
}) {
  console.log('[improveCv] Début amélioration - Score actuel:', currentScore);

  if (!cvContent || !jobOfferContent) {
    throw new Error('CV content and job offer content are required');
  }

  // Vérifier les crédits OpenAI avant l'appel
  console.log('[improveCv] Vérification des crédits OpenAI...');
  try {
    await checkOpenAICredits();
    console.log('[improveCv] ✅ Crédits OpenAI disponibles');
  } catch (error) {
    console.error('[improveCv] ❌ Erreur crédits OpenAI:', error.message);
    throw error;
  }

  const client = getOpenAIClient();
  const model = await getAiModelSetting('model_optimize_cv');

  // Utiliser la langue stockée dans le CV, sinon détecter par mots-clés
  let cvLanguageCode;
  try {
    const cvData = typeof cvContent === 'string' ? JSON.parse(cvContent) : cvContent;
    cvLanguageCode = cvData.language || detectCvLanguage(cvContent);
  } catch (e) {
    cvLanguageCode = detectCvLanguage(cvContent);
  }
  const cvLanguage = getLanguageName(cvLanguageCode);
  console.log('[improveCv] Langue du CV:', cvLanguage, '(source:', cvLanguageCode ? 'stored/detected' : 'fallback', ')');

  // Formater les suggestions pour le prompt
  const suggestionsText = suggestions.map((s, i) =>
    `${i + 1}. [${s.priority}] ${s.suggestion} (Impact: ${s.impact})`
  ).join('\n');

  // Charger les prompts depuis les fichiers .md
  const systemPrompt = await loadPromptWithVars('lib/openai/prompts/improve-cv/system.md', {
    cvLanguage: cvLanguage
  });
  const userPrompt = await loadPromptWithVars('lib/openai/prompts/improve-cv/user.md', {
    currentScore: currentScore.toString(),
    jobOfferContent: jobOfferContent,
    cvContent: cvContent,
    suggestionsText: suggestionsText
  });

  try {
    const requestOptions = {
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      response_format: { type: 'json_object' },
      // Note: temperature parameter removed as some models don't support custom values
    };

    const fetchOptions = signal ? { signal } : {};
    const startTime = Date.now();
    const response = await client.chat.completions.create(requestOptions, fetchOptions);
    const duration = Date.now() - startTime;

    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Pas de réponse de l\'IA');
    }

    const result = JSON.parse(content);

    // Valider la structure (nouveau format avec modified_sections)
    if (!result.modified_sections) {
      throw new Error('Format de réponse invalide: modified_sections manquant');
    }

    console.log('[improveCv] ✅ Amélioration terminée');
    console.log('[improveCv] Sections modifiées:', Object.keys(result.modified_sections).join(', '));
    console.log('[improveCv] Nombre de modifications:', result.changes_made?.length || 0);

    // Track OpenAI usage only for successful optimization
    if (userId && response.usage) {
      try {
        await trackOpenAIUsage({
          userId,
          featureName: 'optimize_cv',
          model,
          promptTokens: response.usage.prompt_tokens || 0,
          completionTokens: response.usage.completion_tokens || 0,
          cachedTokens: response.usage.prompt_tokens_details?.cached_tokens || 0,
          duration,
        });
      } catch (trackError) {
        console.error('[improveCv] Failed to track OpenAI usage:', trackError);
      }
    }

    return {
      modifiedSections: result.modified_sections,
      changesMade: result.changes_made || []
    };

  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      throw new Error('Task cancelled');
    }
    console.error('[improveCv] Erreur:', error);
    throw error;
  }
}