/**
 * Phase Batch Skills - Pipeline CV v2
 *
 * Adapte et nettoie les skills avec 7 missions:
 * 1. SUPPRIMER les non pertinents (score <= 5)
 * 2. AJUSTER les proficiency selon l'experience
 * 3. NETTOYER les noms (parentheses, phrases -> mots-cles)
 * 4. SPLITTER les competences multiples (slash, virgule, "et")
 * 5. REARRANGER entre hard_skills / tools / methodologies
 * 6. FUSIONNER les doublons entre categories
 * 7. DEDUIRE les methodologies depuis les experiences
 *
 * Utilise le setting `model_cv_batch_skills` pour le modele IA.
 * Cree une CvGenerationSubtask de type `batch_skills`.
 * Execute APRES experiences et projects (besoin du contexte).
 */

import { promises as fs } from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { getOpenAIClient } from '@/lib/openai/client';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage, calculateCost } from '@/lib/telemetry/openai';
import { generateCacheB, buildCachedSystemPrompt } from '../utils/cacheContext.js';
import { sanitizeForPostgres } from '../utils/sanitize.js';

const PROMPTS_DIR = path.join(process.cwd(), 'lib/cv-pipeline-v2/prompts');
const SCHEMAS_DIR = path.join(process.cwd(), 'lib/cv-pipeline-v2/schemas');

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
 * Cree un resume des experiences pour le contexte
 */
function summarizeExperiences(experiences) {
  if (!experiences || experiences.length === 0) return '[]';

  return JSON.stringify(
    experiences.map(exp => ({
      title: exp.title,
      company: exp.company,
      skills_used: exp.skills_used || [],
      responsibilities: (exp.responsibilities || []).slice(0, 2), // Limiter
    })),
    null,
    2
  );
}

/**
 * Cree un resume des projets pour le contexte
 */
function summarizeProjects(projects) {
  if (!projects || projects.length === 0) return '[]';

  return JSON.stringify(
    projects.map(proj => ({
      name: proj.name,
      tech_stack: proj.tech_stack || [],
      summary: (proj.summary || '').slice(0, 100), // Limiter
    })),
    null,
    2
  );
}

/**
 * Extrait les infos de l'offre pour les skills
 * Note: jobOffer de Prisma a la structure { content: { title, skills, ... } }
 */
function extractJobOfferInfo(jobOffer) {
  // Supporter les deux formats: objet direct OU objet Prisma avec .content
  const content = jobOffer.content || jobOffer;
  const skills = content.skills || {};
  const required = skills.required || [];
  const niceToHave = skills.nice_to_have || [];
  const softSkills = skills.soft_skills || [];
  const methodologies = skills.methodologies || [];

  return {
    jobTitle: content.title || 'Non specifie',
    requiredSkills: required.length > 0 ? required.join(', ') : 'Non specifie',
    niceToHaveSkills: niceToHave.length > 0 ? niceToHave.join(', ') : 'Non specifie',
    requiredSoftSkills: softSkills.length > 0 ? softSkills.join(', ') : 'Non specifie',
    requiredMethodologies: methodologies.length > 0 ? methodologies.join(', ') : 'Non specifie',
  };
}

/**
 * Execute le batch d'adaptation des skills
 *
 * @param {Object} params
 * @param {string} params.offerId - ID de la CvGenerationOffer
 * @param {Object} params.skills - Skills source du CV {hard_skills, soft_skills, tools, methodologies}
 * @param {Array} params.adaptedExperiences - Experiences deja adaptees (pour contexte)
 * @param {Array} params.adaptedProjects - Projets deja adaptes (pour contexte)
 * @param {Object} params.jobOffer - Offre d'emploi
 * @param {string} params.targetLanguage - Langue cible
 * @param {string} params.userId - ID utilisateur
 * @param {AbortSignal} params.signal - Signal d'annulation
 * @returns {Promise<Object>}
 */
export async function executeBatchSkills({
  offerId,
  skills = {},
  adaptedExperiences = [],
  adaptedProjects = [],
  jobOffer,
  targetLanguage = 'francais',
  userId,
  signal = null,
}) {
  const startTime = Date.now();

  // Extraire les skills source
  const hardSkills = skills.hard_skills || [];
  const softSkills = skills.soft_skills || [];
  const tools = skills.tools || [];
  const methodologies = skills.methodologies || [];

  console.log(`[batch-skills] Adapting skills:`, {
    hard_skills: hardSkills.length,
    soft_skills: softSkills.length,
    tools: tools.length,
    methodologies: methodologies.length,
  });

  // Mode test: skip DB si offerId est null
  const isTestMode = !offerId;
  let subtask = null;

  if (!isTestMode) {
    // Creer la subtask
    subtask = await prisma.cvGenerationSubtask.create({
      data: {
        offerId,
        type: 'batch_skills',
        status: 'running',
        input: {
          hardSkillsCount: hardSkills.length,
          softSkillsCount: softSkills.length,
          toolsCount: tools.length,
          methodologiesCount: methodologies.length,
        },
        startedAt: new Date(),
      },
    });
  }

  try {
    const model = await getAiModelSetting('model_cv_batch_skills');
    const systemPromptInstructions = await loadPrompt('batch-skills-system.md');
    const userPromptTemplate = await loadPrompt('batch-skills-user.md');
    const schema = await loadSchema('batchSkillsSchema.json');

    // Generer le Cache B (Job Offer + Experiences + Projects adaptes) et construire le system prompt
    const cacheB = generateCacheB(jobOffer, adaptedExperiences, adaptedProjects);
    const systemPrompt = buildCachedSystemPrompt(cacheB, systemPromptInstructions);

    // Job offer et experiences/projects sont dans le system prompt via cache
    const userPrompt = replaceVariables(userPromptTemplate, {
      hardSkillsJson: JSON.stringify(hardSkills, null, 2),
      softSkillsJson: JSON.stringify(softSkills, null, 2),
      toolsJson: JSON.stringify(tools, null, 2),
      methodologiesJson: JSON.stringify(methodologies, null, 2),
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
      temperature: 0.2, // Faible pour respecter les regles strictes
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

    const result = JSON.parse(content);

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
        featureName: 'cv_pipeline_v2_batch_skills',
        model,
        promptTokens,
        completionTokens,
        cachedTokens,
        duration,
      });
    }

    // Sanitize output for PostgreSQL (remove \u0000 characters)
    const sanitizedResult = sanitizeForPostgres(result);

    if (!isTestMode) {
      await prisma.cvGenerationSubtask.update({
        where: { id: subtask.id },
        data: {
          status: 'completed',
          output: sanitizedResult,
          modifications: sanitizedResult.modifications,
          modelUsed: model,
          promptTokens,
          cachedTokens,
          completionTokens,
          estimatedCost,
          durationMs: duration,
          completedAt: new Date(),
        },
      });
    }

    // Log des modifications (format: [{category, skill, action, reason}])
    const mods = result.modifications || [];
    const modsByCategoryAndAction = {};
    for (const mod of mods) {
      const category = mod.category || 'unknown';
      const action = mod.action || 'unknown';
      if (!modsByCategoryAndAction[category]) {
        modsByCategoryAndAction[category] = { added: 0, removed: 0 };
      }
      if (modsByCategoryAndAction[category][action] !== undefined) {
        modsByCategoryAndAction[category][action]++;
      }
    }
    console.log(`[batch-skills] Completed in ${duration}ms:`, {
      totalModifications: mods.length,
      byCategory: modsByCategoryAndAction,
    });

    return {
      success: true,
      adaptedSkills: {
        hard_skills: sanitizedResult.hard_skills,
        soft_skills: sanitizedResult.soft_skills,
        tools: sanitizedResult.tools,
        methodologies: sanitizedResult.methodologies,
        modifications: sanitizedResult.modifications, // Include modifications for CvDiffViewer
      },
      modifications: sanitizedResult.modifications,
      subtaskId: subtask?.id || null,
      tokens: { prompt: promptTokens, completion: completionTokens },
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    if (!isTestMode) {
      await prisma.cvGenerationSubtask.update({
        where: { id: subtask.id },
        data: {
          status: 'failed',
          error: error.message,
          durationMs: duration,
          completedAt: new Date(),
        },
      });
    }

    console.error(`[batch-skills] Failed after ${duration}ms:`, error.message);

    return {
      success: false,
      error: error.message,
      adaptedSkills: skills, // Retourner les skills originaux en cas d'echec
      subtaskId: subtask?.id || null,
      duration,
    };
  }
}
