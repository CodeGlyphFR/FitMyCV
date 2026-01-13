import { getOpenAIClient, checkOpenAICredits } from './client.js';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { loadPromptWithVars } from './promptLoader.js';
import { getLanguageName } from '@/lib/cv/detectLanguage.js';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';

/**
 * Améliore un CV existant en se basant sur les suggestions
 * Modifie les sections summary, experience et projects
 * NE modifie PAS skills, header, education, languages, extras
 *
 * @param {Object} params
 * @param {Object} params.summary - Le résumé du CV (section summary)
 * @param {Array} params.experience - Les expériences du CV (section experience)
 * @param {Array} params.projects - Les projets du CV (section projects)
 * @param {string} params.jobOfferContent - Le contenu de l'offre d'emploi déjà extrait
 * @param {Array} params.suggestions - Les suggestions d'amélioration sélectionnées
 * @param {string} params.cvLanguage - Code langue du CV (fr, en, etc.)
 * @param {AbortSignal} params.signal - Signal pour annulation
 * @param {string} [params.userId] - User ID for telemetry tracking (optional)
 * @returns {Promise<Object>} - Modifications au format DIFF avec reasoning
 */
export async function improveCv({
  summary = {},
  experience = [],
  projects = [],
  jobOfferContent,
  suggestions = [],
  cvLanguage = 'fr',
  signal = null,
  userId = null
}) {
  console.log('[improveCv] Début amélioration');
  console.log('[improveCv] Summary présent:', !!summary?.description);
  console.log('[improveCv] Expériences:', experience.length, '| Projets:', projects.length);

  if (!jobOfferContent) {
    throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.jobOfferRequired' }));
  }

  // Vérifier qu'on a au moins une section à améliorer
  const hasSummary = summary && (summary.description || summary.domains?.length || summary.key_strengths?.length);
  const hasExperience = experience.length > 0;
  const hasProjects = projects.length > 0;

  if (!hasSummary && !hasExperience && !hasProjects) {
    throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.noContentToImprove' }));
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

  // Convertir le code langue en nom lisible
  const cvLanguageName = getLanguageName(cvLanguage);
  console.log('[improveCv] Langue du CV:', cvLanguageName, '(code:', cvLanguage, ')');

  // Formater les suggestions pour le prompt (avec contexte utilisateur si présent)
  const suggestionsText = suggestions.length > 0
    ? suggestions.map((s, i) => {
        let text = `${i + 1}. [${s.priority}] ${s.suggestion} (Impact: ${s.impact})`;
        if (s.userContext && s.userContext.trim()) {
          text += `\n   Contexte utilisateur: "${s.userContext.trim()}"`;
        }
        return text;
      }).join('\n\n')
    : 'Aucune suggestion d\'amélioration sélectionnée';

  console.log('[improveCv] Suggestions:', suggestions.length);
  console.log('[improveCv] Suggestions avec contexte:', suggestions.filter(s => s.userContext?.trim()).length);

  // Formater les données d'entrée (summary, experience et projects)
  const summaryContent = hasSummary
    ? JSON.stringify(summary, null, 2)
    : 'Aucun résumé dans le CV';
  const experienceContent = hasExperience
    ? JSON.stringify(experience, null, 2)
    : 'Aucune expérience dans le CV';
  const projectsContent = hasProjects
    ? JSON.stringify(projects, null, 2)
    : 'Aucun projet dans le CV';

  // Charger les prompts depuis les fichiers .md
  const systemPrompt = await loadPromptWithVars('lib/openai/prompts/improve-cv/system.md', {
    cvLanguage: cvLanguageName
  });
  const userPrompt = await loadPromptWithVars('lib/openai/prompts/improve-cv/user.md', {
    jobOfferContent: jobOfferContent,
    summaryContent: summaryContent,
    experienceContent: experienceContent,
    projectsContent: projectsContent,
    suggestionsText: suggestionsText,
    cvLanguage: cvLanguageName
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
      throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.noAiResponse' }));
    }

    const result = JSON.parse(content);

    // Valider la structure (nouveau format avec modifications et reasoning)
    if (!result.modifications && !result.reasoning) {
      throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.invalidResponseFormat' }));
    }

    console.log('[improveCv] ✅ Amélioration terminée');
    console.log('[improveCv] Reasoning présent:', !!result.reasoning);
    console.log('[improveCv] Modifications summary:', !!result.modifications?.summary);
    console.log('[improveCv] Modifications expériences:', result.modifications?.experience?.updates?.length || 0);
    console.log('[improveCv] Modifications projets:', result.modifications?.projects?.updates?.length || 0);
    console.log('[improveCv] Nombre de changements:', result.changes_summary?.length || 0);

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
      reasoning: result.reasoning || null,
      modifications: result.modifications || {},
      changesMade: result.changes_summary || []
    };

  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      throw new Error('Task cancelled');
    }
    console.error('[improveCv] Erreur:', error);
    throw error;
  }
}
