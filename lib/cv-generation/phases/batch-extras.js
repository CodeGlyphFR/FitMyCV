/**
 * Phase Batch Extras - Pipeline CV v2
 *
 * Adapte les extras du CV (benevolat, hobbies, disponibilite, remote, permis):
 * - Met en valeur les extras pertinents pour l'offre
 * - Conserve les extras non pertinents tels quels
 *
 * Utilise le setting `model_cv_batch_extras` pour le modele IA.
 * Cree une CvGenerationSubtask de type `batch_extras`.
 */

import { promises as fs } from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { getOpenAIClient } from '@/lib/openai/client';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage, calculateCost } from '@/lib/telemetry/openai';
import { generateCacheA, buildCachedSystemPrompt } from '../utils/cacheContext.js';
import { sanitizeForPostgres } from '../utils/sanitize.js';

const PROMPTS_DIR = path.join(process.cwd(), 'lib/cv-generation/prompts');
const SCHEMAS_DIR = path.join(process.cwd(), 'lib/cv-generation/schemas');

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
 * Extrait les informations pertinentes de l'offre pour les extras
 */
function extractJobOfferInfo(jobOffer) {
  const requirements = [];

  // Chercher mentions de permis, vehicule, disponibilite, remote
  const fullText = JSON.stringify(jobOffer).toLowerCase();

  if (fullText.includes('permis')) requirements.push('Permis mentionne');
  if (fullText.includes('vehicule') || fullText.includes('voiture')) requirements.push('Vehicule mentionne');
  if (fullText.includes('disponib')) requirements.push('Disponibilite mentionnee');
  if (fullText.includes('remote') || fullText.includes('teletravail') || fullText.includes('hybride')) {
    requirements.push('Remote/Teletravail mentionne');
  }

  // Extraire la description du poste
  const description = jobOffer.description || jobOffer.responsibilities?.join('. ') || '';

  return {
    jobTitle: jobOffer.title || 'Non specifie',
    requirements: requirements.length > 0 ? requirements.join(', ') : 'Aucun requirement specifique',
    jobDescription: description.slice(0, 500), // Limiter la taille
  };
}

/**
 * Execute le batch d'adaptation des extras
 *
 * @param {Object} params
 * @param {string} params.offerId - ID de la CvGenerationOffer
 * @param {Array} params.extras - Extras du CV source
 * @param {Object} params.jobOffer - Offre d'emploi
 * @param {string} params.targetLanguage - Langue cible
 * @param {string} params.userId - ID utilisateur
 * @param {AbortSignal} params.signal - Signal d'annulation
 * @returns {Promise<Object>}
 */
export async function executeBatchExtras({
  offerId,
  extras = [],
  jobOffer,
  targetLanguage = 'francais',
  userId,
  signal = null,
}) {
  const startTime = Date.now();

  // Si pas d'extras, retourner directement
  if (!extras || extras.length === 0) {
    console.log('[batch-extras] No extras to adapt');
    return {
      success: true,
      adaptedExtras: [],
      modifications: { highlighted: [], reasoning: 'Aucun extra a adapter' },
      duration: 0,
    };
  }

  console.log(`[batch-extras] Adapting ${extras.length} extra(s)...`);

  // Creer la subtask
  const subtask = await prisma.cvGenerationSubtask.create({
    data: {
      offerId,
      type: 'batch_extras',
      status: 'running',
      input: {
        extrasCount: extras.length,
        extrasNames: extras.map(e => e.name),
      },
      startedAt: new Date(),
    },
  });

  try {
    const model = await getAiModelSetting('model_cv_batch_extras');
    const systemPromptInstructions = await loadPrompt('batch-extras-system.md');
    const userPromptTemplate = await loadPrompt('batch-extras-user.md');
    const schema = await loadSchema('batchExtrasSchema.json');

    // Generer le Cache A (Job Offer) et construire le system prompt
    const cacheA = generateCacheA(jobOffer);
    const systemPrompt = buildCachedSystemPrompt(cacheA, systemPromptInstructions);

    // Job offer est dans le system prompt via cache
    const userPrompt = replaceVariables(userPromptTemplate, {
      extrasJson: JSON.stringify(extras, null, 2),
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
      max_completion_tokens: 800,
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
        featureName: 'cv_adaptation_extras',
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

    // Log des modifications (format array: [{field, action, before, after, reason}])
    const mods = result.modifications || [];
    const highlightedCount = mods.filter(m => m.action === 'highlighted').length;
    console.log(`[batch-extras] Completed in ${duration}ms:`, {
      total: extras.length,
      modifications: mods.length,
      highlighted: highlightedCount,
    });

    return {
      success: true,
      adaptedExtras: sanitizedResult.extras,
      modifications: sanitizedResult.modifications,
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

    console.error(`[batch-extras] Failed after ${duration}ms:`, error.message);

    return {
      success: false,
      error: error.message,
      adaptedExtras: extras, // Retourner les extras originaux en cas d'echec
      subtaskId: subtask.id,
      duration,
    };
  }
}
