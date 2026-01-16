/**
 * Orchestrateur Pipeline CV v2
 *
 * Orchestre les phases de generation avec retry automatique:
 * - Phase 0: Extraction (récupère l'offre d'emploi depuis l'URL)
 * - Phase 0.5: Classification (KEEP/REMOVE/MOVE_TO_PROJECTS)
 * - Phase 1: Batches (experiences, projects, extras en parallele, puis skills, puis summary)
 * - Phase 2: Recomposition (assemblage final + langues)
 *
 * Gestion des erreurs:
 * - Retry jusqu'a 3 fois avec backoff exponentiel (1s, 2s, 4s)
 * - Remboursement automatique apres 3 echecs
 * - Chaque offre est independante (echec d'une n'impacte pas les autres)
 */

import prisma from '@/lib/prisma';
import { grantCredits } from '@/lib/subscription/credits';
import { getCreditCostForFeature } from '@/lib/subscription/creditCost';
import { getNumericSettingValue } from '@/lib/settings/settingsUtils';
import dbEmitter from '@/lib/events/dbEmitter';
import { registerTaskTypeEnd } from '@/lib/backgroundTasks/jobQueue';
import { registerAbortController, clearRegisteredProcess } from '@/lib/backgroundTasks/processRegistry';
import {
  trackCvGenerationV2Started,
  trackCvGenerationV2Completed,
  trackCvGenerationV2Failed,
} from '@/lib/telemetry/server';
import { hasConsentForCategory } from '@/lib/cookies/consentLogger';

import { executeExtraction, getJobOfferById } from './phases/extract.js';
import {
  executeClassification,
  applyClassification,
} from './phases/classify.js';
import { executeBatchExperiences } from './phases/batch-experiences.js';
import { executeBatchProjects } from './phases/batch-projects.js';
import { executeBatchExtras } from './phases/batch-extras.js';
import { executeBatchSkills } from './phases/batch-skills.js';
import { executeBatchSummary } from './phases/batch-summary.js';
import { executeRecomposition } from './phases/recompose.js';
import { detectJobOfferLanguage } from './utils/language.js';

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000; // 1s, 2s, 4s

/**
 * Émet un événement SSE de progression pour une offre
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {Object} context - Contexte de la progression
 * @param {string} context.taskId - ID de la tâche
 * @param {string} context.offerId - ID de l'offre
 * @param {number} context.offerIndex - Index de l'offre (0-based)
 * @param {number} context.totalOffers - Nombre total d'offres
 * @param {string} context.sourceUrl - URL source de l'offre (optionnel)
 * @param {string} context.jobTitle - Titre de l'offre extraite (optionnel)
 * @param {string} phase - Phase en cours (extraction, classify, batches, recompose)
 * @param {string} step - Étape en cours (extraction, classify, experiences, projects, extras, skills, summary, recompose)
 * @param {string} status - Statut (running, completed)
 * @param {Object} [extra] - Données supplémentaires (currentItem, totalItems)
 */
function emitProgress(userId, context, phase, step, status, extra = {}) {
  dbEmitter.emitCvGenerationProgress(userId, {
    taskId: context.taskId,
    offerId: context.offerId,
    offerIndex: context.offerIndex,
    totalOffers: context.totalOffers,
    sourceUrl: context.sourceUrl || null,
    jobTitle: context.jobTitle || null,
    phase,
    step,
    status,
    // Champs enrichis pour la granularité
    currentItem: extra.currentItem ?? null,
    totalItems: extra.totalItems ?? null,
  });
}

/**
 * Attend avec backoff exponentiel
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calcule le delai de backoff
 */
function getBackoffDelay(retryCount) {
  return BACKOFF_BASE_MS * Math.pow(2, retryCount);
}

/**
 * Execute une fonction avec retry et backoff exponentiel
 *
 * @param {Function} fn - Fonction à exécuter (reçoit le numéro de tentative)
 * @param {number} maxRetries - Nombre max de retries
 * @param {string} context - Contexte pour les logs
 * @param {Function} [onRetry] - Callback optionnel avant chaque retry (reçoit attempt)
 */
async function withRetry(fn, maxRetries = MAX_RETRIES, context = 'operation', onRetry = null) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = getBackoffDelay(attempt);
        console.log(`[orchestrator] ${context} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);

        // Appeler le callback de retry si fourni
        if (onRetry) {
          await onRetry(attempt + 1);
        }

        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Rembourse le credit pour une offre echouee
 */
async function refundCreditForOffer(taskId, offerId, userId, reason = 'Generation failed after max retries') {
  try {
    // Verifier que l'offre n'a pas deja ete remboursee
    const offer = await prisma.cvGenerationOffer.findUnique({
      where: { id: offerId },
      select: { creditsRefunded: true },
    });

    if (offer?.creditsRefunded) {
      console.log(`[refund] Offer ${offerId} already refunded, skipping`);
      return { success: true, amount: 0, alreadyRefunded: true };
    }

    // Recuperer le vrai cout en credits depuis les settings
    const { cost: creditCost } = await getCreditCostForFeature('gpt_cv_generation');

    console.log(`[refund] Offer ${offerId}: creditCost=${creditCost} (from settings)`);

    if (creditCost <= 0) {
      console.log(`[refund] No credits to refund for offer ${offerId} (creditCost=${creditCost})`);
      return { success: true, amount: 0 };
    }

    // Utiliser grantCredits avec type 'refund' pour le remboursement
    const result = await grantCredits(userId, creditCost, 'refund', {
      source: 'cv_generation_v2_failure',
      taskId,
      offerId,
      reason,
    });

    if (result.success) {
      // Mettre a jour les compteurs
      await prisma.$transaction([
        prisma.cvGenerationOffer.update({
          where: { id: offerId },
          data: { creditsRefunded: true },
        }),
        prisma.cvGenerationTask.update({
          where: { id: taskId },
          data: { creditsRefunded: { increment: creditCost } },
        }),
      ]);

      console.log(`[refund] Refunded ${creditCost} credit(s) for offer ${offerId}`);
    }

    return { success: result.success, amount: creditCost };
  } catch (error) {
    console.error(`[orchestrator] Refund failed for offer ${offerId}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Execute la Phase 0: Extraction de l'offre d'emploi
 */
async function runExtractionPhase(offer, userId, signal, progressContext) {
  console.log(`[orchestrator] Phase 0: Extraction for offer ${offer.id} from ${offer.sourceUrl}`);

  // Émettre progression: extraction en cours
  emitProgress(userId, progressContext, 'extraction', 'extraction', 'running');

  // Mettre à jour le status de l'offre
  await prisma.cvGenerationOffer.update({
    where: { id: offer.id },
    data: { status: 'extracting' },
  });

  const result = await withRetry(
    async () => {
      return await executeExtraction({
        offerId: offer.id,
        sourceUrl: offer.sourceUrl,
        userId,
        signal,
      });
    },
    MAX_RETRIES,
    'Extraction',
    async (retryAttempt) => {
      // Incrémenter le retryCount des subtasks échouées avant le retry
      await prisma.cvGenerationSubtask.updateMany({
        where: { offerId: offer.id, type: 'extraction', status: 'failed' },
        data: { retryCount: retryAttempt },
      });
    }
  );

  if (!result.success) {
    throw new Error(result.error || 'Extraction failed');
  }

  // Émettre progression: extraction terminée
  emitProgress(userId, progressContext, 'extraction', 'extraction', 'completed');

  return result;
}

/**
 * Execute la Phase 0.5: Classification
 */
async function runClassificationPhase(offer, sourceCv, jobOffer, userId, signal, progressContext) {
  console.log(`[orchestrator] Phase 0.5: Classification for offer ${offer.id}`);

  // Émettre progression: classification en cours
  emitProgress(userId, progressContext, 'classify', 'classify', 'running');

  const result = await withRetry(
    async () => {
      return await executeClassification({
        offerId: offer.id,
        sourceCv,
        jobOffer,
        userId,
        signal,
      });
    },
    MAX_RETRIES,
    'Classification',
    async (retryAttempt) => {
      // Incrémenter le retryCount des subtasks échouées avant le retry
      await prisma.cvGenerationSubtask.updateMany({
        where: { offerId: offer.id, type: 'classify', status: 'failed' },
        data: { retryCount: retryAttempt },
      });
    }
  );

  if (!result.success) {
    throw new Error(result.error || 'Classification failed');
  }

  // Émettre progression: classification terminée
  emitProgress(userId, progressContext, 'classify', 'classify', 'completed');

  return result;
}

/**
 * Execute la Phase 1: Batches
 */
async function runBatchesPhase(offer, sourceCv, classificationResult, jobOffer, targetLanguage, userId, signal, progressContext) {
  console.log(`[orchestrator] Phase 1: Batches for offer ${offer.id}`);

  // Appliquer la classification
  const classified = applyClassification(sourceCv, classificationResult);

  // 1. Paralleliser experiences, projects, extras
  console.log(`[orchestrator] Running parallel batches: experiences, projects, extras`);

  // Émettre progression: batches parallèles en cours
  emitProgress(userId, progressContext, 'batches', 'experiences', 'running');
  emitProgress(userId, progressContext, 'batches', 'projects', 'running');
  emitProgress(userId, progressContext, 'batches', 'extras', 'running');

  const [experiencesResult, projectsResult, extrasResult] = await Promise.all([
    // Experiences
    withRetry(
      async () => {
        return await executeBatchExperiences({
          offerId: offer.id,
          experiences: classified.experiences,
          jobOffer,
          targetLanguage,
          userId,
          signal,
        });
      },
      MAX_RETRIES,
      'Batch Experiences',
      async (retryAttempt) => {
        await prisma.cvGenerationSubtask.updateMany({
          where: { offerId: offer.id, type: 'batch_experience', status: 'failed' },
          data: { retryCount: retryAttempt },
        });
      }
    ).then(result => {
      emitProgress(userId, progressContext, 'batches', 'experiences', 'completed');
      return result;
    }),

    // Projects (les MOVE_TO_PROJECTS sont déjà inclus dans classified.projects par applyClassification)
    withRetry(
      async () => {
        return await executeBatchProjects({
          offerId: offer.id,
          projects: classified.projects,
          movedExperiences: [], // Déjà inclus dans classified.projects, pas de duplication
          jobOffer,
          targetLanguage,
          userId,
          signal,
        });
      },
      MAX_RETRIES,
      'Batch Projects',
      async (retryAttempt) => {
        await prisma.cvGenerationSubtask.updateMany({
          where: { offerId: offer.id, type: 'batch_project', status: 'failed' },
          data: { retryCount: retryAttempt },
        });
      }
    ).then(result => {
      emitProgress(userId, progressContext, 'batches', 'projects', 'completed');
      return result;
    }),

    // Extras
    withRetry(
      async () => {
        return await executeBatchExtras({
          offerId: offer.id,
          extras: sourceCv.extras || [],
          jobOffer,
          targetLanguage,
          userId,
          signal,
        });
      },
      MAX_RETRIES,
      'Batch Extras',
      async (retryAttempt) => {
        await prisma.cvGenerationSubtask.updateMany({
          where: { offerId: offer.id, type: 'batch_extras', status: 'failed' },
          data: { retryCount: retryAttempt },
        });
      }
    ).then(result => {
      emitProgress(userId, progressContext, 'batches', 'extras', 'completed');
      return result;
    }),
  ]);

  // Verifier les resultats des batches paralleles
  if (!experiencesResult.success) {
    throw new Error(`Batch Experiences failed: ${experiencesResult.error}`);
  }
  if (!projectsResult.success) {
    throw new Error(`Batch Projects failed: ${projectsResult.error}`);
  }
  if (!extrasResult.success) {
    throw new Error(`Batch Extras failed: ${extrasResult.error}`);
  }

  // 2. Skills et Summary en parallele (meme Cache B: Job Offer + Experiences + Projects)
  console.log(`[orchestrator] Running parallel batches: skills, summary`);

  // Émettre progression: skills et summary en cours
  emitProgress(userId, progressContext, 'batches', 'skills', 'running');
  emitProgress(userId, progressContext, 'batches', 'summary', 'running');

  const [skillsResult, summaryResult] = await Promise.all([
    // Skills
    withRetry(
      async () => {
        return await executeBatchSkills({
          offerId: offer.id,
          skills: sourceCv.skills || {},
          adaptedExperiences: experiencesResult.adaptedExperiences,
          adaptedProjects: projectsResult.adaptedProjects,
          jobOffer,
          targetLanguage,
          userId,
          signal,
        });
      },
      MAX_RETRIES,
      'Batch Skills',
      async (retryAttempt) => {
        await prisma.cvGenerationSubtask.updateMany({
          where: { offerId: offer.id, type: 'batch_skills', status: 'failed' },
          data: { retryCount: retryAttempt },
        });
      }
    ).then(result => {
      emitProgress(userId, progressContext, 'batches', 'skills', 'completed');
      return result;
    }),

    // Summary (ne depend plus de skills, utilise Cache B)
    withRetry(
      async () => {
        return await executeBatchSummary({
          offerId: offer.id,
          currentSummary: sourceCv.summary,
          adaptedExperiences: experiencesResult.adaptedExperiences,
          adaptedProjects: projectsResult.adaptedProjects,
          adaptedSkills: {}, // Summary n'utilise plus les skills adaptes
          adaptedExtras: extrasResult.adaptedExtras,
          jobOffer,
          targetLanguage,
          userId,
          signal,
        });
      },
      MAX_RETRIES,
      'Batch Summary',
      async (retryAttempt) => {
        await prisma.cvGenerationSubtask.updateMany({
          where: { offerId: offer.id, type: 'batch_summary', status: 'failed' },
          data: { retryCount: retryAttempt },
        });
      }
    ).then(result => {
      emitProgress(userId, progressContext, 'batches', 'summary', 'completed');
      return result;
    }),
  ]);

  // Verifier les resultats
  if (!skillsResult.success) {
    throw new Error(`Batch Skills failed: ${skillsResult.error}`);
  }
  if (!summaryResult.success) {
    throw new Error(`Batch Summary failed: ${summaryResult.error}`);
  }

  return {
    experiences: experiencesResult.adaptedExperiences,
    projects: projectsResult.adaptedProjects,
    extras: extrasResult.adaptedExtras,
    skills: skillsResult.adaptedSkills,
    // Attacher les modifications directement au summary pour cohérence avec les autres sections
    summary: {
      ...summaryResult.adaptedSummary,
      modifications: summaryResult.modifications || [],
    },
    // Garder aussi les références séparées pour rétrocompatibilité
    experienceModifications: experiencesResult.modifications || {},
    summaryModifications: summaryResult.modifications || {},
  };
}

/**
 * Execute la Phase 2: Recomposition
 */
async function runRecomposePhase(offer, sourceCv, sourceCvFileName, batchResults, jobOffer, jobOfferId, targetLanguage, userId, signal, progressContext) {
  console.log(`[orchestrator] Phase 2: Recomposition for offer ${offer.id}`);

  // Émettre progression: recomposition en cours
  emitProgress(userId, progressContext, 'recompose', 'recompose', 'running');

  const result = await withRetry(
    async () => {
      return await executeRecomposition({
        offerId: offer.id,
        sourceCv,
        sourceCvFileName,
        batchResults,
        jobOffer,
        jobOfferId,
        targetLanguage,
        userId,
        signal,
      });
    },
    MAX_RETRIES,
    'Recomposition',
    async (retryAttempt) => {
      await prisma.cvGenerationSubtask.updateMany({
        where: { offerId: offer.id, type: 'recompose', status: 'failed' },
        data: { retryCount: retryAttempt },
      });
    }
  );

  if (!result.success) {
    throw new Error(result.error || 'Recomposition failed');
  }

  // Émettre progression: recomposition terminée
  emitProgress(userId, progressContext, 'recompose', 'recompose', 'completed');

  return result;
}

/**
 * Traite une offre complete (toutes les phases)
 */
async function processOffer(offer, sourceCv, sourceCvFileName, jobOffer, jobOfferId, targetLanguage, userId, signal, progressContext, hasAnalyticsConsent = false) {
  const startTime = Date.now();

  try {
    // Mettre a jour le status de l'offre
    await prisma.cvGenerationOffer.update({
      where: { id: offer.id },
      data: { status: 'running', startedAt: new Date() },
    });

    // Phase 0.5: Classification
    const classificationResult = await runClassificationPhase(offer, sourceCv, jobOffer, userId, signal, progressContext);

    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    // Phase 1: Batches
    const batchResults = await runBatchesPhase(
      offer,
      sourceCv,
      classificationResult.classification,
      jobOffer,
      targetLanguage,
      userId,
      signal,
      progressContext
    );

    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    // Phase 2: Recomposition
    const recomposeResult = await runRecomposePhase(
      offer,
      sourceCv,
      sourceCvFileName,
      batchResults,
      jobOffer,
      jobOfferId,
      targetLanguage,
      userId,
      signal,
      progressContext
    );

    // Marquer l'offre comme terminee
    await prisma.cvGenerationOffer.update({
      where: { id: offer.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    const duration = Date.now() - startTime;
    console.log(`[orchestrator] Offer ${offer.id} completed in ${duration}ms`);

    // Émettre l'événement SSE pour l'offre terminée
    dbEmitter.emitCvGenerationOfferCompleted(userId, {
      taskId: offer.taskId,
      offerId: offer.id,
      offerIndex: offer.offerIndex,
      generatedCvFileId: recomposeResult.cvFileId,
      generatedCvFileName: recomposeResult.filename,
    });

    // Émettre l'événement cv:updated pour rafraîchir la liste des CVs
    dbEmitter.emitCvUpdate(recomposeResult.filename, userId, {
      action: 'created',
      cvFileId: recomposeResult.cvFileId,
      source: 'cv_generation_v2',
    });

    // Télémétrie: CV_GENERATION_V2_COMPLETED (Story 5.3)
    if (hasAnalyticsConsent) {
      await trackCvGenerationV2Completed({
        userId,
        taskId: offer.taskId,
        offerId: offer.id,
        durationMs: duration,
        phaseDurations: null, // TODO: Collecter les durées par phase si nécessaire
      });
    }

    return {
      success: true,
      offerId: offer.id,
      cvFileId: recomposeResult.cvFileId,
      filename: recomposeResult.filename,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const isCancelled = error.message === 'Task cancelled' || signal?.aborted;
    const finalStatus = isCancelled ? 'cancelled' : 'failed';

    console.error(`[orchestrator] Offer ${offer.id} ${finalStatus} after ${duration}ms:`, error.message);

    // Marquer l'offre comme échouée ou annulée
    await prisma.cvGenerationOffer.update({
      where: { id: offer.id },
      data: {
        status: finalStatus,
        error: error.message,
        completedAt: new Date(),
      },
    });

    // Télémétrie: CV_GENERATION_V2_FAILED (Story 5.3)
    if (hasAnalyticsConsent) {
      // Déterminer la phase/step d'échec à partir du message d'erreur
      let failedPhase = 'unknown';
      let failedStep = null;
      if (error.message.includes('Classification')) {
        failedPhase = 'classify';
        failedStep = 'classify';
      } else if (error.message.includes('Batch Experiences')) {
        failedPhase = 'batches';
        failedStep = 'experiences';
      } else if (error.message.includes('Batch Projects')) {
        failedPhase = 'batches';
        failedStep = 'projects';
      } else if (error.message.includes('Batch Extras')) {
        failedPhase = 'batches';
        failedStep = 'extras';
      } else if (error.message.includes('Batch Skills')) {
        failedPhase = 'batches';
        failedStep = 'skills';
      } else if (error.message.includes('Batch Summary')) {
        failedPhase = 'batches';
        failedStep = 'summary';
      } else if (error.message.includes('Recomposition')) {
        failedPhase = 'recompose';
        failedStep = 'recompose';
      }

      await trackCvGenerationV2Failed({
        userId,
        taskId: offer.taskId,
        offerId: offer.id,
        failedPhase,
        failedStep,
        error: error.message,
        retryCount: MAX_RETRIES,
      });
    }

    // Note: l'événement offer_failed sera émis après le remboursement dans startCvGenerationV2

    return {
      success: false,
      offerId: offer.id,
      error: error.message,
      cancelled: isCancelled,
      duration,
    };
  }
}

/**
 * Demarre la generation CV v2 pour une tache
 *
 * @param {string} taskId - ID de la CvGenerationTask
 * @returns {Promise<Object>}
 */
export async function startCvGenerationV2(taskId) {
  const startTime = Date.now();

  // Creer un AbortController pour pouvoir annuler la tache et tous ses calls OpenAI
  const abortController = new AbortController();
  const signal = abortController.signal;
  registerAbortController(taskId, abortController);

  console.log(`[orchestrator] Starting CV generation v2 for task ${taskId}`);

  // Recuperer la tache avec toutes les infos necessaires
  const task = await prisma.cvGenerationTask.findUnique({
    where: { id: taskId },
    include: {
      offers: {
        include: {
          // Note: jobOffer n'est pas une relation directe, on le recuperera separement
        },
        orderBy: { offerIndex: 'asc' },
      },
    },
  });

  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  if (task.status !== 'pending') {
    // Libérer le slot et l'AbortController même si la tâche n'est pas en pending
    clearRegisteredProcess(taskId);
    registerTaskTypeEnd(task.userId, 'cv_generation');
    throw new Error(`Task is not pending: ${task.status}`);
  }

  // À partir d'ici, on a le userId et on doit garantir la libération du slot
  try {
    // Mettre a jour le status de la tache
    await prisma.cvGenerationTask.update({
      where: { id: taskId },
      data: { status: 'running', startedAt: new Date() },
    });

    // Synchroniser le BackgroundTask pour TaskQueueModal
    await prisma.backgroundTask.update({
      where: { id: taskId },
      data: { status: 'running' },
    }).catch(() => {}); // Ignorer si BackgroundTask n'existe pas

    // Télémétrie: CV_GENERATION_V2_STARTED (Story 5.3)
    const hasAnalyticsConsent = await hasConsentForCategory(task.userId, 'analytics');
    if (hasAnalyticsConsent) {
      await trackCvGenerationV2Started({
        userId: task.userId,
        taskId,
        totalOffers: task.totalOffers,
        mode: task.mode || 'adapt',
      });
    }

    // Recuperer le CV source
    const sourceCvFile = await prisma.cvFile.findUnique({
      where: { id: task.sourceCvFileId },
      select: { content: true, filename: true, language: true },
    });

    if (!sourceCvFile || !sourceCvFile.content) {
      throw new Error('Source CV not found or has no content');
    }

  const sourceCv = sourceCvFile.content;
  const sourceCvFileName = sourceCvFile.filename;

  const results = {
    completed: [],
    failed: [],
  };

  // Traiter chaque offre sequentiellement (pour optimiser le cache OpenAI)
  for (const offer of task.offers) {
    if (signal?.aborted) {
      console.log(`[orchestrator] Task ${taskId} cancelled`);
      break;
    }

    // Créer le contexte de progression pour cette offre
    const progressContext = {
      taskId,
      offerId: offer.id,
      offerIndex: offer.offerIndex,
      totalOffers: task.totalOffers,
      sourceUrl: offer.sourceUrl || null,
      jobTitle: null, // Sera mis à jour après extraction
    };

    // Phase 0: Extraction de l'offre d'emploi (si pas encore extraite)
    let jobOffer = null;
    let jobOfferId = offer.jobOfferId;

    if (!jobOfferId && offer.sourceUrl) {
      // L'offre n'a pas encore été extraite - lancer la phase d'extraction
      try {
        const extractionResult = await runExtractionPhase(offer, task.userId, signal, progressContext);
        jobOfferId = extractionResult.jobOfferId;
        jobOffer = extractionResult.jobOffer;

        // Mettre à jour le contexte avec le titre extrait
        progressContext.jobTitle = extractionResult.title || null;

        console.log(`[orchestrator] Extraction completed for offer ${offer.id}: ${extractionResult.title}`);
      } catch (error) {
        console.error(`[orchestrator] Extraction failed for offer ${offer.id}:`, error.message);

        // Marquer l'offre comme échouée
        await prisma.cvGenerationOffer.update({
          where: { id: offer.id },
          data: {
            status: 'failed',
            error: `Extraction failed: ${error.message}`,
            completedAt: new Date(),
          },
        });

        results.failed.push({
          offerId: offer.id,
          error: `Extraction failed: ${error.message}`,
        });

        // Rembourser le crédit
        const refundResult = await refundCreditForOffer(taskId, offer.id, task.userId, `Extraction failed: ${error.message}`);
        await prisma.cvGenerationTask.update({
          where: { id: taskId },
          data: { completedOffers: { increment: 1 } },
        });

        // Émettre l'événement SSE pour l'offre échouée
        dbEmitter.emitCvGenerationOfferFailed(task.userId, {
          taskId,
          offerId: offer.id,
          offerIndex: offer.offerIndex,
          error: `Extraction failed: ${error.message}`,
          creditsRefunded: refundResult.success ? refundResult.amount : 0,
        });

        continue;
      }
    }

    // Récupérer l'offre d'emploi depuis la DB si pas déjà chargée
    if (!jobOffer && jobOfferId) {
      const jobOfferRecord = await prisma.jobOffer.findUnique({
        where: { id: jobOfferId },
      });
      jobOffer = jobOfferRecord?.content;
    }

    if (!jobOffer) {
      console.error(`[orchestrator] Job offer not found: ${jobOfferId}`);

      // Marquer l'offre comme echouee
      await prisma.cvGenerationOffer.update({
        where: { id: offer.id },
        data: {
          status: 'failed',
          error: 'Job offer not found',
          completedAt: new Date(),
        },
      });

      results.failed.push({
        offerId: offer.id,
        error: 'Job offer not found',
      });

      // Rembourser le credit et incrementer le compteur
      const refundResult = await refundCreditForOffer(taskId, offer.id, task.userId, 'Job offer not found');
      await prisma.cvGenerationTask.update({
        where: { id: taskId },
        data: { completedOffers: { increment: 1 } },
      });

      // Émettre l'événement SSE pour l'offre échouée
      dbEmitter.emitCvGenerationOfferFailed(task.userId, {
        taskId,
        offerId: offer.id,
        offerIndex: offer.offerIndex,
        error: 'Job offer not found',
        creditsRefunded: refundResult.success ? refundResult.amount : 0,
      });

      continue;
    }

    // Detecter la langue cible depuis l'offre d'emploi (avec fallback sur CV source)
    const languageInfo = await detectJobOfferLanguage({ content: jobOffer }, sourceCvFile.language);
    const targetLanguage = languageInfo.name;

    console.log(`[orchestrator] Target language for offer ${offer.id}: ${targetLanguage} (source: ${languageInfo.source})`);

    // Traiter l'offre (phases 0.5 à 2)
    const offerResult = await processOffer(
      offer,
      sourceCv,
      sourceCvFileName,
      jobOffer,
      jobOfferId,
      targetLanguage,
      task.userId,
      signal,
      progressContext,
      hasAnalyticsConsent
    );

    if (offerResult.success) {
      results.completed.push(offerResult);
    } else {
      results.failed.push(offerResult);

      // Rembourser le credit pour l'offre echouee
      const refundResult = await refundCreditForOffer(taskId, offer.id, task.userId, offerResult.error);

      // Émettre l'événement SSE pour l'offre échouée
      dbEmitter.emitCvGenerationOfferFailed(task.userId, {
        taskId,
        offerId: offer.id,
        offerIndex: offer.offerIndex,
        error: offerResult.error,
        creditsRefunded: refundResult.success ? refundResult.amount : 0,
      });
    }

    // Incrementer le compteur d'offres traitees (succes OU echec)
    // Permet de calculer la progression: completedOffers / totalOffers
    await prisma.cvGenerationTask.update({
      where: { id: taskId },
      data: { completedOffers: { increment: 1 } },
    });
  }

  // Gerer l'annulation: marquer les offres non traitees comme 'cancelled' et rembourser
  if (signal?.aborted) {
    console.log(`[orchestrator] Task ${taskId} was cancelled, cleaning up pending offers...`);

    // Trouver les offres encore pending ou running
    const pendingOffers = await prisma.cvGenerationOffer.findMany({
      where: {
        taskId,
        status: { in: ['pending', 'running'] },
      },
    });

    // Marquer chaque offre comme cancelled et rembourser
    for (const offer of pendingOffers) {
      await prisma.cvGenerationOffer.update({
        where: { id: offer.id },
        data: {
          status: 'cancelled',
          error: 'Task cancelled by user',
          completedAt: new Date(),
        },
      });

      // Rembourser le credit
      await refundCreditForOffer(taskId, offer.id, task.userId, 'Task cancelled by user');

      results.failed.push({
        offerId: offer.id,
        error: 'Task cancelled by user',
      });
    }

    console.log(`[orchestrator] Cancelled ${pendingOffers.length} pending offer(s) for task ${taskId}`);
  }

  // Determiner le status final de la tache
  const finalStatus = signal?.aborted
    ? 'cancelled'
    : results.completed.length > 0 ? 'completed' : 'failed';

  // Récupérer le total des crédits remboursés
  const taskAfterProcessing = await prisma.cvGenerationTask.findUnique({
    where: { id: taskId },
    select: { creditsRefunded: true },
  });

  await prisma.cvGenerationTask.update({
    where: { id: taskId },
    data: {
      status: finalStatus,
      completedAt: new Date(),
      error: results.failed.length > 0
        ? `${results.failed.length}/${task.totalOffers} offers failed`
        : null,
    },
  });

  // Synchroniser le BackgroundTask pour TaskQueueModal (sauf si déjà annulée par l'API)
  const bgTaskError = results.failed.length > 0
    ? `${results.failed.length}/${task.totalOffers} offre(s) échouée(s)`
    : null;
  const bgTaskResult = {
    totalGenerated: results.completed.length,
    totalFailed: results.failed.length,
    generatedCvs: results.completed.map(r => ({
      cvFileId: r.cvFileId,
      filename: r.filename,
    })),
  };

  // Vérifier si la tâche n'a pas déjà été annulée via l'API
  const currentBgTask = await prisma.backgroundTask.findUnique({
    where: { id: taskId },
    select: { status: true },
  }).catch(() => null);

  // Ne pas écraser si déjà 'cancelled' par l'API
  if (currentBgTask?.status !== 'cancelled') {
    await prisma.backgroundTask.update({
      where: { id: taskId },
      data: {
        status: finalStatus,
        error: bgTaskError,
        result: JSON.stringify(bgTaskResult),
        successMessage: results.completed.length > 0
          ? `${results.completed.length} CV généré(s) avec succès`
          : null,
      },
    }).catch(() => {});
  }

  const duration = Date.now() - startTime;

  console.log(`[orchestrator] Task ${taskId} finished in ${duration}ms:`, {
    status: finalStatus,
    completed: results.completed.length,
    failed: results.failed.length,
  });

  // Émettre l'événement SSE pour la tâche terminée
  dbEmitter.emitCvGenerationCompleted(task.userId, {
    taskId,
    totalGenerated: results.completed.length,
    totalFailed: results.failed.length,
    creditsRefunded: taskAfterProcessing?.creditsRefunded || 0,
  });

  return {
    success: finalStatus === 'completed',
    taskId,
    status: finalStatus,
    completed: results.completed,
    failed: results.failed,
    duration,
  };
} finally {
  // Libérer l'AbortController et le slot du type de tâche (succès ou erreur)
  clearRegisteredProcess(taskId);
  registerTaskTypeEnd(task.userId, 'cv_generation');
}
}

/**
 * Démarre la génération CV v2 pour UNE SEULE offre (mode parallèle)
 *
 * Cette fonction est utilisée quand chaque offre a sa propre BackgroundTask.
 * Elle traite une offre de manière indépendante des autres.
 *
 * @param {string} taskId - ID de la CvGenerationTask (1 par offre)
 * @param {string} offerId - ID de la CvGenerationOffer
 * @returns {Promise<Object>}
 */
export async function startSingleOfferGeneration(taskId, offerId) {
  const startTime = Date.now();

  // Créer un AbortController pour cette tâche
  const abortController = new AbortController();
  const signal = abortController.signal;
  registerAbortController(taskId, abortController);

  console.log(`[orchestrator] Starting single offer generation: taskId=${taskId}, offerId=${offerId}`);

  // Récupérer la tâche avec l'offre
  const task = await prisma.cvGenerationTask.findUnique({
    where: { id: taskId },
    include: {
      offers: {
        where: { id: offerId },
      },
    },
  });

  if (!task) {
    clearRegisteredProcess(taskId);
    throw new Error(`Task not found: ${taskId}`);
  }

  if (task.offers.length === 0) {
    clearRegisteredProcess(taskId);
    throw new Error(`Offer not found: ${offerId} for task ${taskId}`);
  }

  if (task.status !== 'pending') {
    clearRegisteredProcess(taskId);
    registerTaskTypeEnd(task.userId, 'cv_generation');
    throw new Error(`Task is not pending: ${task.status}`);
  }

  const offer = task.offers[0];
  const userId = task.userId;

  try {
    // Mettre à jour le status de la tâche
    await prisma.cvGenerationTask.update({
      where: { id: taskId },
      data: { status: 'running', startedAt: new Date() },
    });

    // Synchroniser le BackgroundTask
    await prisma.backgroundTask.update({
      where: { id: taskId },
      data: { status: 'running' },
    }).catch(() => {});

    // Télémétrie
    const hasAnalyticsConsent = await hasConsentForCategory(userId, 'analytics');
    if (hasAnalyticsConsent) {
      await trackCvGenerationV2Started({
        userId,
        taskId,
        totalOffers: 1,
        mode: task.mode || 'adapt',
      });
    }

    // Récupérer le CV source
    const sourceCvFile = await prisma.cvFile.findUnique({
      where: { id: task.sourceCvFileId },
      select: { content: true, filename: true, language: true },
    });

    if (!sourceCvFile || !sourceCvFile.content) {
      throw new Error('Source CV not found or has no content');
    }

    const sourceCv = sourceCvFile.content;
    const sourceCvFileName = sourceCvFile.filename;

    // Contexte de progression pour cette offre
    const progressContext = {
      taskId,
      offerId: offer.id,
      offerIndex: 0, // Toujours 0 pour une tâche unitaire
      totalOffers: 1,
      sourceUrl: offer.sourceUrl || null,
      jobTitle: null,
    };

    // Phase 0: Extraction de l'offre d'emploi (si pas encore extraite)
    let jobOffer = null;
    let jobOfferId = offer.jobOfferId;

    if (!jobOfferId && offer.sourceUrl) {
      try {
        const extractionResult = await runExtractionPhase(offer, userId, signal, progressContext);
        jobOfferId = extractionResult.jobOfferId;
        jobOffer = extractionResult.jobOffer;
        progressContext.jobTitle = extractionResult.title || null;

        console.log(`[orchestrator] Extraction completed for offer ${offer.id}: ${extractionResult.title}`);

        // Mettre à jour le titre de la BackgroundTask avec le titre de l'offre extraite
        if (extractionResult.title) {
          await prisma.backgroundTask.update({
            where: { id: taskId },
            data: { title: extractionResult.title },
          }).catch(() => {});
        }
      } catch (error) {
        console.error(`[orchestrator] Extraction failed for offer ${offer.id}:`, error.message);

        // Détecter si c'est une annulation
        const isCancelled = error.message === 'Task cancelled' || signal?.aborted;
        const finalStatus = isCancelled ? 'cancelled' : 'failed';
        const errorMessage = isCancelled ? 'Task cancelled' : `Extraction failed: ${error.message}`;

        // Vérifier si la BackgroundTask est déjà annulée (ne pas écraser)
        const currentBgTask = await prisma.backgroundTask.findUnique({
          where: { id: taskId },
          select: { status: true },
        }).catch(() => null);

        // Si déjà annulée, ne pas continuer (éviter d'écraser le statut)
        if (currentBgTask?.status === 'cancelled') {
          console.log(`[orchestrator] Task ${taskId} already cancelled, skipping status update`);
          return {
            success: false,
            taskId,
            offerId,
            error: 'Task cancelled',
            duration: Date.now() - startTime,
          };
        }

        // Marquer l'offre comme échouée/annulée
        await prisma.cvGenerationOffer.update({
          where: { id: offer.id },
          data: {
            status: finalStatus,
            error: errorMessage,
            completedAt: new Date(),
          },
        });

        // Rembourser le crédit
        const refundResult = await refundCreditForOffer(taskId, offer.id, userId, errorMessage);

        // Mettre à jour la tâche
        await prisma.cvGenerationTask.update({
          where: { id: taskId },
          data: {
            status: finalStatus,
            completedAt: new Date(),
            error: errorMessage,
          },
        });

        // Mettre à jour BackgroundTask
        await prisma.backgroundTask.update({
          where: { id: taskId },
          data: {
            status: finalStatus,
            error: errorMessage,
          },
        }).catch(() => {});

        // Émettre l'événement SSE
        dbEmitter.emitCvGenerationOfferFailed(userId, {
          taskId,
          offerId: offer.id,
          offerIndex: 0,
          error: errorMessage,
          creditsRefunded: refundResult.success ? refundResult.amount : 0,
        });

        dbEmitter.emitCvGenerationCompleted(userId, {
          taskId,
          totalGenerated: 0,
          totalFailed: isCancelled ? 0 : 1,
          creditsRefunded: refundResult.success ? refundResult.amount : 0,
        });

        return {
          success: false,
          taskId,
          offerId,
          error: errorMessage,
          duration: Date.now() - startTime,
        };
      }
    }

    // Récupérer l'offre d'emploi depuis la DB si pas déjà chargée
    if (!jobOffer && jobOfferId) {
      const jobOfferRecord = await prisma.jobOffer.findUnique({
        where: { id: jobOfferId },
      });
      jobOffer = jobOfferRecord?.content;
    }

    if (!jobOffer) {
      console.error(`[orchestrator] Job offer not found: ${jobOfferId}`);

      // Marquer l'offre comme échouée
      await prisma.cvGenerationOffer.update({
        where: { id: offer.id },
        data: {
          status: 'failed',
          error: 'Job offer not found',
          completedAt: new Date(),
        },
      });

      // Rembourser le crédit
      const refundResult = await refundCreditForOffer(taskId, offer.id, userId, 'Job offer not found');

      // Mettre à jour la tâche
      await prisma.cvGenerationTask.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: 'Job offer not found',
        },
      });

      // Mettre à jour BackgroundTask
      await prisma.backgroundTask.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          error: 'Job offer not found',
        },
      }).catch(() => {});

      // Émettre l'événement SSE
      dbEmitter.emitCvGenerationOfferFailed(userId, {
        taskId,
        offerId: offer.id,
        offerIndex: 0,
        error: 'Job offer not found',
        creditsRefunded: refundResult.success ? refundResult.amount : 0,
      });

      dbEmitter.emitCvGenerationCompleted(userId, {
        taskId,
        totalGenerated: 0,
        totalFailed: 1,
        creditsRefunded: refundResult.success ? refundResult.amount : 0,
      });

      return {
        success: false,
        taskId,
        offerId,
        error: 'Job offer not found',
        duration: Date.now() - startTime,
      };
    }

    // Détecter la langue cible depuis l'offre d'emploi
    const languageInfo = await detectJobOfferLanguage({ content: jobOffer }, sourceCvFile.language);
    const targetLanguage = languageInfo.name;

    console.log(`[orchestrator] Target language for offer ${offer.id}: ${targetLanguage} (source: ${languageInfo.source})`);

    // Traiter l'offre (phases 0.5 à 2)
    const offerResult = await processOffer(
      offer,
      sourceCv,
      sourceCvFileName,
      jobOffer,
      jobOfferId,
      targetLanguage,
      userId,
      signal,
      progressContext,
      hasAnalyticsConsent
    );

    // Déterminer le status final
    const finalStatus = signal?.aborted || offerResult.cancelled
      ? 'cancelled'
      : offerResult.success ? 'completed' : 'failed';

    // Mettre à jour la tâche
    await prisma.cvGenerationTask.update({
      where: { id: taskId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        completedOffers: 1,
        error: offerResult.success ? null : offerResult.error,
      },
    });

    // Mettre à jour BackgroundTask (sauf si déjà annulée par l'API)
    const bgTaskResult = offerResult.success ? {
      cvFileId: offerResult.cvFileId,
      filename: offerResult.filename,
    } : null;

    // Vérifier si la tâche n'a pas déjà été annulée via l'API
    const currentBgTask = await prisma.backgroundTask.findUnique({
      where: { id: taskId },
      select: { status: true },
    }).catch(() => null);

    // Ne pas écraser si déjà 'cancelled' par l'API
    if (currentBgTask?.status !== 'cancelled') {
      await prisma.backgroundTask.update({
        where: { id: taskId },
        data: {
          status: finalStatus,
          error: offerResult.success ? null : offerResult.error,
          result: bgTaskResult ? JSON.stringify(bgTaskResult) : null,
          successMessage: offerResult.success ? 'CV généré avec succès' : null,
        },
      }).catch(() => {});
    }

    // Si échec, rembourser le crédit
    let creditsRefunded = 0;
    if (!offerResult.success) {
      const refundResult = await refundCreditForOffer(taskId, offer.id, userId, offerResult.error);
      creditsRefunded = refundResult.success ? refundResult.amount : 0;

      dbEmitter.emitCvGenerationOfferFailed(userId, {
        taskId,
        offerId: offer.id,
        offerIndex: 0,
        error: offerResult.error,
        creditsRefunded,
      });
    }

    // Émettre l'événement SSE de completion globale
    dbEmitter.emitCvGenerationCompleted(userId, {
      taskId,
      totalGenerated: offerResult.success ? 1 : 0,
      totalFailed: offerResult.success ? 0 : 1,
      creditsRefunded,
    });

    const duration = Date.now() - startTime;

    console.log(`[orchestrator] Single offer task ${taskId} finished in ${duration}ms:`, {
      status: finalStatus,
      success: offerResult.success,
    });

    return {
      success: offerResult.success,
      taskId,
      offerId,
      status: finalStatus,
      cvFileId: offerResult.cvFileId,
      filename: offerResult.filename,
      duration,
    };

  } catch (error) {
    const isCancelled = error.message === 'Task cancelled' || signal?.aborted;
    const errorStatus = isCancelled ? 'cancelled' : 'failed';

    console.error(`[orchestrator] Single offer task ${taskId} ${errorStatus}:`, error.message);

    // Rembourser le crédit
    const refundResult = await refundCreditForOffer(taskId, offer.id, userId, error.message);

    // Mettre à jour la tâche
    await prisma.cvGenerationTask.update({
      where: { id: taskId },
      data: {
        status: errorStatus,
        completedAt: new Date(),
        error: error.message,
      },
    }).catch(() => {});

    // Vérifier si la tâche n'a pas déjà été annulée via l'API
    const currentBgTask = await prisma.backgroundTask.findUnique({
      where: { id: taskId },
      select: { status: true },
    }).catch(() => null);

    // Ne pas écraser si déjà 'cancelled' par l'API
    if (currentBgTask?.status !== 'cancelled') {
      await prisma.backgroundTask.update({
        where: { id: taskId },
        data: {
          status: errorStatus,
          error: error.message,
        },
      }).catch(() => {});
    }

    // Émettre les événements SSE
    dbEmitter.emitCvGenerationOfferFailed(userId, {
      taskId,
      offerId: offer.id,
      offerIndex: 0,
      error: error.message,
      creditsRefunded: refundResult.success ? refundResult.amount : 0,
    });

    dbEmitter.emitCvGenerationCompleted(userId, {
      taskId,
      totalGenerated: 0,
      totalFailed: 1,
      creditsRefunded: refundResult.success ? refundResult.amount : 0,
    });

    return {
      success: false,
      taskId,
      offerId,
      error: error.message,
      duration: Date.now() - startTime,
    };

  } finally {
    // Libérer l'AbortController et le slot du type de tâche
    clearRegisteredProcess(taskId);
    registerTaskTypeEnd(userId, 'cv_generation');
  }
}

/**
 * Exporte les fonctions utilitaires pour les tests
 */
export { withRetry, refundCreditForOffer };
