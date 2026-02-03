/**
 * Phase Batch Skills - Pipeline CV v2 (Parallélisé avec optimisation cache)
 *
 * Adapte les skills du CV source en les matchant avec les skills de l'offre d'emploi.
 *
 * ARCHITECTURE PARALLÉLISÉE AVEC CACHE OPENAI:
 * 1. Prépare les 4 catégories (séparation des skills composés)
 * 2. Exécute METHODOLOGIES en premier (catégorie légère → établit le cache prompt)
 * 3. Exécute 3 appels IA EN PARALLÈLE (hard_skills, soft_skills, tools) qui bénéficient du cache
 * 4. L'IA retourne les correspondances (score, reason, adapted_name)
 * 5. Le CODE détermine les actions (renamed/kept/deleted) selon les scores
 * 6. Reconstruit le format final compatible avec batchSkillsSchema.json
 *
 * Utilise le setting `model_cv_batch_skills` pour le modèle IA.
 * Crée une CvGenerationSubtask de type `batch_skills`.
 *
 * PARALLELISATION: Ce batch s'exécute EN PARALLELE avec experiences,
 * projects, extras, education et languages car il n'a pas besoin du
 * contexte des sections adaptées.
 */

import prisma from '@/lib/prisma';
import { trackOpenAIUsage, calculateCost } from '@/lib/telemetry/openai';
import { sanitizeForPostgres } from '../utils/sanitize.js';
import { prepareAllCategories } from './skills/prepareSkillItems.js';
import { processCategoryBatch } from './skills/processCategoryBatch.js';
import { buildSkillsResult } from './skills/buildSkillsResult.js';

/**
 * Exécute des promises en parallèle avec un délai entre chaque lancement.
 * Permet au cache OpenAI de s'établir entre les requêtes.
 * @param {Array<() => Promise>} promiseFactories - Fonctions retournant des promises
 * @param {number} delayMs - Délai en ms entre chaque lancement (défaut: 500ms)
 * @returns {Promise<Array>} - Résultats dans l'ordre des factories
 */
async function staggeredParallel(promiseFactories, delayMs = 500) {
  const promises = [];
  for (let i = 0; i < promiseFactories.length; i++) {
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    promises.push(promiseFactories[i]());
  }
  return Promise.all(promises);
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
    hard_skills: {
      required: skills.hard_skills?.required || [],
      niceToHave: skills.hard_skills?.nice_to_have || [],
    },
    tools: {
      required: skills.tools?.required || [],
      niceToHave: skills.tools?.nice_to_have || [],
    },
    methodologies: {
      required: skills.methodologies?.required || [],
      niceToHave: skills.methodologies?.nice_to_have || [],
    },
    soft_skills: {
      required: skills.soft_skills || [],
      niceToHave: [], // soft_skills n'a pas de nice_to_have
    },
  };
}

/**
 * Execute le batch d'adaptation des skills (version parallélisée)
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
  const effectiveCvLanguage = cvLanguage || sourceLanguage || 'fr';
  const effectiveJobLanguage = jobLanguage || targetLanguage || 'fr';
  const effectiveInterfaceLanguage = interfaceLanguage || userInterfaceLanguage || 'fr';

  const startTime = Date.now();

  // Générer un timestamp unique pour cette génération (dossier de logs)
  const generationTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // Compter les skills source
  const skillCounts = {
    hard_skills: (skills.hard_skills || []).length,
    soft_skills: (skills.soft_skills || []).length,
    tools: (skills.tools || []).length,
    methodologies: (skills.methodologies || []).length,
  };

  // Mode test: skip DB si offerId est null
  const isTestMode = !offerId;
  let subtask = null;

  if (!isTestMode) {
    subtask = await prisma.cvGenerationSubtask.create({
      data: {
        offerId,
        type: 'batch_skills',
        status: 'running',
        input: {
          hardSkillsCount: skillCounts.hard_skills,
          softSkillsCount: skillCounts.soft_skills,
          toolsCount: skillCounts.tools,
          methodologiesCount: skillCounts.methodologies,
        },
        startedAt: new Date(),
      },
    });
  }

  try {
    // 1. Préparer les items (séparation des skills composés)
    const preparedCategories = prepareAllCategories(skills);

    // 2. Extraire les skills de l'offre par catégorie
    const jobOfferSkills = extractJobOfferSkills(jobOffer);

    // 3. Exécuter METHODOLOGIES en premier pour établir le cache OpenAI
    // Les méthodologies sont généralement la catégorie avec le moins d'items → plus rapide
    // Une fois le cache établi, les 3 autres catégories en bénéficieront
    const methodsResult = await processCategoryBatch({
      category: 'methodologies',
      preparedItems: preparedCategories.methodologies.preparedItems,
      hasProficiency: false,
      jobOfferSkills: jobOfferSkills.methodologies,
      cvLanguage: effectiveCvLanguage,
      jobLanguage: effectiveJobLanguage,
      interfaceLanguage: effectiveInterfaceLanguage,
      generationTimestamp,
      signal,
    });

    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    // 4. Exécuter les 3 autres catégories avec délai décalé (bénéficient du cache)
    // Le délai de 500ms entre chaque lancement permet au cache OpenAI de se propager
    const [hardResult, softResult, toolsResult] = await staggeredParallel([
      () => processCategoryBatch({
        category: 'hard_skills',
        preparedItems: preparedCategories.hard_skills.preparedItems,
        hasProficiency: true,
        jobOfferSkills: jobOfferSkills.hard_skills,
        cvLanguage: effectiveCvLanguage,
        jobLanguage: effectiveJobLanguage,
        interfaceLanguage: effectiveInterfaceLanguage,
        generationTimestamp,
        signal,
      }),
      () => processCategoryBatch({
        category: 'soft_skills',
        preparedItems: preparedCategories.soft_skills.preparedItems,
        hasProficiency: false,
        jobOfferSkills: jobOfferSkills.soft_skills,
        cvLanguage: effectiveCvLanguage,
        jobLanguage: effectiveJobLanguage,
        interfaceLanguage: effectiveInterfaceLanguage,
        generationTimestamp,
        signal,
      }),
      () => processCategoryBatch({
        category: 'tools',
        preparedItems: preparedCategories.tools.preparedItems,
        hasProficiency: true,
        jobOfferSkills: jobOfferSkills.tools,
        cvLanguage: effectiveCvLanguage,
        jobLanguage: effectiveJobLanguage,
        interfaceLanguage: effectiveInterfaceLanguage,
        generationTimestamp,
        signal,
      }),
    ], 500);

    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    // 5. Le CODE détermine les actions et reconstruit le format final
    const rawResult = buildSkillsResult({
      hardMatches: hardResult.matches,
      softMatches: softResult.matches,
      toolsMatches: toolsResult.matches,
      methodsMatches: methodsResult.matches,
      preparedCategories,
      sourceSkills: skills,
      interfaceLanguage: effectiveInterfaceLanguage,
    });

    const duration = Date.now() - startTime;

    // Agréger les tokens de tous les appels
    const totalTokens = {
      prompt: hardResult.tokens.prompt + softResult.tokens.prompt +
              toolsResult.tokens.prompt + methodsResult.tokens.prompt,
      completion: hardResult.tokens.completion + softResult.tokens.completion +
                  toolsResult.tokens.completion + methodsResult.tokens.completion,
      cached: (hardResult.tokens.cached || 0) + (softResult.tokens.cached || 0) +
              (toolsResult.tokens.cached || 0) + (methodsResult.tokens.cached || 0),
    };

    // Utiliser le modèle du premier résultat (ils utilisent tous le même)
    const model = hardResult.model || softResult.model || toolsResult.model || methodsResult.model;

    // Calculer le coût estimé
    const estimatedCost = model ? await calculateCost({
      model,
      promptTokens: totalTokens.prompt,
      completionTokens: totalTokens.completion,
      cachedTokens: totalTokens.cached,
    }) : 0;

    if (userId && model) {
      await trackOpenAIUsage({
        userId,
        featureName: 'cv_adaptation_skills',
        model,
        promptTokens: totalTokens.prompt,
        completionTokens: totalTokens.completion,
        cachedTokens: totalTokens.cached,
        duration,
      });
    }

    // Sanitize output for PostgreSQL (remove \u0000 characters)
    const sanitizedResult = sanitizeForPostgres(rawResult);

    if (!isTestMode) {
      await prisma.cvGenerationSubtask.update({
        where: { id: subtask.id },
        data: {
          status: 'completed',
          output: sanitizedResult,
          modelUsed: model,
          promptTokens: totalTokens.prompt,
          cachedTokens: totalTokens.cached,
          completionTokens: totalTokens.completion,
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
      tokens: { prompt: totalTokens.prompt, completion: totalTokens.completion },
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

    return {
      success: false,
      error: error.message,
      subtaskId: subtask?.id || null,
      duration,
    };
  }
}
