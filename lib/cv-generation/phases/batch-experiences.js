/**
 * Phase Batch Experiences - Pipeline CV v2
 *
 * Adapte individuellement chaque experience KEEP:
 * - description: contexte adapte
 * - responsibilities: reformulees avec mots-cles ATS
 * - deliverables: mis en valeur avec chiffres
 * - skills_used: filtres pour pertinence
 *
 * Champs IMMUABLES (conserves depuis l'original):
 * - title, company, location, type, start_date, end_date
 *
 * Utilise le setting `model_cv_batch_experience` pour le modele IA.
 * Cree une CvGenerationSubtask de type `batch_experience` par experience.
 * Parallelise les appels IA avec Promise.all.
 */

import { promises as fs } from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { getOpenAIClient } from '@/lib/openai/client';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage, calculateCost } from '@/lib/telemetry/openai';
import { generateCacheA, buildCachedSystemPrompt } from '../utils/cacheContext.js';
import { sanitizeForPostgres } from '../utils/sanitize.js';

// Chemins des fichiers de prompts et schema
const PROMPTS_DIR = path.join(process.cwd(), 'lib/cv-generation/prompts');
const SCHEMAS_DIR = path.join(process.cwd(), 'lib/cv-generation/schemas');

/**
 * Charge un prompt depuis un fichier
 */
async function loadPrompt(filename) {
  const fullPath = path.join(PROMPTS_DIR, filename);
  const content = await fs.readFile(fullPath, 'utf-8');
  return content.trim();
}

/**
 * Charge un schema JSON depuis un fichier
 */
async function loadSchema(filename) {
  const fullPath = path.join(SCHEMAS_DIR, filename);
  const content = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Remplace les variables dans un template de prompt
 */
function replaceVariables(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  }
  return result;
}

/**
 * Filtre les deliverables pour ne garder que ceux contenant un chiffre
 * Regex: doit contenir au moins un chiffre (0-9)
 */
function filterDeliverablesWithNumbers(deliverables) {
  if (!Array.isArray(deliverables)) return [];
  return deliverables.filter(item => {
    if (typeof item !== 'string') return false;
    // Doit contenir au moins un chiffre
    return /\d/.test(item);
  });
}

/**
 * Calcule la duree en annees entre deux dates
 * @param {string} startDate - Date de debut (format YYYY-MM ou YYYY)
 * @param {string} endDate - Date de fin ou "present"/"Present"
 * @returns {number} - Duree en annees (1 decimale)
 */
function calculateYearsInDomain(startDate, endDate) {
  if (!startDate) return 0;

  // Parser la date de debut
  const startParts = startDate.split('-');
  const startYear = parseInt(startParts[0], 10);
  const startMonth = startParts[1] ? parseInt(startParts[1], 10) : 1;

  // Parser la date de fin (ou utiliser aujourd'hui si "present")
  let endYear, endMonth;
  if (!endDate || endDate.toLowerCase() === 'present' || endDate.toLowerCase() === 'aujourd\'hui') {
    const now = new Date();
    endYear = now.getFullYear();
    endMonth = now.getMonth() + 1;
  } else {
    const endParts = endDate.split('-');
    endYear = parseInt(endParts[0], 10);
    endMonth = endParts[1] ? parseInt(endParts[1], 10) : 12;
  }

  // Calculer la difference en mois puis convertir en annees
  const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth);
  const years = Math.max(0.1, totalMonths / 12);

  // Arrondir a 1 decimale
  return Math.round(years * 10) / 10;
}

/**
 * Applique le filtre des deliverables sur une experience adaptee
 * et merge avec les champs immuables de l'experience originale
 *
 * @param {Object} adaptedExperience - Experience adaptee par l'IA
 * @param {Object} originalExperience - Experience originale (source)
 */
function sanitizeAdaptedExperience(adaptedExperience, originalExperience) {
  if (!adaptedExperience) return adaptedExperience;

  // Champs immuables: conserves depuis l'original
  const immutableFields = {
    title: originalExperience?.title,
    company: originalExperience?.company,
    location: originalExperience?.location,
    type: originalExperience?.type,
    start_date: originalExperience?.start_date,
    end_date: originalExperience?.end_date,
  };

  return {
    ...immutableFields,
    ...adaptedExperience,
    // Forcer les champs immuables meme si l'IA les a retournes
    ...immutableFields,
    deliverables: filterDeliverablesWithNumbers(adaptedExperience.deliverables || []),
  };
}


/**
 * Adapte une seule experience
 *
 * @param {Object} params
 * @param {Object} params.experience - Experience a adapter
 * @param {number} params.experienceIndex - Index de l'experience
 * @param {string} params.targetLanguage - Langue cible
 * @param {string} params.model - Modele IA a utiliser
 * @param {Object} params.systemPrompt - Prompt systeme (avec cache prefix)
 * @param {Object} params.userPromptTemplate - Template du prompt utilisateur
 * @param {Object} params.schema - Schema JSON
 * @param {string} params.offerId - ID de l'offre
 * @param {string} params.userId - ID utilisateur
 * @param {AbortSignal} params.signal - Signal d'annulation
 * @returns {Promise<Object>}
 */
async function adaptSingleExperience({
  experience,
  experienceIndex,
  targetLanguage,
  model,
  systemPrompt,
  userPromptTemplate,
  schema,
  offerId,
  userId,
  signal,
}) {
  const startTime = Date.now();

  // Creer la subtask
  const subtask = await prisma.cvGenerationSubtask.create({
    data: {
      offerId,
      type: 'batch_experience',
      itemIndex: experienceIndex,
      status: 'running',
      input: {
        originalTitle: experience?.title || 'N/A',
        company: experience?.company || 'N/A',
      },
      startedAt: new Date(),
    },
  });

  try {
    // Pre-calculer years_in_domain pour aider l'IA
    const calculatedYears = calculateYearsInDomain(experience.start_date, experience.end_date);

    // Ajouter le calcul pre-fait a l'experience pour l'IA
    const experienceWithYears = {
      ...experience,
      _calculated_years: calculatedYears,
    };

    // Preparer le prompt utilisateur (job offer est dans le system prompt via cache)
    const userPrompt = replaceVariables(userPromptTemplate, {
      experienceJson: JSON.stringify(experienceWithYears, null, 2),
      targetLanguage,
    });

    // Appeler OpenAI
    const client = getOpenAIClient();

    const requestOptions = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: schema,
      },
      temperature: 0.3, // Un peu plus de creativite pour la reformulation
      max_completion_tokens: 1500,
    };

    const fetchOptions = signal ? { signal } : {};
    const response = await client.chat.completions.create(requestOptions, fetchOptions);

    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    const duration = Date.now() - startTime;

    // Parser la reponse
    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    // Parser et sanitizer la reponse (filtre les deliverables sans chiffres + champs immuables)
    const rawExperience = JSON.parse(content);
    const adaptedExperience = sanitizeAdaptedExperience(rawExperience, experience);

    // DEBUG: Log des modifications retournées par l'IA
    console.log(`[batch-experiences] Experience ${experienceIndex} modifications:`, {
      hasModifications: !!adaptedExperience.modifications,
      count: adaptedExperience.modifications?.length || 0,
      modifications: adaptedExperience.modifications,
    });

    // Tracker l'usage
    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;
    const cachedTokens = response.usage?.prompt_tokens_details?.cached_tokens || 0;

    // Calculer le coût estimé
    const estimatedCost = await calculateCost({
      model,
      promptTokens,
      completionTokens,
      cachedTokens,
    });

    if (userId) {
      await trackOpenAIUsage({
        userId,
        featureName: 'cv_adaptation_experience',
        model,
        promptTokens,
        completionTokens,
        cachedTokens,
        duration,
      });
    }

    // Nettoyer et mettre a jour la subtask
    const sanitizedOutput = sanitizeForPostgres(adaptedExperience);
    await prisma.cvGenerationSubtask.update({
      where: { id: subtask.id },
      data: {
        status: 'completed',
        output: sanitizedOutput,
        modifications: sanitizedOutput.modifications,
        modelUsed: model,
        promptTokens,
        cachedTokens,
        completionTokens,
        estimatedCost,
        durationMs: duration,
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      experienceIndex,
      adaptedExperience,
      modifications: adaptedExperience.modifications || [],
      subtaskId: subtask.id,
      duration,
      tokens: { prompt: promptTokens, completion: completionTokens, cached: cachedTokens },
      estimatedCost,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    await prisma.cvGenerationSubtask.update({
      where: { id: subtask.id },
      data: {
        status: 'failed',
        error: error.message,
        durationMs: duration,
        completedAt: new Date(),
      },
    });

    return {
      success: false,
      experienceIndex,
      error: error.message,
      subtaskId: subtask.id,
      duration,
    };
  }
}

/**
 * Execute le batch d'adaptation des experiences
 *
 * @param {Object} params
 * @param {string} params.offerId - ID de la CvGenerationOffer
 * @param {Array} params.experiences - Experiences KEEP a adapter
 * @param {Object} params.jobOffer - Offre d'emploi
 * @param {string} params.targetLanguage - Langue cible (fr, en, es, de)
 * @param {string} params.userId - ID utilisateur
 * @param {AbortSignal} params.signal - Signal d'annulation
 * @returns {Promise<Object>}
 */
export async function executeBatchExperiences({
  offerId,
  experiences,
  jobOffer,
  targetLanguage = 'francais',
  userId,
  signal = null,
}) {
  const startTime = Date.now();

  // Filter out any undefined/null experiences
  const validExperiences = (experiences || []).filter(exp => exp && typeof exp === 'object');

  if (validExperiences.length === 0) {
    console.log('[batch-experiences] No experiences to adapt');
    return {
      success: true,
      adaptedExperiences: [],
      stats: { total: 0, succeeded: 0, failed: 0 },
      duration: 0,
    };
  }

  console.log(`[batch-experiences] Adapting ${validExperiences.length} experience(s)...`);

  try {
    // Charger le modele, prompts et schema
    const model = await getAiModelSetting('model_cv_batch_experience');
    const systemPromptInstructions = await loadPrompt('batch-experience-system.md');
    const userPromptTemplate = await loadPrompt('batch-experience-user.md');
    const schema = await loadSchema('batchExperienceSchema.json');

    // Generer le Cache A (Job Offer) et construire le system prompt
    const cacheA = generateCacheA(jobOffer);
    const systemPrompt = buildCachedSystemPrompt(cacheA, systemPromptInstructions);

    // Strategie d'execution:
    // 1. Executer la premiere experience pour etablir le cache OpenAI
    // 2. Executer les autres en parallele (beneficient du cache)
    let results = [];

    if (validExperiences.length === 1) {
      // Une seule experience - execution simple
      const result = await adaptSingleExperience({
        experience: validExperiences[0],
        experienceIndex: 0,
        targetLanguage,
        model,
        systemPrompt,
        userPromptTemplate,
        schema,
        offerId,
        userId,
        signal,
      });
      results = [result];
    } else {
      // Plusieurs experiences - strategie cache-first
      // Etape 1: Executer la premiere pour etablir le cache
      const firstResult = await adaptSingleExperience({
        experience: validExperiences[0],
        experienceIndex: 0,
        targetLanguage,
        model,
        systemPrompt,
        userPromptTemplate,
        schema,
        offerId,
        userId,
        signal,
      });

      // Etape 2: Executer les autres en parallele (beneficient du cache)
      const remainingResults = await Promise.all(
        validExperiences.slice(1).map((experience, index) =>
          adaptSingleExperience({
            experience,
            experienceIndex: index + 1, // +1 car on a skip la premiere
            targetLanguage,
            model,
            systemPrompt,
            userPromptTemplate,
            schema,
            offerId,
            userId,
            signal,
          })
        )
      );

      results = [firstResult, ...remainingResults];
    }

    const duration = Date.now() - startTime;

    // Compiler les resultats
    const succeeded = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    // Construire le tableau des experiences adaptees (dans l'ordre)
    const adaptedExperiences = results
      .filter(r => r.success)
      .sort((a, b) => a.experienceIndex - b.experienceIndex)
      .map(r => r.adaptedExperience);

    // Collecter les modifications par index d'experience
    const modifications = {};
    for (const r of results.filter(r => r.success)) {
      if (r.modifications && r.modifications.length > 0) {
        modifications[r.experienceIndex] = {
          modifications: r.modifications,
        };
      }
    }

    // Calculer les tokens totaux
    const totalTokens = {
      prompt: succeeded.reduce((sum, r) => sum + (r.tokens?.prompt || 0), 0),
      completion: succeeded.reduce((sum, r) => sum + (r.tokens?.completion || 0), 0),
    };

    console.log(`[batch-experiences] Completed in ${duration}ms:`, {
      total: experiences.length,
      succeeded: succeeded.length,
      failed: failed.length,
      totalTokens,
    });

    return {
      success: failed.length === 0,
      adaptedExperiences,
      modifications,
      results,
      stats: {
        total: experiences.length,
        succeeded: succeeded.length,
        failed: failed.length,
      },
      tokens: totalTokens,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[batch-experiences] Failed after ${duration}ms:`, error.message);

    return {
      success: false,
      error: error.message,
      adaptedExperiences: [],
      stats: { total: experiences.length, succeeded: 0, failed: experiences.length },
      duration,
    };
  }
}
