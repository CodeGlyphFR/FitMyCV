import { getOpenAIClient } from './client.js';
import { getImproveExperienceModel } from '@/lib/settings/aiModels';
import { loadPromptWithVars } from './promptLoader.js';
import { getLanguageName } from '@/lib/cv-core/detectLanguage.js';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';

/**
 * Extrait les compétences clés de l'offre d'emploi pour focus l'IA
 */
function extractKeySkills(jobOffer) {
  if (!jobOffer) return 'Non spécifié';

  const skills = [];

  // Compétences requises
  if (jobOffer.required_skills?.length) {
    skills.push(...jobOffer.required_skills.slice(0, 5));
  }

  // Compétences souhaitées
  if (jobOffer.preferred_skills?.length) {
    skills.push(...jobOffer.preferred_skills.slice(0, 3));
  }

  // Technologies mentionnées
  if (jobOffer.technologies?.length) {
    skills.push(...jobOffer.technologies.slice(0, 3));
  }

  if (skills.length === 0) {
    // Fallback: extraire du titre ou de la description
    return jobOffer.description?.substring(0, 200) || 'Non spécifié';
  }

  return skills.join(', ');
}

/**
 * Améliore UNE expérience professionnelle avec une suggestion + contexte utilisateur
 *
 * @param {Object} params
 * @param {Object} params.experience - L'expérience à améliorer
 * @param {Object} params.suggestion - La suggestion à appliquer
 * @param {string} params.suggestion.suggestion - Texte de la suggestion
 * @param {string} [params.suggestion.userContext] - Contexte libre fourni par l'utilisateur
 * @param {string} [params.suggestion.priority] - Priorité (high, medium, low)
 * @param {Object} params.jobOffer - L'offre d'emploi (pour alignement vocabulaire)
 * @param {string} params.cvLanguage - Code langue du CV (fr, en, etc.)
 * @param {AbortSignal} [params.signal] - Signal pour annulation
 * @param {string} [params.userId] - User ID pour tracking
 * @returns {Promise<Object>} - { modifications, reasoning }
 */
export async function improveExperience({
  experience,
  suggestion,
  jobOffer,
  cvLanguage = 'fr',
  signal = null,
  userId = null,
}) {
  const client = getOpenAIClient();
  const model = await getImproveExperienceModel();

  // Convertir le code langue en nom lisible
  const cvLanguageName = getLanguageName(cvLanguage);

  // Extraire les données de la suggestion
  const suggestionText = suggestion.suggestion || '';
  const userContext = suggestion.userContext?.trim() || 'Aucun contexte fourni';
  const actionDescription = suggestion.actionDescription || suggestionText;
  const extractedInfo = suggestion.extractedInfo || null;

  // Formater les infos extraites pour le prompt
  let extractedInfoText = '';
  if (extractedInfo) {
    const lines = [];
    if (extractedInfo.numbers?.length) {
      lines.push(`- Chiffres : ${extractedInfo.numbers.join(', ')}`);
    }
    if (extractedInfo.skills?.length) {
      lines.push(`- Compétences : ${extractedInfo.skills.join(', ')}`);
    }
    if (extractedInfo.context) {
      lines.push(`- Contexte : ${extractedInfo.context}`);
    }
    if (lines.length > 0) {
      extractedInfoText = `\n**Informations CLÉS à préserver :**\n${lines.join('\n')}`;
    }
  }

  // Comptages actuels pour le raisonnement de l'IA
  const responsibilityCount = experience.description?.length || 0;
  const deliverableCount = experience.deliverables?.length || 0;

  // Extraire les infos clés de l'offre pour focus l'IA
  const jobTitle = jobOffer?.title || jobOffer?.job_title || 'Non spécifié';
  const jobKeySkills = extractKeySkills(jobOffer);

  console.log('[improveExperience] Amélioration experience:', experience.title, '@', experience.company);
  console.log('[improveExperience] Comptage actuel: responsibilities=%d/5, deliverables=%d/5', responsibilityCount, deliverableCount);
  console.log('[improveExperience] Suggestion:', suggestionText.substring(0, 50) + '...');
  console.log('[improveExperience] Action:', actionDescription);
  if (extractedInfo) {
    console.log('[improveExperience] ExtractedInfo:', JSON.stringify(extractedInfo));
  }

  // Charger les prompts
  const systemPrompt = await loadPromptWithVars('lib/openai/prompts/improve-cv/experience-system.md', {
    cvLanguage: cvLanguageName,
  });
  const userPrompt = await loadPromptWithVars('lib/openai/prompts/improve-cv/experience-user.md', {
    experienceContent: JSON.stringify(experience, null, 2),
    responsibilityCount,
    deliverableCount,
    jobTitle,
    jobKeySkills,
    jobOfferContent: JSON.stringify(jobOffer, null, 2),
    suggestionText,
    userContext,
    actionDescription,
    extractedInfoText,
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

    console.log('[improveExperience] ✅ Terminé en', duration, 'ms');
    console.log('[improveExperience] Modifications:', Object.keys(result.modifications || {}).join(', '));

    // Track OpenAI usage
    if (userId && response.usage) {
      try {
        await trackOpenAIUsage({
          userId,
          featureName: 'cv_improvement_experience',
          model,
          promptTokens: response.usage.prompt_tokens || 0,
          completionTokens: response.usage.completion_tokens || 0,
          cachedTokens: response.usage.prompt_tokens_details?.cached_tokens || 0,
          duration,
        });
      } catch (trackError) {
        console.error('[improveExperience] Failed to track OpenAI usage:', trackError);
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
    console.error('[improveExperience] Erreur:', error);
    throw error;
  }
}
