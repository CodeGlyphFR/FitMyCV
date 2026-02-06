/**
 * Task Runner for CV Adaptation Pipeline
 *
 * Manages the lifecycle of CV generation tasks:
 * - startSingleOfferGeneration: Single offer per task (parallel mode)
 * - startMultiOfferGeneration: Multiple offers per task (sequential mode)
 *
 * Handles:
 * - Task status updates
 * - AbortController registration
 * - Credit refunds on failure
 * - SSE event emission
 * - Telemetry tracking
 */

import prisma from '@/lib/prisma';
import dbEmitter from '@/lib/events/dbEmitter';
import { registerTaskTypeEnd } from '@/lib/background-jobs/jobQueue';
import { registerAbortController, clearRegisteredProcess } from '@/lib/background-jobs/processRegistry';
import { trackCvGenerationStarted } from '@/lib/telemetry/server';
import { hasConsentForCategory } from '@/lib/cookies/consentLogger';

import { detectJobOfferLanguage, getTargetLanguageName } from '../utils/language.js';

import { runExtractionPhase, processOffer } from './offerProcessor.js';
import { refundCreditForOffer } from './creditManager.js';

/**
 * Start CV generation for a SINGLE offer (parallel mode)
 *
 * This function is used when each offer has its own BackgroundTask.
 * It processes an offer independently from others.
 *
 * @param {string} taskId - ID of the CvGenerationTask (1 per offer)
 * @param {string} offerId - ID of the CvGenerationOffer
 * @returns {Promise<Object>}
 */
export async function startSingleOfferGeneration(taskId, offerId) {
  const startTime = Date.now();

  // Create an AbortController for this task
  const abortController = new AbortController();
  const signal = abortController.signal;
  registerAbortController(taskId, abortController);

  console.log(`[orchestrator] Starting single offer generation: taskId=${taskId}, offerId=${offerId}`);

  // Retrieve the task with the offer
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
    // Update task status
    await prisma.cvGenerationTask.update({
      where: { id: taskId },
      data: { status: 'running', startedAt: new Date() },
    });

    // Synchronize BackgroundTask
    await prisma.backgroundTask.update({
      where: { id: taskId },
      data: { status: 'running' },
    }).catch(() => {});

    // Telemetry
    const hasAnalyticsConsent = await hasConsentForCategory(userId, 'analytics');
    if (hasAnalyticsConsent) {
      await trackCvGenerationStarted({
        userId,
        taskId,
        totalOffers: 1,
        mode: task.mode || 'adapt',
      });
    }

    // Retrieve userInterfaceLanguage from BackgroundTask payload
    let userInterfaceLanguage = 'fr';
    try {
      const bgTask = await prisma.backgroundTask.findUnique({
        where: { id: taskId },
        select: { payload: true },
      });
      if (bgTask?.payload) {
        const payload = JSON.parse(bgTask.payload);
        userInterfaceLanguage = payload.userInterfaceLanguage || 'fr';
      }
    } catch {
      // Fallback to 'fr' if payload parsing fails
    }

    // Retrieve source CV
    const sourceCvFile = await prisma.cvFile.findUnique({
      where: { id: task.sourceCvFileId },
      select: { content: true, filename: true, language: true },
    });

    if (!sourceCvFile || !sourceCvFile.content) {
      throw new Error('Source CV not found or has no content');
    }

    const sourceCv = sourceCvFile.content;
    const sourceCvFileName = sourceCvFile.filename;

    // Progress context for this offer
    const progressContext = {
      taskId,
      offerId: offer.id,
      offerIndex: 0, // Always 0 for a single task
      totalOffers: 1,
      sourceUrl: offer.sourceUrl || null,
      jobTitle: null,
    };

    // Phase 0: Extraction of the job offer (if not yet extracted)
    let jobOffer = null;
    let jobOfferId = offer.jobOfferId;

    if (!jobOfferId && offer.sourceUrl) {
      try {
        const extractionResult = await runExtractionPhase(offer, userId, signal, progressContext);
        jobOfferId = extractionResult.jobOfferId;
        jobOffer = extractionResult.jobOffer;
        progressContext.jobTitle = extractionResult.title || null;

        console.log(`[orchestrator] Extraction completed for offer ${offer.id}: ${extractionResult.title}`);

        // Update BackgroundTask title with extracted job title
        if (extractionResult.title) {
          await prisma.backgroundTask.update({
            where: { id: taskId },
            data: { title: extractionResult.title },
          }).catch(() => {});
        }
      } catch (error) {
        console.error(`[orchestrator] Extraction failed for offer ${offer.id}:`, error.message);

        // Detect if this is a cancellation
        const isCancelled = error.message === 'Task cancelled' || signal?.aborted;
        const finalStatus = isCancelled ? 'cancelled' : 'failed';
        // Propager le message d'erreur tel quel pour permettre le parsing JSON des clés de traduction
        const errorMessage = isCancelled ? 'Task cancelled' : error.message;

        // Check if BackgroundTask is already cancelled (don't overwrite)
        const currentBgTask = await prisma.backgroundTask.findUnique({
          where: { id: taskId },
          select: { status: true },
        }).catch(() => null);

        // If already cancelled, don't continue (avoid overwriting status)
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

        // Mark offer as failed/cancelled
        await prisma.cvGenerationOffer.update({
          where: { id: offer.id },
          data: {
            status: finalStatus,
            error: errorMessage,
            completedAt: new Date(),
          },
        });

        // Refund credit
        const refundResult = await refundCreditForOffer(taskId, offer.id, userId, errorMessage);

        // Update task
        await prisma.cvGenerationTask.update({
          where: { id: taskId },
          data: {
            status: finalStatus,
            completedAt: new Date(),
            error: errorMessage,
          },
        });

        // Update BackgroundTask
        await prisma.backgroundTask.update({
          where: { id: taskId },
          data: {
            status: finalStatus,
            error: errorMessage,
          },
        }).catch(() => {});

        // Emit SSE events
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

    // Retrieve job offer from DB if not already loaded
    if (!jobOffer && jobOfferId) {
      const jobOfferRecord = await prisma.jobOffer.findUnique({
        where: { id: jobOfferId },
      });
      jobOffer = jobOfferRecord?.content;
    }

    if (!jobOffer) {
      console.error(`[orchestrator] Job offer not found: ${jobOfferId}`);

      // Mark offer as failed
      await prisma.cvGenerationOffer.update({
        where: { id: offer.id },
        data: {
          status: 'failed',
          error: 'Job offer not found',
          completedAt: new Date(),
        },
      });

      // Refund credit
      const refundResult = await refundCreditForOffer(taskId, offer.id, userId, 'Job offer not found');

      // Update task
      await prisma.cvGenerationTask.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: 'Job offer not found',
        },
      });

      // Update BackgroundTask
      await prisma.backgroundTask.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          error: 'Job offer not found',
        },
      }).catch(() => {});

      // Emit SSE events
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

    // Detect target language from job offer
    const languageInfo = await detectJobOfferLanguage({ content: jobOffer }, sourceCvFile.language, userId);
    const targetLanguage = languageInfo.name;
    // Source language from CV file (for translation comparison)
    const sourceLanguage = getTargetLanguageName(sourceCvFile.language || 'fr');

    console.log(`[orchestrator] Languages for offer ${offer.id}: source=${sourceLanguage}, target=${targetLanguage} (detection: ${languageInfo.source})`);

    // Process offer (phases 0.5 to 2)
    const offerResult = await processOffer(
      offer,
      sourceCv,
      sourceCvFileName,
      jobOffer,
      jobOfferId,
      sourceLanguage,
      targetLanguage,
      userInterfaceLanguage,
      userId,
      signal,
      progressContext,
      hasAnalyticsConsent
    );

    // Determine final status
    const finalStatus = signal?.aborted || offerResult.cancelled
      ? 'cancelled'
      : offerResult.success ? 'completed' : 'failed';

    // Update task
    await prisma.cvGenerationTask.update({
      where: { id: taskId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        completedOffers: 1,
        error: offerResult.success ? null : offerResult.error,
      },
    });

    // Update BackgroundTask (unless already cancelled by API)
    const bgTaskResult = offerResult.success ? {
      cvFileId: offerResult.cvFileId,
      filename: offerResult.filename,
    } : null;

    // Check if task hasn't been cancelled via API
    const currentBgTask = await prisma.backgroundTask.findUnique({
      where: { id: taskId },
      select: { status: true },
    }).catch(() => null);

    // Don't overwrite if already 'cancelled' by API
    if (currentBgTask?.status !== 'cancelled') {
      await prisma.backgroundTask.update({
        where: { id: taskId },
        data: {
          status: finalStatus,
          error: offerResult.success ? null : offerResult.error,
          result: bgTaskResult ? JSON.stringify(bgTaskResult) : null,
          successMessage: offerResult.success ? 'taskQueue.messages.pipelineCompleted' : null,
        },
      }).catch(() => {});
    }

    // If failed, refund credit
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

    // Emit global completion SSE event
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

    // Refund credit
    const refundResult = await refundCreditForOffer(taskId, offer.id, userId, error.message);

    // Update task
    await prisma.cvGenerationTask.update({
      where: { id: taskId },
      data: {
        status: errorStatus,
        completedAt: new Date(),
        error: error.message,
      },
    }).catch(() => {});

    // Check if task hasn't been cancelled via API
    const currentBgTask = await prisma.backgroundTask.findUnique({
      where: { id: taskId },
      select: { status: true },
    }).catch(() => null);

    // Don't overwrite if already 'cancelled' by API
    if (currentBgTask?.status !== 'cancelled') {
      await prisma.backgroundTask.update({
        where: { id: taskId },
        data: {
          status: errorStatus,
          error: error.message,
        },
      }).catch(() => {});
    }

    // Emit SSE events
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
    // Release AbortController and task type slot
    clearRegisteredProcess(taskId);
    registerTaskTypeEnd(userId, 'cv_generation');
  }
}

/**
 * Start CV generation for multiple offers (sequential mode)
 *
 * This function processes multiple offers sequentially within a single task.
 * Deprecated in favor of startSingleOfferGeneration for better parallelism.
 *
 * @param {string} taskId - ID of the CvGenerationTask
 * @returns {Promise<Object>}
 */
export async function startMultiOfferGeneration(taskId) {
  const startTime = Date.now();

  // Create an AbortController to be able to cancel the task and all its OpenAI calls
  const abortController = new AbortController();
  const signal = abortController.signal;
  registerAbortController(taskId, abortController);

  console.log(`[orchestrator] Starting CV generation v2 for task ${taskId}`);

  // Retrieve task with all necessary info
  const task = await prisma.cvGenerationTask.findUnique({
    where: { id: taskId },
    include: {
      offers: {
        orderBy: { offerIndex: 'asc' },
      },
    },
  });

  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  if (task.status !== 'pending') {
    // Release slot and AbortController even if task is not pending
    clearRegisteredProcess(taskId);
    registerTaskTypeEnd(task.userId, 'cv_generation');
    throw new Error(`Task is not pending: ${task.status}`);
  }

  // From here, we have userId and must guarantee slot release
  try {
    // Update task status
    await prisma.cvGenerationTask.update({
      where: { id: taskId },
      data: { status: 'running', startedAt: new Date() },
    });

    // Synchronize BackgroundTask for TaskQueueModal
    await prisma.backgroundTask.update({
      where: { id: taskId },
      data: { status: 'running' },
    }).catch(() => {}); // Ignore if BackgroundTask doesn't exist

    // Telemetry: CV_GENERATION_STARTED (Story 5.3)
    const hasAnalyticsConsent = await hasConsentForCategory(task.userId, 'analytics');
    if (hasAnalyticsConsent) {
      await trackCvGenerationStarted({
        userId: task.userId,
        taskId,
        totalOffers: task.totalOffers,
        mode: task.mode || 'adapt',
      });
    }

    // Retrieve userInterfaceLanguage from BackgroundTask payload
    let userInterfaceLanguage = 'fr';
    try {
      const bgTask = await prisma.backgroundTask.findUnique({
        where: { id: taskId },
        select: { payload: true },
      });
      if (bgTask?.payload) {
        const payload = JSON.parse(bgTask.payload);
        userInterfaceLanguage = payload.userInterfaceLanguage || 'fr';
      }
    } catch {
      // Fallback to 'fr' if payload parsing fails
    }

    // Retrieve source CV
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

    // Process each offer sequentially (to optimize OpenAI cache)
    for (const offer of task.offers) {
      if (signal?.aborted) {
        console.log(`[orchestrator] Task ${taskId} cancelled`);
        break;
      }

      // Create progress context for this offer
      const progressContext = {
        taskId,
        offerId: offer.id,
        offerIndex: offer.offerIndex,
        totalOffers: task.totalOffers,
        sourceUrl: offer.sourceUrl || null,
        jobTitle: null, // Will be updated after extraction
      };

      // Phase 0: Extraction of job offer (if not yet extracted)
      let jobOffer = null;
      let jobOfferId = offer.jobOfferId;

      if (!jobOfferId && offer.sourceUrl) {
        // Offer not yet extracted - launch extraction phase
        try {
          const extractionResult = await runExtractionPhase(offer, task.userId, signal, progressContext);
          jobOfferId = extractionResult.jobOfferId;
          jobOffer = extractionResult.jobOffer;

          // Update context with extracted title
          progressContext.jobTitle = extractionResult.title || null;

          console.log(`[orchestrator] Extraction completed for offer ${offer.id}: ${extractionResult.title}`);
        } catch (error) {
          console.error(`[orchestrator] Extraction failed for offer ${offer.id}:`, error.message);

          // Mark offer as failed
          // Propager le message d'erreur tel quel pour permettre le parsing JSON des clés de traduction
          await prisma.cvGenerationOffer.update({
            where: { id: offer.id },
            data: {
              status: 'failed',
              error: error.message,
              completedAt: new Date(),
            },
          });

          results.failed.push({
            offerId: offer.id,
            error: error.message,
          });

          // Refund credit
          const refundResult = await refundCreditForOffer(taskId, offer.id, task.userId, error.message);
          await prisma.cvGenerationTask.update({
            where: { id: taskId },
            data: { completedOffers: { increment: 1 } },
          });

          // Emit SSE event for failed offer
          dbEmitter.emitCvGenerationOfferFailed(task.userId, {
            taskId,
            offerId: offer.id,
            offerIndex: offer.offerIndex,
            error: error.message,
            creditsRefunded: refundResult.success ? refundResult.amount : 0,
          });

          continue;
        }
      }

      // Retrieve job offer from DB if not already loaded
      if (!jobOffer && jobOfferId) {
        const jobOfferRecord = await prisma.jobOffer.findUnique({
          where: { id: jobOfferId },
        });
        jobOffer = jobOfferRecord?.content;
      }

      if (!jobOffer) {
        console.error(`[orchestrator] Job offer not found: ${jobOfferId}`);

        // Mark offer as failed
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

        // Refund credit and increment counter
        const refundResult = await refundCreditForOffer(taskId, offer.id, task.userId, 'Job offer not found');
        await prisma.cvGenerationTask.update({
          where: { id: taskId },
          data: { completedOffers: { increment: 1 } },
        });

        // Emit SSE event for failed offer
        dbEmitter.emitCvGenerationOfferFailed(task.userId, {
          taskId,
          offerId: offer.id,
          offerIndex: offer.offerIndex,
          error: 'Job offer not found',
          creditsRefunded: refundResult.success ? refundResult.amount : 0,
        });

        continue;
      }

      // Detect target language from job offer (with fallback to source CV)
      const languageInfo = await detectJobOfferLanguage({ content: jobOffer }, sourceCvFile.language, task.userId);
      const targetLanguage = languageInfo.name;
      // Source language from CV file (for translation comparison)
      const sourceLanguage = getTargetLanguageName(sourceCvFile.language || 'fr');

      console.log(`[orchestrator] Languages for offer ${offer.id}: source=${sourceLanguage}, target=${targetLanguage} (detection: ${languageInfo.source})`);

      // Process offer (phases 0.5 to 2)
      const offerResult = await processOffer(
        offer,
        sourceCv,
        sourceCvFileName,
        jobOffer,
        jobOfferId,
        sourceLanguage,
        targetLanguage,
        userInterfaceLanguage,
        task.userId,
        signal,
        progressContext,
        hasAnalyticsConsent
      );

      if (offerResult.success) {
        results.completed.push(offerResult);
      } else {
        results.failed.push(offerResult);

        // Refund credit for failed offer
        const refundResult = await refundCreditForOffer(taskId, offer.id, task.userId, offerResult.error);

        // Emit SSE event for failed offer
        dbEmitter.emitCvGenerationOfferFailed(task.userId, {
          taskId,
          offerId: offer.id,
          offerIndex: offer.offerIndex,
          error: offerResult.error,
          creditsRefunded: refundResult.success ? refundResult.amount : 0,
        });
      }

      // Increment processed offers counter (success OR failure)
      // Allows progress calculation: completedOffers / totalOffers
      await prisma.cvGenerationTask.update({
        where: { id: taskId },
        data: { completedOffers: { increment: 1 } },
      });
    }

    // Handle cancellation: mark unprocessed offers as 'cancelled' and refund
    if (signal?.aborted) {
      console.log(`[orchestrator] Task ${taskId} was cancelled, cleaning up pending offers...`);

      // Find offers still pending or running
      const pendingOffers = await prisma.cvGenerationOffer.findMany({
        where: {
          taskId,
          status: { in: ['pending', 'running'] },
        },
      });

      // Mark each offer as cancelled and refund
      for (const offer of pendingOffers) {
        await prisma.cvGenerationOffer.update({
          where: { id: offer.id },
          data: {
            status: 'cancelled',
            error: 'Task cancelled by user',
            completedAt: new Date(),
          },
        });

        // Refund credit
        await refundCreditForOffer(taskId, offer.id, task.userId, 'Task cancelled by user');

        results.failed.push({
          offerId: offer.id,
          error: 'Task cancelled by user',
        });
      }

      console.log(`[orchestrator] Cancelled ${pendingOffers.length} pending offer(s) for task ${taskId}`);
    }

    // Determine final task status
    const finalStatus = signal?.aborted
      ? 'cancelled'
      : results.completed.length > 0 ? 'completed' : 'failed';

    // Get total refunded credits
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

    // Synchronize BackgroundTask for TaskQueueModal (unless already cancelled by API)
    const bgTaskError = results.failed.length > 0
      ? `${results.failed.length}/${task.totalOffers} offer(s) failed`
      : null;
    const bgTaskResult = {
      totalGenerated: results.completed.length,
      totalFailed: results.failed.length,
      generatedCvs: results.completed.map(r => ({
        cvFileId: r.cvFileId,
        filename: r.filename,
      })),
    };

    // Check if task hasn't been cancelled via API
    const currentBgTask = await prisma.backgroundTask.findUnique({
      where: { id: taskId },
      select: { status: true },
    }).catch(() => null);

    // Don't overwrite if already 'cancelled' by API
    if (currentBgTask?.status !== 'cancelled') {
      await prisma.backgroundTask.update({
        where: { id: taskId },
        data: {
          status: finalStatus,
          error: bgTaskError,
          result: JSON.stringify(bgTaskResult),
          successMessage: results.completed.length > 0
            ? JSON.stringify({ key: 'taskQueue.messages.cvGenerated', params: { count: results.completed.length } })
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

    // Emit SSE event for completed task
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
    // Release AbortController and task type slot (success or error)
    clearRegisteredProcess(taskId);
    registerTaskTypeEnd(task.userId, 'cv_generation');
  }
}
