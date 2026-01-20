/**
 * Phase Batch Projects - Pipeline CV v2
 *
 * Adapte individuellement chaque projet KEEP + experiences MOVE_TO_PROJECTS:
 * - summary: reformule avec mots-cles de l'offre
 * - tech_stack: reordonne et filtre par pertinence
 *
 * Utilise le setting `model_cv_batch_projects` pour le modele IA.
 * Cree une CvGenerationSubtask de type `batch_project` par projet.
 * Parallelise les appels IA avec Promise.all.
 */

import { promises as fs } from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { getOpenAIClient } from '@/lib/openai-core/client';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage, calculateCost } from '@/lib/telemetry/openai';
import { generateCacheA, buildCachedSystemPrompt } from '../utils/cacheContext.js';
import { sanitizeForPostgres } from '../utils/sanitize.js';

const PROMPTS_DIR = path.join(process.cwd(), 'lib/features/cv-adaptation/prompts');
const SCHEMAS_DIR = path.join(process.cwd(), 'lib/features/cv-adaptation/schemas');

async function loadPrompt(filename) {
  const fullPath = path.join(PROMPTS_DIR, filename);
  const content = await fs.readFile(fullPath, 'utf-8');
  return content.trim();
}

async function loadSchema(filename) {
  const fullPath = path.join(SCHEMAS_DIR, filename);
  const content = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(content);
}

function replaceVariables(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  }
  return result;
}

/**
 * Convertit une experience MOVE_TO_PROJECTS en format projet
 * Structure complete pour que l'IA puisse generer tous les champs
 */
export function convertExperienceToProject(experience, reason) {
  // Handle undefined or null experience
  if (!experience || typeof experience !== 'object') {
    console.warn('[batch-projects] convertExperienceToProject called with invalid experience:', experience);
    return null;
  }

  return {
    // Nom du projet: titre de l'experience ou nom entreprise/contexte
    name: experience.title || experience.company || 'Projet',
    // Role initial vide (l'IA le deduira)
    role: '',
    // Dates de l'experience
    start_date: experience.start_date || '',
    end_date: experience.end_date || '',
    // Summary initial: description ou responsabilites
    summary: experience.description || experience.responsibilities?.join('. ') || '',
    // Tech stack depuis skills_used
    tech_stack: experience.skills_used || [],
    url: null,
    // Marqueur pour l'IA
    _fromExperience: true,
    _classificationReason: reason,
    // Conserver toutes les infos originales pour l'IA
    _originalExperience: {
      title: experience.title || '',
      company: experience.company || '',
      start_date: experience.start_date || '',
      end_date: experience.end_date || '',
      description: experience.description || '',
      responsibilities: experience.responsibilities || [],
      deliverables: experience.deliverables || [],
      skills_used: experience.skills_used || [],
    },
  };
}

/**
 * Extrait les informations cles de l'offre pour le prompt
 */
function extractJobOfferInfo(jobOffer) {
  const skills = jobOffer.skills || {};
  const required = skills.required || [];
  const niceToHave = skills.nice_to_have || [];

  return {
    jobTitle: jobOffer.title || 'Non specifie',
    requiredSkills: required.length > 0 ? required.join(', ') : 'Non specifie',
    niceToHaveSkills: niceToHave.length > 0 ? niceToHave.join(', ') : 'Non specifie',
  };
}

/**
 * Adapte un seul projet
 */
async function adaptSingleProject({
  project,
  projectIndex,
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

  const subtask = await prisma.cvGenerationSubtask.create({
    data: {
      offerId,
      type: 'batch_project',
      itemIndex: projectIndex,
      status: 'running',
      input: {
        name: project.name,
        fromExperience: project._fromExperience || false,
      },
      startedAt: new Date(),
    },
  });

  try {
    // Note speciale si le projet vient d'une experience convertie
    const movedFromExperienceNote = project._fromExperience
      ? `**Note:** Ce projet a ete converti depuis une experience professionnelle (${project._originalExperience?.title} chez ${project._originalExperience?.company}). Adapte-le en format projet.`
      : '';

    // Job offer est dans le system prompt via cache
    const userPrompt = replaceVariables(userPromptTemplate, {
      projectJson: JSON.stringify(project, null, 2),
      movedFromExperienceNote,
      targetLanguage,
    });

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
      temperature: 0.3,
      max_completion_tokens: 1000,
    };

    const fetchOptions = signal ? { signal } : {};
    const response = await client.chat.completions.create(requestOptions, fetchOptions);

    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    const duration = Date.now() - startTime;

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    const adaptedProject = JSON.parse(content);

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
        featureName: 'cv_adaptation_project',
        model,
        promptTokens,
        completionTokens,
        cachedTokens,
        duration,
      });
    }

    // Sanitize output for PostgreSQL (remove \u0000 characters)
    const sanitizedOutput = sanitizeForPostgres(adaptedProject);

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
      projectIndex,
      adaptedProject,
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
      projectIndex,
      error: error.message,
      subtaskId: subtask.id,
      duration,
    };
  }
}

/**
 * Execute le batch d'adaptation des projets
 *
 * @param {Object} params
 * @param {string} params.offerId - ID de la CvGenerationOffer
 * @param {Array} params.projects - Projets KEEP a adapter
 * @param {Array} params.movedExperiences - Experiences converties en projets (optionnel)
 * @param {Object} params.jobOffer - Offre d'emploi
 * @param {string} params.targetLanguage - Langue cible
 * @param {string} params.userId - ID utilisateur
 * @param {AbortSignal} params.signal - Signal d'annulation
 * @returns {Promise<Object>}
 */
export async function executeBatchProjects({
  offerId,
  projects = [],
  movedExperiences = [],
  jobOffer,
  targetLanguage = 'francais',
  userId,
  signal = null,
}) {
  const startTime = Date.now();

  // Combiner projets KEEP + experiences converties
  const allProjects = [...projects, ...movedExperiences];

  if (allProjects.length === 0) {
    console.log('[batch-projects] No projects to adapt');
    return {
      success: true,
      adaptedProjects: [],
      stats: { total: 0, succeeded: 0, failed: 0, fromExperiences: 0 },
      duration: 0,
    };
  }

  console.log(`[batch-projects] Adapting ${allProjects.length} project(s) (${movedExperiences.length} from experiences)...`);

  try {
    const model = await getAiModelSetting('model_cv_batch_projects');
    const systemPromptInstructions = await loadPrompt('batch-project-system.md');
    const userPromptTemplate = await loadPrompt('batch-project-user.md');
    const schema = await loadSchema('batchProjectSchema.json');

    // Generer le Cache A (Job Offer) et construire le system prompt
    const cacheA = generateCacheA(jobOffer);
    const systemPrompt = buildCachedSystemPrompt(cacheA, systemPromptInstructions);

    const jobOfferInfo = extractJobOfferInfo(jobOffer); // Pour logs

    // Paralleliser les appels
    const results = await Promise.all(
      allProjects.map((project, index) =>
        adaptSingleProject({
          project,
          projectIndex: index,
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

    const succeeded = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    const adaptedProjects = results
      .filter(r => r.success)
      .sort((a, b) => a.projectIndex - b.projectIndex)
      .map(r => r.adaptedProject);

    const totalTokens = {
      prompt: succeeded.reduce((sum, r) => sum + (r.tokens?.prompt || 0), 0),
      completion: succeeded.reduce((sum, r) => sum + (r.tokens?.completion || 0), 0),
    };

    console.log(`[batch-projects] Completed in ${duration}ms:`, {
      total: allProjects.length,
      succeeded: succeeded.length,
      failed: failed.length,
      fromExperiences: movedExperiences.length,
      totalTokens,
    });

    return {
      success: failed.length === 0,
      adaptedProjects,
      results,
      stats: {
        total: allProjects.length,
        succeeded: succeeded.length,
        failed: failed.length,
        fromExperiences: movedExperiences.length,
      },
      tokens: totalTokens,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[batch-projects] Failed after ${duration}ms:`, error.message);

    return {
      success: false,
      error: error.message,
      adaptedProjects: [],
      stats: { total: allProjects.length, succeeded: 0, failed: allProjects.length },
      duration,
    };
  }
}
