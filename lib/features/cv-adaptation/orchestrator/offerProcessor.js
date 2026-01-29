/**
 * Offer Processor for CV Adaptation Pipeline
 *
 * Handles the processing of individual job offers through all phases:
 * - Phase 0: Extraction (fetch job offer from URL)
 * - Phase 0.5: Classification (KEEP/REMOVE/MOVE_TO_PROJECTS)
 * - Phase 1: Batches (experiences, projects, extras, skills, summary)
 * - Phase 2: Recomposition (final assembly + languages)
 */

import prisma from '@/lib/prisma';
import dbEmitter from '@/lib/events/dbEmitter';
import {
  trackCvGenerationCompleted,
  trackCvGenerationFailed,
} from '@/lib/telemetry/server';

import { executeExtraction } from '../phases/extract.js';
import {
  executeClassification,
  applyClassification,
} from '../phases/classify.js';
import { executeBatchExperiences } from '../phases/batch-experiences.js';
import { executeBatchProjects } from '../phases/batch-projects.js';
import { executeBatchExtras } from '../phases/batch-extras.js';
import { executeBatchEducation } from '../phases/batch-education.js';
import { executeBatchLanguages } from '../phases/batch-languages.js';
import { executeBatchSkills } from '../phases/batch-skills.js';
import { processSkillsResponse } from '../phases/parseSkillsResponse.js';
import { executeBatchSummary } from '../phases/batch-summary.js';
import { executeRecomposition } from '../phases/recompose.js';

import { withRetry, MAX_RETRIES } from './retryHandler.js';
import { emitProgress } from './progressEmitter.js';

/**
 * Execute Phase 0: Extraction of the job offer
 */
export async function runExtractionPhase(offer, userId, signal, progressContext) {
  console.log(`[orchestrator] Phase 0: Extraction for offer ${offer.id} from ${offer.sourceUrl}`);

  // Emit progress: extraction in progress
  emitProgress(userId, progressContext, 'extraction', 'extraction', 'running');

  // Update offer status
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
      // Increment retryCount of failed subtasks before retry
      await prisma.cvGenerationSubtask.updateMany({
        where: { offerId: offer.id, type: 'extraction', status: 'failed' },
        data: { retryCount: retryAttempt },
      });
    }
  );

  if (!result.success) {
    throw new Error(result.error || 'Extraction failed');
  }

  // Emit progress: extraction completed
  emitProgress(userId, progressContext, 'extraction', 'extraction', 'completed');

  return result;
}

/**
 * Execute Phase 0.5: Classification
 */
export async function runClassificationPhase(offer, sourceCv, jobOffer, userId, signal, progressContext) {
  console.log(`[orchestrator] Phase 0.5: Classification for offer ${offer.id}`);

  // Emit progress: classification in progress
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
      // Increment retryCount of failed subtasks before retry
      await prisma.cvGenerationSubtask.updateMany({
        where: { offerId: offer.id, type: 'classify', status: 'failed' },
        data: { retryCount: retryAttempt },
      });
    }
  );

  if (!result.success) {
    throw new Error(result.error || 'Classification failed');
  }

  // Emit progress: classification completed
  emitProgress(userId, progressContext, 'classify', 'classify', 'completed');

  return result;
}

/**
 * Execute Phase 1: Batches
 */
export async function runBatchesPhase(offer, sourceCv, classificationResult, jobOffer, sourceLanguage, targetLanguage, userInterfaceLanguage, userId, signal, progressContext) {
  console.log(`[orchestrator] Phase 1: Batches for offer ${offer.id}`);

  // Apply classification
  const classified = applyClassification(sourceCv, classificationResult);

  // 1. Parallelize experiences, projects, extras, education, languages, skills
  // Skills s'exécute en parallèle car il n'a pas besoin du contexte des sections adaptées
  console.log(`[orchestrator] Running parallel batches: experiences, projects, extras, education, languages, skills`);

  // Emit progress: parallel batches in progress
  emitProgress(userId, progressContext, 'batches', 'experiences', 'running');
  emitProgress(userId, progressContext, 'batches', 'projects', 'running');
  emitProgress(userId, progressContext, 'batches', 'extras', 'running');
  emitProgress(userId, progressContext, 'batches', 'education', 'running');
  emitProgress(userId, progressContext, 'batches', 'languages', 'running');
  emitProgress(userId, progressContext, 'batches', 'skills', 'running');

  const [experiencesResult, projectsResult, extrasResult, educationResult, languagesResult, skillsResult] = await Promise.all([
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

    // Projects (MOVE_TO_PROJECTS are already included in classified.projects by applyClassification)
    withRetry(
      async () => {
        return await executeBatchProjects({
          offerId: offer.id,
          projects: classified.projects,
          movedExperiences: [], // Already included in classified.projects, no duplication
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

    // Education
    withRetry(
      async () => {
        return await executeBatchEducation({
          offerId: offer.id,
          education: sourceCv.education || [],
          jobOffer,
          targetLanguage,
          userId,
          signal,
        });
      },
      MAX_RETRIES,
      'Batch Education',
      async (retryAttempt) => {
        await prisma.cvGenerationSubtask.updateMany({
          where: { offerId: offer.id, type: 'batch_education', status: 'failed' },
          data: { retryCount: retryAttempt },
        });
      }
    ).then(result => {
      emitProgress(userId, progressContext, 'batches', 'education', 'completed');
      return result;
    }),

    // Languages
    withRetry(
      async () => {
        return await executeBatchLanguages({
          offerId: offer.id,
          languages: sourceCv.languages || [],
          jobOffer,
          sourceLanguage,
          targetLanguage,
          userId,
          signal,
        });
      },
      MAX_RETRIES,
      'Batch Languages',
      async (retryAttempt) => {
        await prisma.cvGenerationSubtask.updateMany({
          where: { offerId: offer.id, type: 'batch_languages', status: 'failed' },
          data: { retryCount: retryAttempt },
        });
      }
    ).then(result => {
      emitProgress(userId, progressContext, 'batches', 'languages', 'completed');
      return result;
    }),

    // Skills (parallélisé - n'a pas besoin du contexte des sections adaptées)
    withRetry(
      async () => {
        return await executeBatchSkills({
          offerId: offer.id,
          skills: sourceCv.skills || {},
          jobOffer,
          sourceLanguage,
          targetLanguage,
          userInterfaceLanguage,
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
  ]);

  // Verify parallel batch results
  if (!experiencesResult.success) {
    throw new Error(`Batch Experiences failed: ${experiencesResult.error}`);
  }
  if (!projectsResult.success) {
    throw new Error(`Batch Projects failed: ${projectsResult.error}`);
  }
  if (!extrasResult.success) {
    throw new Error(`Batch Extras failed: ${extrasResult.error}`);
  }
  if (!educationResult.success) {
    throw new Error(`Batch Education failed: ${educationResult.error}`);
  }
  if (!languagesResult.success) {
    throw new Error(`Batch Languages failed: ${languagesResult.error}`);
  }
  if (!skillsResult.success) {
    throw new Error(`Batch Skills failed: ${skillsResult.error}`);
  }

  // Post-traiter les skills: validation, review data, transformation
  const languagesDifferent = sourceLanguage !== targetLanguage;
  const processedSkills = processSkillsResponse(
    skillsResult.rawResult,
    sourceCv.skills || {},
    languagesDifferent
  );

  // 2. Summary seul (garde Cache B car il a besoin du contexte des sections adaptées)
  console.log(`[orchestrator] Running batch: summary`);

  // Emit progress: summary in progress
  emitProgress(userId, progressContext, 'batches', 'summary', 'running');

  const summaryResult = await withRetry(
    async () => {
      return await executeBatchSummary({
        offerId: offer.id,
        currentSummary: sourceCv.summary,
        adaptedExperiences: experiencesResult.adaptedExperiences,
        adaptedProjects: projectsResult.adaptedProjects,
        adaptedSkills: {}, // Summary no longer uses adapted skills
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
  );

  emitProgress(userId, progressContext, 'batches', 'summary', 'completed');

  // Verify summary result
  if (!summaryResult.success) {
    throw new Error(`Batch Summary failed: ${summaryResult.error}`);
  }

  return {
    experiences: experiencesResult.adaptedExperiences,
    projects: projectsResult.adaptedProjects,
    extras: extrasResult.adaptedExtras,
    education: educationResult.adaptedEducation,
    languages: languagesResult.adaptedLanguages,
    skills: processedSkills,
    // Attach modifications directly to summary for consistency with other sections
    summary: {
      ...summaryResult.adaptedSummary,
      modifications: summaryResult.modifications || [],
    },
    // Keep separate references for backward compatibility
    experienceModifications: experiencesResult.modifications || {},
    summaryModifications: summaryResult.modifications || {},
    education_modifications: educationResult.education_modifications || [],
    language_modifications: languagesResult.language_modifications || [],
  };
}

/**
 * Execute Phase 2: Recomposition
 */
export async function runRecompositionPhase(offer, sourceCv, sourceCvFileName, batchResults, jobOffer, jobOfferId, targetLanguage, userId, signal, progressContext) {
  console.log(`[orchestrator] Phase 2: Recomposition for offer ${offer.id}`);

  // Emit progress: recomposition in progress
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

  // Emit progress: recomposition completed
  emitProgress(userId, progressContext, 'recompose', 'recompose', 'completed');

  return result;
}

/**
 * Process a complete offer (all phases)
 */
export async function processOffer(offer, sourceCv, sourceCvFileName, jobOffer, jobOfferId, sourceLanguage, targetLanguage, userInterfaceLanguage, userId, signal, progressContext, hasAnalyticsConsent = false) {
  const startTime = Date.now();

  try {
    // Update offer status
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
      sourceLanguage,
      targetLanguage,
      userInterfaceLanguage,
      userId,
      signal,
      progressContext
    );

    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    // Phase 2: Recomposition
    const recomposeResult = await runRecompositionPhase(
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

    // Mark offer as completed
    await prisma.cvGenerationOffer.update({
      where: { id: offer.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    const duration = Date.now() - startTime;
    console.log(`[orchestrator] Offer ${offer.id} completed in ${duration}ms`);

    // Emit SSE event for completed offer
    dbEmitter.emitCvGenerationOfferCompleted(userId, {
      taskId: offer.taskId,
      offerId: offer.id,
      offerIndex: offer.offerIndex,
      generatedCvFileId: recomposeResult.cvFileId,
      generatedCvFileName: recomposeResult.filename,
    });

    // Emit cv:updated event to refresh CV list
    dbEmitter.emitCvUpdate(recomposeResult.filename, userId, {
      action: 'created',
      cvFileId: recomposeResult.cvFileId,
      source: 'cv_generation',
    });

    // Telemetry: CV_GENERATION_COMPLETED (Story 5.3)
    if (hasAnalyticsConsent) {
      await trackCvGenerationCompleted({
        userId,
        taskId: offer.taskId,
        offerId: offer.id,
        durationMs: duration,
        phaseDurations: null, // TODO: Collect phase durations if needed
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

    // Mark offer as failed or cancelled
    await prisma.cvGenerationOffer.update({
      where: { id: offer.id },
      data: {
        status: finalStatus,
        error: error.message,
        completedAt: new Date(),
      },
    });

    // Telemetry: CV_GENERATION_FAILED (Story 5.3)
    if (hasAnalyticsConsent) {
      // Determine the failed phase/step from the error message
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
      } else if (error.message.includes('Batch Education')) {
        failedPhase = 'batches';
        failedStep = 'education';
      } else if (error.message.includes('Batch Languages')) {
        failedPhase = 'batches';
        failedStep = 'languages';
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

      await trackCvGenerationFailed({
        userId,
        taskId: offer.taskId,
        offerId: offer.id,
        failedPhase,
        failedStep,
        error: error.message,
        retryCount: MAX_RETRIES,
      });
    }

    // Note: offer_failed event will be emitted after refund in taskRunner

    return {
      success: false,
      offerId: offer.id,
      error: error.message,
      cancelled: isCancelled,
      duration,
    };
  }
}
