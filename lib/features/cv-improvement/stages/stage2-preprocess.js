/**
 * Prétraitement des suggestions - Classification par IA
 * Utilise GPT pour router intelligemment les suggestions vers les bonnes cibles
 *
 * @module preprocessSuggestions
 */

import { getOpenAIClient } from '@/lib/openai-core/client.js';
import { loadPromptWithVars } from '@/lib/openai-core/promptLoader.js';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';
import { getImprovePreprocessModel } from '@/lib/settings/aiModels';

/**
 * Formate les expériences pour le prompt
 */
function formatExperiences(experiences) {
  if (!experiences || experiences.length === 0) {
    return 'Aucune expérience';
  }

  return experiences.map((exp, i) => {
    const title = exp.title || 'Sans titre';
    const company = exp.company || 'Entreprise inconnue';
    const startDate = exp.start_date || '?';
    const endDate = exp.end_date || 'Présent';
    const bulletCount = exp.description?.length || 0;
    return `[${i}] ${title} @ ${company} (${startDate} - ${endDate}) - ${bulletCount} bullet points`;
  }).join('\n');
}

/**
 * Formate les projets pour le prompt
 */
function formatProjects(projects) {
  if (!projects || projects.length === 0) {
    return 'Aucun projet';
  }

  return projects.map((proj, i) => {
    const name = proj.name || 'Sans nom';
    const summary = proj.summary?.substring(0, 50) || 'Pas de description';
    return `[${i}] ${name} - ${summary}...`;
  }).join('\n');
}

/**
 * Formate les langues pour le prompt
 */
function formatLanguages(languages) {
  if (!languages || languages.length === 0) {
    return 'Aucune langue';
  }

  return languages.map((lang, i) => {
    const name = lang.name || 'Langue inconnue';
    const level = lang.level || 'Non précisé';
    return `[${i}] ${name} - ${level}`;
  }).join('\n');
}

/**
 * Formate les extras pour le prompt
 */
function formatExtras(extras) {
  if (!extras || extras.length === 0) {
    return 'Aucun extra';
  }

  return extras.map((extra, i) => {
    const name = extra.name || 'Sans nom';
    const summary = extra.summary?.substring(0, 50) || '';
    return `[${i}] ${name}${summary ? ` - ${summary}` : ''}`;
  }).join('\n');
}

/**
 * Formate les suggestions pour le prompt
 */
function formatSuggestions(suggestions) {
  return suggestions.map((sug, i) => {
    const text = sug.suggestion || 'Suggestion vide';
    const context = sug.userContext ? `\n   Contexte utilisateur: "${sug.userContext}"` : '';
    return `[${i}] "${text}"${context}`;
  }).join('\n\n');
}

/**
 * Analyse les suggestions cochées et identifie les cibles (expérience/projet/langue/extras)
 * Utilise l'IA pour une classification intelligente et multilingue
 *
 * @param {Object} params
 * @param {Array} params.suggestions - Les suggestions cochées par l'utilisateur
 * @param {Array} params.experiences - Les expériences du CV
 * @param {Array} params.projects - Les projets du CV
 * @param {Array} params.languages - Les langues du CV
 * @param {Array} params.extras - Les extras du CV (certifications, hobbies, etc.)
 * @param {Object} params.jobOffer - L'offre d'emploi
 * @param {AbortSignal} [params.signal] - Signal pour annulation
 * @param {string} [params.userId] - User ID pour tracking
 * @returns {Promise<Object>} - { experienceImprovements, projectImprovements, newProjects, languageImprovements, extrasImprovements, unmatchedSuggestions, success }
 */
export async function preprocessSuggestions({
  suggestions = [],
  experiences = [],
  projects = [],
  languages = [],
  extras = [],
  jobOffer = null,
  signal = null,
  userId = null,
}) {
  console.log('[preprocessSuggestions] Analyse de', suggestions.length, 'suggestions via IA');
  console.log('[preprocessSuggestions] Expériences disponibles:', experiences.length);
  console.log('[preprocessSuggestions] Projets disponibles:', projects.length);
  console.log('[preprocessSuggestions] Langues disponibles:', languages.length);
  console.log('[preprocessSuggestions] Extras disponibles:', extras.length);

  // Si pas de suggestions, retour rapide
  if (suggestions.length === 0) {
    return {
      success: true,
      experienceImprovements: [],
      projectImprovements: [],
      newProjects: [],
      languageImprovements: [],
      extrasImprovements: [],
      unmatchedSuggestions: [],
    };
  }

  const client = getOpenAIClient();
  const model = await getImprovePreprocessModel();

  // Préparer les données pour le prompt
  const experiencesList = formatExperiences(experiences);
  const projectsList = formatProjects(projects);
  const languagesList = formatLanguages(languages);
  const extrasList = formatExtras(extras);
  const suggestionsList = formatSuggestions(suggestions);

  // Charger les prompts
  const systemPrompt = await loadPromptWithVars('lib/features/cv-improvement/prompts/preprocess-system.md', {});
  const userPrompt = await loadPromptWithVars('lib/features/cv-improvement/prompts/preprocess-user.md', {
    experienceCount: experiences.length,
    experiencesList,
    projectCount: projects.length,
    projectsList,
    languageCount: languages.length,
    languagesList,
    extrasCount: extras.length,
    extrasList,
    suggestionCount: suggestions.length,
    suggestionsList,
  });

  const requestOptions = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1, // Déterministe pour la classification
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
      throw new Error('No AI response for preprocessing');
    }

    const result = JSON.parse(content);
    console.log('[preprocessSuggestions] Classification IA terminée en', duration, 'ms');

    // Track OpenAI usage
    if (userId && response.usage) {
      try {
        await trackOpenAIUsage({
          userId,
          featureName: 'cv_improvement_preprocess',
          model,
          promptTokens: response.usage.prompt_tokens || 0,
          completionTokens: response.usage.completion_tokens || 0,
          cachedTokens: response.usage.prompt_tokens_details?.cached_tokens || 0,
          duration,
        });
      } catch (trackError) {
        console.error('[preprocessSuggestions] Failed to track OpenAI usage:', trackError);
      }
    }

    // Traiter les classifications (nouveau format avec actions multiples)
    const experienceImprovements = []; // { index, improvements: [] }
    const projectImprovements = []; // { index, improvements: [] }
    const newProjects = []; // { suggestion, actionDescription }
    const languageImprovements = []; // { index, improvements: [] } - index can be null for new language
    const extrasImprovements = []; // { index, improvements: [] } - index can be null for new extra
    const unmatchedSuggestions = [];

    // Maps pour grouper les actions par cible
    const expMap = new Map();
    const projMap = new Map();
    const langMap = new Map(); // Map<index|'new', suggestions[]>
    const extrasMap = new Map(); // Map<index|'new', suggestions[]>

    for (const classification of result.classifications || []) {
      const suggestion = suggestions[classification.suggestionIndex];
      if (!suggestion) continue;

      // Log le raisonnement Chain of Thought
      console.log(`[preprocessSuggestions] Suggestion[${classification.suggestionIndex}] analysis: ${classification.analysis}`);

      // Traiter chaque action de la classification
      const actions = classification.actions || [];
      if (actions.length === 0) {
        console.warn('[preprocessSuggestions] Pas d\'actions pour suggestion:', classification.suggestionIndex);
        unmatchedSuggestions.push(suggestion);
        continue;
      }

      for (const action of actions) {
        const { targetType, targetIndex, actionDescription, confidence, extractedInfo } = action;
        console.log(`  → Action: ${targetType}[${targetIndex}] (conf: ${confidence}) - ${actionDescription}`);
        if (extractedInfo) {
          console.log(`    ExtractedInfo: numbers=${extractedInfo.numbers?.join(', ')}, skills=${extractedInfo.skills?.join(', ')}`);
        }

        // Créer un objet enrichi avec l'action description et les infos extraites
        const enrichedSuggestion = {
          ...suggestion,
          actionDescription, // Ce que l'IA doit faire concrètement
          extractedInfo, // Informations structurées (chiffres, compétences, contexte)
        };

        if (targetType === 'experience' && targetIndex !== null && targetIndex < experiences.length) {
          if (!expMap.has(targetIndex)) {
            expMap.set(targetIndex, []);
          }
          expMap.get(targetIndex).push(enrichedSuggestion);
        } else if (targetType === 'project' && targetIndex !== null && targetIndex < projects.length) {
          if (!projMap.has(targetIndex)) {
            projMap.set(targetIndex, []);
          }
          projMap.get(targetIndex).push(enrichedSuggestion);
        } else if (targetType === 'new_project') {
          newProjects.push({ suggestion: enrichedSuggestion, actionDescription });
        } else if (targetType === 'language') {
          // Language: index can be null (add new) or a valid index (modify existing)
          const key = targetIndex !== null && targetIndex < languages.length ? targetIndex : 'new';
          if (!langMap.has(key)) {
            langMap.set(key, []);
          }
          langMap.get(key).push(enrichedSuggestion);
        } else if (targetType === 'extras') {
          // Extras: index can be null (add new) or a valid index (modify existing)
          const key = targetIndex !== null && targetIndex < extras.length ? targetIndex : 'new';
          if (!extrasMap.has(key)) {
            extrasMap.set(key, []);
          }
          extrasMap.get(key).push(enrichedSuggestion);
        } else {
          console.warn('[preprocessSuggestions] Action invalide:', action);
          // On ne push pas en unmatched ici car il peut y avoir d'autres actions valides
        }
      }
    }

    // Convertir les maps en arrays
    for (const [index, improvements] of expMap.entries()) {
      experienceImprovements.push({ index, improvements });
    }

    for (const [index, improvements] of projMap.entries()) {
      projectImprovements.push({ index, improvements });
    }

    for (const [index, improvements] of langMap.entries()) {
      languageImprovements.push({ index: index === 'new' ? null : index, improvements });
    }

    for (const [index, improvements] of extrasMap.entries()) {
      extrasImprovements.push({ index: index === 'new' ? null : index, improvements });
    }

    console.log('[preprocessSuggestions] Résultat:');
    console.log('  - experienceImprovements:', experienceImprovements.length);
    console.log('  - projectImprovements:', projectImprovements.length);
    console.log('  - newProjects:', newProjects.length);
    console.log('  - languageImprovements:', languageImprovements.length);
    console.log('  - extrasImprovements:', extrasImprovements.length);
    console.log('  - unmatchedSuggestions:', unmatchedSuggestions.length);

    return {
      success: true,
      experienceImprovements,
      projectImprovements,
      newProjects,
      languageImprovements,
      extrasImprovements,
      unmatchedSuggestions,
    };
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      throw new Error('Task cancelled');
    }
    console.error('[preprocessSuggestions] Erreur IA:', error);

    // Fallback: toutes les suggestions vont à la première expérience
    console.log('[preprocessSuggestions] Fallback: toutes suggestions → experience[0]');
    return {
      success: false,
      experienceImprovements: experiences.length > 0
        ? [{ index: 0, improvements: suggestions }]
        : [],
      projectImprovements: [],
      newProjects: [],
      languageImprovements: [],
      extrasImprovements: [],
      unmatchedSuggestions: experiences.length === 0 ? suggestions : [],
    };
  }
}
