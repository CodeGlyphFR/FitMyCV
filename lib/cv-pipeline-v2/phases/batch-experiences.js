/**
 * Phase Batch Experiences - Pipeline CV v2
 *
 * Adapte individuellement chaque experience KEEP:
 * - title: adapte aux termes de l'offre
 * - responsibilities: reformulees avec mots-cles
 * - deliverables: mis en valeur
 * - skills_used: filtres pour pertinence
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
import { trackOpenAIUsage } from '@/lib/telemetry/openai';
import { generateCacheA, buildCachedSystemPrompt } from '../utils/cacheContext.js';
import { sanitizeForPostgres } from '../utils/sanitize.js';

// Chemins des fichiers de prompts et schema
const PROMPTS_DIR = path.join(process.cwd(), 'lib/cv-pipeline-v2/prompts');
const SCHEMAS_DIR = path.join(process.cwd(), 'lib/cv-pipeline-v2/schemas');

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
 * Applique le filtre des deliverables sur une experience adaptee
 */
function sanitizeAdaptedExperience(experience) {
  if (!experience) return experience;
  return {
    ...experience,
    deliverables: filterDeliverablesWithNumbers(experience.deliverables || []),
  };
}

/**
 * Extrait les informations cles de l'offre d'emploi pour le prompt
 */
function extractJobOfferInfo(jobOffer) {
  const skills = jobOffer.skills || {};
  const required = skills.required || [];
  const niceToHave = skills.nice_to_have || [];

  // Extraire les mots-cles des differentes sections
  const keywords = new Set();

  // Ajouter le titre
  if (jobOffer.title) keywords.add(jobOffer.title);

  // Ajouter les competences
  required.forEach(s => keywords.add(s));
  niceToHave.forEach(s => keywords.add(s));

  // Ajouter les responsabilites si presentes
  if (jobOffer.responsibilities) {
    jobOffer.responsibilities.forEach(r => {
      // Extraire les mots importants (> 4 caracteres)
      r.split(/\s+/).filter(w => w.length > 4).slice(0, 3).forEach(w => keywords.add(w));
    });
  }

  return {
    jobTitle: jobOffer.title || 'Non specifie',
    requiredSkills: required.length > 0 ? required.join(', ') : 'Non specifie',
    niceToHaveSkills: niceToHave.length > 0 ? niceToHave.join(', ') : 'Non specifie',
    keywords: Array.from(keywords).slice(0, 20).join(', '),
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
    // Preparer le prompt utilisateur (job offer est dans le system prompt via cache)
    const userPrompt = replaceVariables(userPromptTemplate, {
      experienceJson: JSON.stringify(experience, null, 2),
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

    // Parser et sanitizer la reponse (filtre les deliverables sans chiffres)
    const rawExperience = JSON.parse(content);
    const adaptedExperience = sanitizeAdaptedExperience(rawExperience);

    // DEBUG: Log des modifications retournées par l'IA
    console.log(`[batch-experiences] Experience ${experienceIndex} modifications:`, {
      hasModifications: !!adaptedExperience.modifications,
      count: adaptedExperience.modifications?.length || 0,
      modifications: adaptedExperience.modifications,
    });

    // Tracker l'usage
    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;

    if (userId) {
      await trackOpenAIUsage({
        userId,
        featureName: 'cv_pipeline_v2_batch_experience',
        model,
        promptTokens,
        completionTokens,
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
        completionTokens,
        durationMs: duration,
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      experienceIndex,
      adaptedExperience,
      subtaskId: subtask.id,
      duration,
      tokens: { prompt: promptTokens, completion: completionTokens },
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

    // Extraire les infos de l'offre (plus necessaire pour le prompt mais garde pour logs)
    const jobOfferInfo = extractJobOfferInfo(jobOffer);

    // Paralleliser les appels avec Promise.all
    const results = await Promise.all(
      validExperiences.map((experience, index) =>
        adaptSingleExperience({
          experience,
          experienceIndex: index,
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

    const duration = Date.now() - startTime;

    // Compiler les resultats
    const succeeded = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    // Construire le tableau des experiences adaptees (dans l'ordre)
    const adaptedExperiences = results
      .filter(r => r.success)
      .sort((a, b) => a.experienceIndex - b.experienceIndex)
      .map(r => r.adaptedExperience);

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
