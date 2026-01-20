import { getOpenAIClient } from './client.js';
import { getImproveProjectModel } from '@/lib/settings/aiModels';
import { loadPromptWithVars } from './promptLoader.js';
import { getLanguageName } from '@/lib/cv-core/detectLanguage.js';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';

/**
 * Extrait les compétences clés de l'offre d'emploi
 */
function extractKeySkills(jobOffer) {
  if (!jobOffer) return 'Non spécifié';

  const skills = [];

  if (jobOffer.required_skills?.length) {
    skills.push(...jobOffer.required_skills.slice(0, 5));
  }
  if (jobOffer.preferred_skills?.length) {
    skills.push(...jobOffer.preferred_skills.slice(0, 3));
  }
  if (jobOffer.technologies?.length) {
    skills.push(...jobOffer.technologies.slice(0, 3));
  }

  if (skills.length === 0) {
    return jobOffer.description?.substring(0, 200) || 'Non spécifié';
  }

  return skills.join(', ');
}

/**
 * Améliore un projet existant OU crée un nouveau projet
 *
 * @param {Object} params
 * @param {Object|null} params.project - Le projet à améliorer (null si création)
 * @param {Object} params.suggestion - La suggestion à appliquer
 * @param {string} params.suggestion.suggestion - Texte de la suggestion
 * @param {string} [params.suggestion.userContext] - Contexte libre fourni par l'utilisateur
 * @param {Object} params.jobOffer - L'offre d'emploi (pour alignement vocabulaire)
 * @param {string} params.cvLanguage - Code langue du CV (fr, en, etc.)
 * @param {AbortSignal} [params.signal] - Signal pour annulation
 * @param {string} [params.userId] - User ID pour tracking
 * @returns {Promise<Object>} - { modifications, isNew, reasoning }
 */
export async function improveProject({
  project = null,
  suggestion,
  jobOffer,
  cvLanguage = 'fr',
  signal = null,
  userId = null,
}) {
  const client = getOpenAIClient();
  const model = await getImproveProjectModel();

  // Convertir le code langue en nom lisible
  const cvLanguageName = getLanguageName(cvLanguage);

  // Extraire les données de la suggestion
  const suggestionText = suggestion.suggestion || '';
  const userContext = suggestion.userContext?.trim() || 'Aucun contexte fourni';
  const actionDescription = suggestion.actionDescription || suggestionText;

  // Extraire les infos clés de l'offre
  const jobTitle = jobOffer?.title || jobOffer?.job_title || 'Non spécifié';
  const jobKeySkills = extractKeySkills(jobOffer);

  const isCreation = project === null;
  console.log('[improveProject]', isCreation ? 'Création nouveau projet' : `Amélioration projet: ${project.name}`);
  console.log('[improveProject] Suggestion:', suggestionText.substring(0, 50) + '...');
  console.log('[improveProject] Action:', actionDescription);

  // Charger les prompts
  const systemPrompt = await loadPromptWithVars('lib/openai/prompts/improve-cv/project-system.md', {
    cvLanguage: cvLanguageName,
  });
  const userPrompt = await loadPromptWithVars('lib/openai/prompts/improve-cv/project-user.md', {
    existingProject: project ? JSON.stringify(project, null, 2) : 'null',
    jobTitle,
    jobKeySkills,
    jobOfferContent: JSON.stringify(jobOffer, null, 2),
    suggestionText,
    userContext,
    actionDescription,
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

    console.log('[improveProject] ✅ Terminé en', duration, 'ms');
    console.log('[improveProject] isNew:', result.isNew);
    console.log('[improveProject] Modifications:', Object.keys(result.modifications || {}).join(', '));

    // Track OpenAI usage
    if (userId && response.usage) {
      try {
        await trackOpenAIUsage({
          userId,
          featureName: 'cv_improvement_project',
          model,
          promptTokens: response.usage.prompt_tokens || 0,
          completionTokens: response.usage.completion_tokens || 0,
          cachedTokens: response.usage.prompt_tokens_details?.cached_tokens || 0,
          duration,
        });
      } catch (trackError) {
        console.error('[improveProject] Failed to track OpenAI usage:', trackError);
      }
    }

    return {
      modifications: result.modifications || {},
      isNew: result.isNew === true,
      reasoning: result.reasoning || '',
    };
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      throw new Error('Task cancelled');
    }
    console.error('[improveProject] Erreur:', error);
    throw error;
  }
}
