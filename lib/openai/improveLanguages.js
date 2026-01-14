import { getOpenAIClient } from './client.js';
import { getImproveLanguagesModel } from '@/lib/settings/aiModels';
import { loadPromptWithVars } from './promptLoader.js';
import { getLanguageName } from '@/lib/cv/detectLanguage.js';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';

/**
 * Formate les langues demandées par l'offre d'emploi
 */
function formatJobLanguages(jobOffer) {
  if (!jobOffer) return 'Non spécifié';

  const languages = jobOffer.languages || [];
  if (languages.length === 0) {
    // Essayer d'extraire de la description
    return 'Voir description de l\'offre';
  }

  return languages.map(l => {
    const lang = l.language || l.name || 'Inconnu';
    const level = l.level || 'Non précisé';
    return `- ${lang}: ${level}`;
  }).join('\n');
}

/**
 * Optimise la section langues du CV
 *
 * @param {Object} params
 * @param {Array} params.languages - Les langues actuelles du CV
 * @param {Object} params.suggestion - La suggestion éventuelle (optionnel)
 * @param {Object} params.jobOffer - L'offre d'emploi
 * @param {string} params.cvLanguage - Code langue du CV (fr, en, etc.)
 * @param {AbortSignal} [params.signal] - Signal pour annulation
 * @param {string} [params.userId] - User ID pour tracking
 * @returns {Promise<Object>} - { modifications, hasChanges, reasoning }
 */
export async function improveLanguages({
  languages = [],
  suggestion = null,
  jobOffer,
  cvLanguage = 'fr',
  signal = null,
  userId = null,
}) {
  // Si pas de langues dans le CV, rien à optimiser
  if (!languages || languages.length === 0) {
    console.log('[improveLanguages] Aucune langue dans le CV, skip');
    return {
      modifications: {},
      hasChanges: false,
      reasoning: 'Pas de langues à optimiser',
    };
  }

  const client = getOpenAIClient();
  const model = await getImproveLanguagesModel();

  // Convertir le code langue en nom lisible
  const cvLanguageName = getLanguageName(cvLanguage);

  // Extraire les données de la suggestion si présente
  const suggestionText = suggestion?.suggestion || suggestion?.actionDescription || 'Optimiser les langues pour l\'offre';

  // Extraire les infos de l'offre
  const jobTitle = jobOffer?.title || jobOffer?.job_title || 'Non spécifié';
  const jobLocation = jobOffer?.location || jobOffer?.city || 'Non spécifié';
  const jobLanguages = formatJobLanguages(jobOffer);
  const jobDescription = jobOffer?.description?.substring(0, 500) || 'Non disponible';

  console.log('[improveLanguages] Optimisation langues pour:', jobTitle);
  console.log('[improveLanguages] Langues actuelles:', languages.map(l => l.name).join(', '));
  console.log('[improveLanguages] Langues demandées:', jobLanguages);

  // Charger les prompts
  const systemPrompt = await loadPromptWithVars('lib/openai/prompts/improve-cv-v2/languages-system.md', {
    cvLanguage: cvLanguageName,
  });
  const userPrompt = await loadPromptWithVars('lib/openai/prompts/improve-cv-v2/languages-user.md', {
    languagesContent: JSON.stringify(languages, null, 2),
    jobTitle,
    jobLocation,
    jobLanguages,
    jobDescription,
    suggestionText,
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

    console.log('[improveLanguages] ✅ Terminé en', duration, 'ms');
    console.log('[improveLanguages] hasChanges:', result.hasChanges);
    if (result.modifications?.reorder) {
      console.log('[improveLanguages] Réordonnancement:', result.modifications.reorder);
    }
    if (result.modifications?.levelChanges?.length) {
      console.log('[improveLanguages] Changements de niveau:', result.modifications.levelChanges.length);
    }

    // Track OpenAI usage
    if (userId && response.usage) {
      try {
        await trackOpenAIUsage({
          userId,
          featureName: 'cv_improvement_v2_languages',
          model,
          promptTokens: response.usage.prompt_tokens || 0,
          completionTokens: response.usage.completion_tokens || 0,
          cachedTokens: response.usage.prompt_tokens_details?.cached_tokens || 0,
          duration,
        });
      } catch (trackError) {
        console.error('[improveLanguages] Failed to track OpenAI usage:', trackError);
      }
    }

    return {
      modifications: result.modifications || {},
      hasChanges: result.hasChanges === true,
      reasoning: result.reasoning || '',
    };
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      throw new Error('Task cancelled');
    }
    console.error('[improveLanguages] Erreur:', error);
    throw error;
  }
}

/**
 * Applique les modifications de langues au CV
 *
 * @param {Array} languages - Les langues originales
 * @param {Object} modifications - Les modifications à appliquer
 * @returns {Array} - Les langues modifiées
 */
export function applyLanguageModifications(languages, modifications) {
  if (!modifications || !languages?.length) {
    return languages;
  }

  let modified = [...languages];

  // Appliquer les changements de niveau d'abord
  if (modifications.levelChanges?.length) {
    for (const change of modifications.levelChanges) {
      const idx = change.languageIndex;
      if (idx >= 0 && idx < modified.length) {
        modified[idx] = {
          ...modified[idx],
          level: change.newLevel,
        };
      }
    }
  }

  // Appliquer le réordonnancement
  if (modifications.reorder?.length) {
    const reordered = [];
    for (const idx of modifications.reorder) {
      if (idx >= 0 && idx < modified.length) {
        reordered.push(modified[idx]);
      }
    }
    // Ajouter les langues qui n'étaient pas dans l'ordre (sécurité)
    for (let i = 0; i < modified.length; i++) {
      if (!modifications.reorder.includes(i)) {
        reordered.push(modified[i]);
      }
    }
    modified = reordered;
  }

  return modified;
}
