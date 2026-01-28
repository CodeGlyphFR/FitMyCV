/**
 * Phase Batch Education - Pipeline CV v2
 *
 * Traduit les formations du CV (degree et field_of_study) dans la langue cible:
 * - Si la langue cible diffère de la langue source, traduit
 * - Conserve les autres champs tels quels (institution, dates, location)
 *
 * Utilise le setting `model_cv_batch_education` pour le modèle IA.
 * Crée une CvGenerationSubtask de type `batch_education`.
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
 * Execute le batch d'adaptation des formations
 *
 * @param {Object} params
 * @param {string} params.offerId - ID de la CvGenerationOffer
 * @param {Array} params.education - Formations du CV source
 * @param {Object} params.jobOffer - Offre d'emploi
 * @param {string} params.targetLanguage - Langue cible
 * @param {string} params.userId - ID utilisateur
 * @param {AbortSignal} params.signal - Signal d'annulation
 * @returns {Promise<Object>}
 */
export async function executeBatchEducation({
  offerId,
  education = [],
  jobOffer,
  targetLanguage = 'francais',
  userId,
  signal = null,
}) {
  const startTime = Date.now();

  // Si pas de formations, retourner directement
  if (!education || education.length === 0) {
    console.log('[batch-education] No education to adapt');
    return {
      success: true,
      adaptedEducation: [],
      education_modifications: [],
      duration: 0,
    };
  }

  console.log(`[batch-education] Adapting ${education.length} education item(s)...`);

  // Créer la subtask
  const subtask = await prisma.cvGenerationSubtask.create({
    data: {
      offerId,
      type: 'batch_education',
      status: 'running',
      input: {
        educationCount: education.length,
        institutions: education.map(e => e.institution),
      },
      startedAt: new Date(),
    },
  });

  try {
    const model = await getAiModelSetting('model_cv_batch_education');
    const systemPromptInstructions = await loadPrompt('batch-education-system.md');
    const userPromptTemplate = await loadPrompt('batch-education-user.md');
    const schema = await loadSchema('batchEducationSchema.json');

    // Générer le Cache A (Job Offer) et construire le system prompt
    const cacheA = generateCacheA(jobOffer);
    const systemPrompt = buildCachedSystemPrompt(cacheA, systemPromptInstructions);

    // Variables du prompt utilisateur
    const userPrompt = replaceVariables(userPromptTemplate, {
      educationJson: JSON.stringify(education, null, 2),
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
      temperature: 0.2,
      max_completion_tokens: 1500,
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
        featureName: 'cv_adaptation_education',
        model,
        promptTokens,
        completionTokens,
        cachedTokens,
        duration,
      });
    }

    // Sanitize output for PostgreSQL (remove \u0000 characters)
    const sanitizedResult = sanitizeForPostgres(result);

    await prisma.cvGenerationSubtask.update({
      where: { id: subtask.id },
      data: {
        status: 'completed',
        output: sanitizedResult,
        modifications: sanitizedResult.education_modifications,
        modelUsed: model,
        promptTokens,
        cachedTokens,
        completionTokens,
        estimatedCost,
        durationMs: duration,
        completedAt: new Date(),
      },
    });

    // Log des modifications
    const mods = result.education_modifications || [];
    const modifiedCount = mods.filter(m => m.action === 'modified').length;
    console.log(`[batch-education] Completed in ${duration}ms:`, {
      total: education.length,
      modifications: mods.length,
      modified: modifiedCount,
    });

    return {
      success: true,
      adaptedEducation: sanitizedResult.education,
      education_modifications: sanitizedResult.education_modifications,
      subtaskId: subtask.id,
      tokens: { prompt: promptTokens, completion: completionTokens, cached: cachedTokens },
      estimatedCost,
      duration,
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

    console.error(`[batch-education] Failed after ${duration}ms:`, error.message);

    return {
      success: false,
      error: error.message,
      adaptedEducation: education, // Retourner les formations originales en cas d'échec
      education_modifications: [],
      subtaskId: subtask.id,
      duration,
    };
  }
}
