import { getOpenAIClient } from './client.js';
import { getImproveExtrasModel } from '@/lib/settings/aiModels';
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
  if (jobOffer.certifications?.length) {
    skills.push(...jobOffer.certifications.slice(0, 3));
  }

  if (skills.length === 0) {
    return jobOffer.description?.substring(0, 200) || 'Non spécifié';
  }

  return skills.join(', ');
}

/**
 * Améliore ou ajoute un extra dans le CV (certification, hobby, bénévolat, etc.)
 *
 * @param {Object} params
 * @param {Array} params.extras - Les extras actuels du CV
 * @param {Object} params.suggestion - La suggestion à appliquer
 * @param {string} params.suggestion.suggestion - Texte de la suggestion
 * @param {string} [params.suggestion.userContext] - Contexte libre fourni par l'utilisateur
 * @param {number|null} params.targetIndex - Index de l'extra à modifier (null pour ajout)
 * @param {Object} params.jobOffer - L'offre d'emploi (pour alignement vocabulaire)
 * @param {string} params.cvLanguage - Code langue du CV (fr, en, etc.)
 * @param {AbortSignal} [params.signal] - Signal pour annulation
 * @param {string} [params.userId] - User ID pour tracking
 * @returns {Promise<Object>} - { action, modifications|newExtra, hasChanges, reasoning, targetIndex }
 */
export async function improveExtras({
  extras = [],
  suggestion,
  targetIndex = null,
  jobOffer,
  cvLanguage = 'fr',
  signal = null,
  userId = null,
}) {
  const client = getOpenAIClient();
  const model = await getImproveExtrasModel();

  // Convertir le code langue en nom lisible
  const cvLanguageName = getLanguageName(cvLanguage);

  // Extraire les données de la suggestion
  const suggestionText = suggestion.suggestion || '';
  const userContext = suggestion.userContext?.trim() || 'Aucun contexte fourni';
  const actionDescription = suggestion.actionDescription || suggestionText;

  // Extraire les infos clés de l'offre
  const jobTitle = jobOffer?.title || jobOffer?.job_title || 'Non spécifié';
  const jobKeySkills = extractKeySkills(jobOffer);

  console.log('[improveExtras] Traitement suggestion extras');
  console.log('[improveExtras] Suggestion:', suggestionText.substring(0, 50) + '...');
  console.log('[improveExtras] Action:', actionDescription);
  console.log('[improveExtras] targetIndex:', targetIndex);

  // Charger les prompts
  const systemPrompt = await loadPromptWithVars('lib/openai/prompts/improve-cv-v2/extras-system.md', {
    cvLanguage: cvLanguageName,
  });
  const userPrompt = await loadPromptWithVars('lib/openai/prompts/improve-cv-v2/extras-user.md', {
    extrasContent: JSON.stringify(extras, null, 2),
    jobTitle,
    jobKeySkills,
    suggestionText,
    userContext,
    actionDescription,
    targetIndex: targetIndex !== null ? targetIndex.toString() : 'null (ajout d\'un nouvel extra)',
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

    console.log('[improveExtras] ✅ Terminé en', duration, 'ms');
    console.log('[improveExtras] action:', result.action);
    console.log('[improveExtras] hasChanges:', result.hasChanges);

    // Track OpenAI usage
    if (userId && response.usage) {
      try {
        await trackOpenAIUsage({
          userId,
          featureName: 'cv_improvement_v2_extras',
          model,
          promptTokens: response.usage.prompt_tokens || 0,
          completionTokens: response.usage.completion_tokens || 0,
          cachedTokens: response.usage.prompt_tokens_details?.cached_tokens || 0,
          duration,
        });
      } catch (trackError) {
        console.error('[improveExtras] Failed to track OpenAI usage:', trackError);
      }
    }

    return {
      action: result.action || 'none',
      modifications: result.modifications || null,
      newExtra: result.newExtra || null,
      hasChanges: result.hasChanges === true,
      reasoning: result.reasoning || '',
      targetIndex: result.action === 'update' ? (result.targetIndex ?? targetIndex) : null,
    };
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      throw new Error('Task cancelled');
    }
    console.error('[improveExtras] Erreur:', error);
    throw error;
  }
}

/**
 * Applique les modifications d'extras au CV
 *
 * @param {Array} extras - Les extras originaux
 * @param {Object} result - Le résultat de improveExtras
 * @returns {Array} - Les extras modifiés
 */
export function applyExtrasModifications(extras, result) {
  if (!result || !result.hasChanges) {
    return extras;
  }

  const modified = [...(extras || [])];

  if (result.action === 'add' && result.newExtra) {
    // Ajouter un nouvel extra
    modified.push(result.newExtra);
    console.log('[applyExtrasModifications] Ajout extra:', result.newExtra.name);
  } else if (result.action === 'update' && result.modifications && result.targetIndex !== null) {
    // Modifier un extra existant
    const idx = result.targetIndex;
    if (idx >= 0 && idx < modified.length) {
      modified[idx] = {
        ...modified[idx],
        ...result.modifications,
      };
      console.log('[applyExtrasModifications] Modification extra[' + idx + ']:', result.modifications);
    }
  }

  return modified;
}
