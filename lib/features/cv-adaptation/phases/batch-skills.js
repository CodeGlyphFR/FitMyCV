/**
 * Phase Batch Skills - Pipeline CV v2
 *
 * Adapte les skills du CV source en les matchant avec les skills de l'offre d'emploi.
 * Ce batch est un "passeur" qui:
 * 1. Prépare les données d'entrée (skills CV, skills offre, langues)
 * 2. Appelle OpenAI pour le matching et la décision
 * 3. Retourne la réponse brute pour post-traitement
 *
 * Le post-traitement (validation, review data, transformation) est délégué à
 * parseSkillsResponse.js qui est appelé par offerProcessor.js.
 *
 * Utilise le setting `model_cv_batch_skills` pour le modèle IA.
 * Crée une CvGenerationSubtask de type `batch_skills`.
 *
 * PARALLELISATION: Ce batch s'exécute EN PARALLELE avec experiences,
 * projects, extras, education et languages car il n'a pas besoin du
 * contexte des sections adaptées.
 */

import { promises as fs } from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { getOpenAIClient } from '@/lib/openai-core/client';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage, calculateCost } from '@/lib/telemetry/openai';
import { sanitizeForPostgres } from '../utils/sanitize.js';

const PROMPTS_DIR = path.join(process.cwd(), 'lib/features/cv-adaptation/prompts');
const SCHEMAS_DIR = path.join(process.cwd(), 'lib/features/cv-adaptation/schemas');

/**
 * Mapping des codes ISO de langue vers leurs noms complets
 * Utilisé pour renforcer l'instruction de langue dans le prompt
 */
const LANGUAGE_NAMES = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
};

/**
 * Convertit un code ISO de langue en nom complet
 * @param {string} code - Code ISO (en, fr, de, etc.)
 * @returns {string} - Nom complet de la langue
 */
function getLanguageName(code) {
  return LANGUAGE_NAMES[code] || LANGUAGE_NAMES.en;
}

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
 * Formate un tableau JSON pour le prompt (retourne "[]" si vide)
 * @param {Array} arr - Tableau à formater
 * @returns {string} - JSON stringifié
 */
function formatJsonArray(arr) {
  if (!arr || arr.length === 0) {
    return '[]';
  }
  return JSON.stringify(arr);
}

/**
 * Extrait les skills de l'offre par catégorie avec required/nice_to_have séparés
 * Note: jobOffer de Prisma a la structure { content: { title, skills, ... } }
 *
 * Format skills v2 (4 catégories):
 * - hard_skills: { required: [], nice_to_have: [] }
 * - tools: { required: [], nice_to_have: [] }
 * - methodologies: { required: [], nice_to_have: [] }
 * - soft_skills: [] (pas de required/nice_to_have)
 */
function extractJobOfferSkills(jobOffer) {
  // Supporter les deux formats: objet direct OU objet Prisma avec .content
  const content = jobOffer.content || jobOffer;
  const skills = content.skills || {};

  return {
    // Hard skills par priorité
    hardSkillsRequired: skills.hard_skills?.required || [],
    hardSkillsNiceToHave: skills.hard_skills?.nice_to_have || [],
    // Tools par priorité
    toolsRequired: skills.tools?.required || [],
    toolsNiceToHave: skills.tools?.nice_to_have || [],
    // Methodologies par priorité
    methodologiesRequired: skills.methodologies?.required || [],
    methodologiesNiceToHave: skills.methodologies?.nice_to_have || [],
    // Soft skills (pas de priorisation)
    softSkillsJob: skills.soft_skills || [],
  };
}

/**
 * Execute le batch d'adaptation des skills
 *
 * Ce batch s'exécute en parallèle avec les autres batches (experiences, projects, etc.)
 * car il n'a pas besoin du contexte des sections adaptées. Il utilise uniquement:
 * - Les skills du CV source (4 catégories)
 * - Les skills de l'offre d'emploi
 * - Les informations de langue
 *
 * @param {Object} params
 * @param {string} params.offerId - ID de la CvGenerationOffer
 * @param {Object} params.skills - Skills source du CV {hard_skills, soft_skills, tools, methodologies}
 * @param {Object} params.jobOffer - Offre d'emploi
 * @param {string} params.cvLanguage - Langue du CV source
 * @param {string} params.jobLanguage - Langue de l'offre d'emploi
 * @param {string} params.interfaceLanguage - Langue de l'interface utilisateur (pour les reasons)
 * @param {string} params.userId - ID utilisateur
 * @param {AbortSignal} params.signal - Signal d'annulation
 * @returns {Promise<Object>}
 */
export async function executeBatchSkills({
  offerId,
  skills = {},
  jobOffer,
  // Nouvelles signatures de paramètres
  cvLanguage,
  jobLanguage,
  interfaceLanguage,
  // Anciennes signatures (rétrocompatibilité)
  sourceLanguage,
  targetLanguage,
  userInterfaceLanguage,
  userId,
  signal = null,
}) {
  // Rétrocompatibilité avec l'ancienne signature
  const effectiveCvLanguage = cvLanguage || sourceLanguage || 'francais';
  const effectiveJobLanguage = jobLanguage || targetLanguage || 'francais';
  const effectiveInterfaceLanguage = interfaceLanguage || userInterfaceLanguage || 'fr';

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
    // Créer la subtask
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

    const systemPrompt = systemPromptInstructions;

    // Extraire les skills de l'offre par catégorie
    const jobOfferSkills = extractJobOfferSkills(jobOffer);

    // Construire le user prompt avec les variables
    const userPrompt = replaceVariables(userPromptTemplate, {
      // Skills du CV source
      hardSkillsJson: JSON.stringify(hardSkills, null, 2),
      softSkillsJson: JSON.stringify(softSkills, null, 2),
      toolsJson: JSON.stringify(tools, null, 2),
      methodologiesJson: JSON.stringify(methodologies, null, 2),
      // Langues
      cvLanguage: effectiveCvLanguage,
      jobLanguage: effectiveJobLanguage,
      interfaceLanguage: getLanguageName(effectiveInterfaceLanguage),
      // Skills de l'offre par catégorie et priorité
      hardSkillsRequired: formatJsonArray(jobOfferSkills.hardSkillsRequired),
      hardSkillsNiceToHave: formatJsonArray(jobOfferSkills.hardSkillsNiceToHave),
      toolsRequired: formatJsonArray(jobOfferSkills.toolsRequired),
      toolsNiceToHave: formatJsonArray(jobOfferSkills.toolsNiceToHave),
      methodologiesRequired: formatJsonArray(jobOfferSkills.methodologiesRequired),
      methodologiesNiceToHave: formatJsonArray(jobOfferSkills.methodologiesNiceToHave),
      softSkillsJob: formatJsonArray(jobOfferSkills.softSkillsJob),
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
      temperature: 0.2, // Faible pour respecter les règles strictes
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

    const rawResult = JSON.parse(content);

    // Debug: afficher la réponse brute de l'IA
    console.log(`[batch-skills] AI response:`, JSON.stringify(rawResult, null, 2));

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
        featureName: 'cv_adaptation_skills',
        model,
        promptTokens,
        completionTokens,
        cachedTokens,
        duration,
      });
    }

    // Sanitize output for PostgreSQL (remove \u0000 characters)
    const sanitizedResult = sanitizeForPostgres(rawResult);

    // Log des stats par action
    const logStats = (items, category) => {
      const stats = { renamed: 0, kept: 0, deleted: 0 };
      for (const item of items || []) {
        if (stats[item.action] !== undefined) stats[item.action]++;
      }
      return { category, ...stats };
    };

    console.log(`[batch-skills] Completed in ${duration}ms:`, {
      hard_skills: logStats(sanitizedResult.hard_skills, 'hard_skills'),
      soft_skills: logStats(sanitizedResult.soft_skills, 'soft_skills'),
      tools: logStats(sanitizedResult.tools, 'tools'),
      methodologies: logStats(sanitizedResult.methodologies, 'methodologies'),
    });

    if (!isTestMode) {
      await prisma.cvGenerationSubtask.update({
        where: { id: subtask.id },
        data: {
          status: 'completed',
          output: sanitizedResult,
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

    return {
      success: true,
      rawResult: sanitizedResult,
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
      subtaskId: subtask?.id || null,
      duration,
    };
  }
}
