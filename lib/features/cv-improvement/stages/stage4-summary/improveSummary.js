import { getOpenAIClient } from '@/lib/openai-core/client.js';
import { getImproveSummaryModel } from '@/lib/settings/aiModels';
import { loadPromptWithVars } from '@/lib/openai-core/promptLoader.js';
import { getLanguageName } from '@/lib/cv-core/language/detectLanguage';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';

/**
 * Met à jour le résumé CV après les améliorations d'expériences et projets
 *
 * @param {Object} params
 * @param {Object} params.summary - Le résumé actuel du CV
 * @param {Array} params.improvedExperiences - Les améliorations apportées aux expériences
 * @param {Array} params.improvedProjects - Les améliorations apportées aux projets
 * @param {Object} params.jobOffer - L'offre d'emploi (pour alignement vocabulaire)
 * @param {string} params.cvLanguage - Code langue du CV (fr, en, etc.)
 * @param {AbortSignal} [params.signal] - Signal pour annulation
 * @param {string} [params.userId] - User ID pour tracking
 * @returns {Promise<Object>} - { modifications, reasoning }
 */
export async function improveSummary({
  summary,
  improvedExperiences = [],
  improvedProjects = [],
  jobOffer,
  cvLanguage = 'fr',
  signal = null,
  userId = null,
}) {
  const client = getOpenAIClient();
  const model = await getImproveSummaryModel();

  // Convertir le code langue en nom lisible
  const cvLanguageName = getLanguageName(cvLanguage);

  console.log('[improveSummary] Mise à jour du summary');
  console.log('[improveSummary] Améliorations expériences:', improvedExperiences.length);
  console.log('[improveSummary] Améliorations projets:', improvedProjects.length);

  // Si aucune amélioration, retourner directement sans appel OpenAI
  if (improvedExperiences.length === 0 && improvedProjects.length === 0) {
    console.log('[improveSummary] Aucune amélioration - skip');
    return {
      modifications: {},
      reasoning: 'Aucune amélioration apportée aux expériences/projets.',
    };
  }

  // Charger les prompts
  const systemPrompt = await loadPromptWithVars('lib/features/cv-improvement/prompts/summary-system.md', {
    cvLanguage: cvLanguageName,
  });
  const userPrompt = await loadPromptWithVars('lib/features/cv-improvement/prompts/summary-user.md', {
    summaryContent: JSON.stringify(summary, null, 2),
    jobOfferContent: JSON.stringify(jobOffer, null, 2),
    improvedExperiences: JSON.stringify(improvedExperiences, null, 2),
    improvedProjects: JSON.stringify(improvedProjects, null, 2),
    cvLanguage: cvLanguageName,
  });

  const requestOptions = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  };

  const fetchOptions = signal ? { signal } : {};
  const startTime = Date.now();

  try {
    const response = await client.chat.completions.create(requestOptions, fetchOptions);
    const duration = Date.now() - startTime;

    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.noAiResponse' }));
    }

    const result = JSON.parse(content);

    console.log('[improveSummary] Terminé en', duration, 'ms');
    console.log('[improveSummary] Modifications:', Object.keys(result.modifications || {}).join(', ') || 'aucune');

    // Track OpenAI usage
    if (userId && response.usage) {
      try {
        await trackOpenAIUsage({
          userId,
          featureName: 'cv_improvement_v2_summary',
          model,
          promptTokens: response.usage.prompt_tokens || 0,
          completionTokens: response.usage.completion_tokens || 0,
          cachedTokens: response.usage.prompt_tokens_details?.cached_tokens || 0,
          duration,
        });
      } catch (trackError) {
        console.error('[improveSummary] Failed to track OpenAI usage:', trackError);
      }
    }

    return {
      modifications: result.modifications || {},
      reasoning: result.reasoning || '',
    };
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      throw new Error('Task cancelled');
    }
    console.error('[improveSummary] Erreur:', error);
    throw error;
  }
}
