import prisma from "@/lib/prisma";
import { readUserCvFile, writeUserCvFile } from "@/lib/cv-core/storage";
import { createCvVersionWithTracking } from "@/lib/cv-core/versioning";
import { initializeReviewState, computeCvDiff } from "@/lib/cv-core/changeTracking";
import { runImprovementPipeline } from "./orchestrator.js";
import { enqueueJob } from "@/lib/background-jobs/jobQueue";
import { registerAbortController, clearRegisteredProcess } from "@/lib/background-jobs/processRegistry";
import { updateBackgroundTask, updateCvFile, createCvFile } from "@/lib/events/prismaWithEvents";
import { trackCvOptimization } from "@/lib/telemetry/server";
import { refundFeatureUsage } from "@/lib/subscription/featureUsage";
import dbEmitter from "@/lib/events/dbEmitter";


export function scheduleImproveCvJob(jobInput) {
  enqueueJob(() => runImproveCvJob(jobInput));
}

export async function runImproveCvJob({
  taskId,
  user,
  cvFile,
  jobOfferContent,
  jobOfferUrl,
  currentScore,
  suggestions,
  missingSkillsToAdd = [],
  replaceExisting = false,
  deviceId,
}) {
  const userId = user.id;
  const startTime = Date.now();

  console.log(`[improveCvJob] starting job ${taskId} for user ${userId}, CV: ${cvFile}`);

  const abortController = new AbortController();
  registerAbortController(taskId, abortController);

  let shouldStop = false;
  abortController.signal.addEventListener('abort', () => {
    console.log(`[improveCvJob] Signal abort reçu pour ${taskId}`);
    shouldStop = true;
  });

  try {
    const record = await prisma.backgroundTask.findUnique({ where: { id: taskId } });
    if (!record || record.status === 'cancelled') {
      console.log(`[improveCvJob] Tâche ${taskId} déjà annulée`);
      await updateCvFile(userId, cvFile, { optimiseStatus: 'idle', optimiseUpdatedAt: new Date() }).catch(() => {});
      clearRegisteredProcess(taskId);
      return;
    }
  } catch (error) {
    console.warn(`Impossible de vérifier la tâche ${taskId} avant démarrage`, error);
  }

  if (shouldStop) {
    await updateCvFile(userId, cvFile, { optimiseStatus: 'idle', optimiseUpdatedAt: new Date() }).catch(() => {});
    clearRegisteredProcess(taskId);
    return;
  }

  await updateBackgroundTask(taskId, userId, {
    status: 'running',
    error: null,
    deviceId,
  });

  await updateCvFile(userId, cvFile, { optimiseStatus: 'inprogress' }).catch(err =>
    console.error(`[improveCvJob] Impossible de mettre à jour le status du CV:`, err)
  );

  if (shouldStop || abortController.signal.aborted) {
    await updateBackgroundTask(taskId, userId, { status: 'cancelled', result: null, error: null });
    await updateCvFile(userId, cvFile, { optimiseStatus: 'idle', optimiseUpdatedAt: new Date() }).catch(() => {});
    clearRegisteredProcess(taskId);
    return;
  }

  // Lire le CV
  let cvContent;
  try {
    cvContent = await readUserCvFile(userId, cvFile);
    console.log(`[improveCvJob] CV lu avec succès, taille: ${cvContent.length} caractères`);
  } catch (error) {
    console.error(`[improveCvJob] Impossible de lire le CV ${cvFile}:`, error);
    await updateBackgroundTask(taskId, userId, { status: 'failed', result: null, error: `CV '${cvFile}' introuvable` });
    await updateCvFile(userId, cvFile, { optimiseStatus: 'failed' }).catch(() => {});
    clearRegisteredProcess(taskId);
    return;
  }

  try {
    const originalCv = JSON.parse(cvContent);
    let workingCv = JSON.parse(cvContent);
    let allChangesMade = [];
    let stageMetrics = {};

    // Pipeline V2 (4 stages)
    console.log(`[improveCvJob] Using Pipeline V2 (4 stages)`);

    // Parser le jobOffer si c'est une string
    let jobOffer = null;
    if (jobOfferContent) {
      try {
        jobOffer = typeof jobOfferContent === 'string' ? JSON.parse(jobOfferContent) : jobOfferContent;
      } catch {
        jobOffer = { content: jobOfferContent }; // Fallback si pas JSON
      }
    }

    const pipelineResult = await runImprovementPipeline({
      taskId,
      userId,
      workingCv,
      jobOffer,
      jobOfferContent,
      suggestions,
      missingSkillsToAdd,
      abortController,
    });

    workingCv = pipelineResult.workingCv;
    allChangesMade = pipelineResult.allChangesMade;
    stageMetrics = pipelineResult.stageMetrics;

    // Vérifier annulation avant sauvegarde
    const taskCheck = await prisma.backgroundTask.findUnique({
      where: { id: taskId },
      select: { status: true }
    });

    if (!taskCheck || taskCheck.status === 'cancelled') {
      console.log(`[improveCvJob] Tâche ${taskId} annulée avant sauvegarde - abandon`);
      await updateCvFile(userId, cvFile, { optimiseStatus: 'idle', optimiseUpdatedAt: new Date() }).catch(() => {});
      clearRegisteredProcess(taskId);
      return;
    }

    // Déterminer le nom de fichier
    let improvedFilename;
    if (replaceExisting) {
      improvedFilename = cvFile;
    } else {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      improvedFilename = `improved_${timestamp}.json`;
    }

    const improvedCv = workingCv;

    // Calculer les différences programmatiques
    const programmaticChanges = computeCvDiff(improvedCv, originalCv);
    console.log(`[improveCvJob] computeCvDiff a détecté ${programmaticChanges.length} changement(s)`);

    let changesMade;
    if (programmaticChanges.length > 0) {
      changesMade = programmaticChanges;
    } else if (allChangesMade.length > 0) {
      changesMade = allChangesMade;
    } else {
      changesMade = [{
        section: "cv",
        field: "content",
        change: "CV optimisé pour l'offre d'emploi",
        reason: "Amélioration automatique basée sur les sélections"
      }];
    }

    const modifiedSectionNames = [...new Set(changesMade.map(c => c.section))];

    improvedCv.meta = {
      ...improvedCv.meta,
      improved_from: cvFile,
      improved_at: new Date().toISOString(),
      score_before: currentScore,
      changes_count: changesMade.length,
      changes_made: changesMade,
      modified_sections: modifiedSectionNames,
      pipeline_version: 2,
      stage_metrics: stageMetrics,
    };

    // Sauvegarde
    let createdVersion = null;

    if (replaceExisting) {
      try {
        createdVersion = await createCvVersionWithTracking(userId, cvFile, 'Avant optimisation IA', 'optimization');
        console.log(`[improveCvJob] Version ${createdVersion} créée pour ${cvFile} avant optimisation`);
      } catch (versionError) {
        console.warn(`[improveCvJob] Impossible de créer une version:`, versionError.message);
      }
    }

    await writeUserCvFile(userId, improvedFilename, JSON.stringify(improvedCv, null, 2));
    console.log(`[improveCvJob] CV sauvegardé: ${improvedFilename}`);

    const cvRecord = await prisma.cvFile.findUnique({
      where: { userId_filename: { userId, filename: cvFile } }
    });

    if (replaceExisting) {
      await updateCvFile(userId, improvedFilename, {
        optimiseStatus: 'idle',
        optimiseUpdatedAt: new Date(),
        updatedAt: new Date(),
        scoreBefore: currentScore || null,
      });
    } else {
      await createCvFile({
        userId,
        filename: improvedFilename,
        sourceType: cvRecord?.sourceType || 'link',
        sourceValue: cvRecord?.sourceValue || jobOfferUrl,
        createdBy: 'improve-cv',
        matchScore: null,
        matchScoreUpdatedAt: null,
        scoreBreakdown: null,
        improvementSuggestions: null,
        missingSkills: null,
        matchingSkills: null,
        jobOfferId: cvRecord?.jobOfferId || null,
        optimiseStatus: 'idle',
        optimiseUpdatedAt: new Date(),
        scoreBefore: currentScore || null,
      });
    }

    if (replaceExisting && createdVersion !== null && changesMade.length > 0) {
      try {
        await initializeReviewState(userId, improvedFilename, changesMade, createdVersion - 1);
        console.log(`[improveCvJob] État de review initialisé pour ${improvedFilename}`);
      } catch (reviewError) {
        console.warn(`[improveCvJob] Impossible d'initialiser l'état de review:`, reviewError.message);
      }
    }

    // Vérifier avant completion
    const taskBeforeCompletion = await prisma.backgroundTask.findUnique({
      where: { id: taskId },
      select: { status: true }
    });

    if (!taskBeforeCompletion || taskBeforeCompletion.status === 'cancelled') {
      console.log(`[improveCvJob] Tâche ${taskId} annulée avant completion - abandon`);
      await updateCvFile(userId, cvFile, { optimiseStatus: 'idle', optimiseUpdatedAt: new Date() }).catch(() => {});
      clearRegisteredProcess(taskId);
      return;
    }

    clearRegisteredProcess(taskId);

    const changesCount = changesMade.length;
    const successMessage = replaceExisting
      ? `CV remplacé avec ${changesCount} amélioration${changesCount > 1 ? 's' : ''}`
      : `CV amélioré avec ${changesCount} modification${changesCount > 1 ? 's' : ''}`;

    const duration = Date.now() - startTime;
    try {
      await trackCvOptimization({
        userId,
        deviceId: deviceId || null,
        changesCount,
        sectionsModified: modifiedSectionNames,
        duration,
        status: 'success',
      });
    } catch (trackError) {
      console.error('[improveCvJob] Erreur tracking télémétrie:', trackError);
    }

    await updateBackgroundTask(taskId, userId, {
      status: 'completed',
      result: JSON.stringify({
        improvedFile: improvedFilename,
        changesMade: changesMade,
        changesCount,
        replaced: replaceExisting,
        pipelineVersion: 2,
        stageMetrics,
      }),
      error: null,
      successMessage
    });

    // Émettre événement SSE cv_improvement:completed
    dbEmitter.emitCvImprovementCompleted(userId, {
      taskId,
      changesCount,
      pipelineVersion: 2,
      stageMetrics,
    });

    await updateCvFile(userId, improvedFilename, {
      scoreBreakdown: null,
      improvementSuggestions: null,
      missingSkills: null,
      matchingSkills: null,
      matchScore: null,
      matchScoreUpdatedAt: null,
    });
    console.log(`[improveCvJob] Données d'analyse et score supprimés pour forcer recalcul du score`);

    console.log(`[improveCvJob] Amélioration terminée: ${improvedFilename} (Pipeline V2)`);

  } catch (error) {
    clearRegisteredProcess(taskId);

    if (error.message === 'Task cancelled' || abortController.signal.aborted) {
      console.log(`[improveCvJob] Tâche ${taskId} annulée`);
      await refundFeatureUsage(taskId);
      await updateBackgroundTask(taskId, userId, { status: 'cancelled', result: null, error: null });
      await updateCvFile(userId, cvFile, { optimiseStatus: 'idle', optimiseUpdatedAt: new Date() }).catch(() => {});

      // Émettre événement SSE cv_improvement:failed (cancelled)
      dbEmitter.emitCvImprovementFailed(userId, {
        taskId,
        error: 'Task cancelled',
      });
      return;
    }

    console.error(`[improveCvJob] Erreur pour la tâche ${taskId}:`, error);
    console.error(`[improveCvJob] Stack trace:`, error.stack);

    const isQuotaExceeded = error.message && /insufficient_quota|exceeded your current quota/i.test(error.message);
    const errorMessage = isQuotaExceeded
      ? "Quota OpenAI dépassé. Vérifiez votre facturation."
      : (error.message || 'Échec lors de l\'amélioration du CV');

    const duration = Date.now() - startTime;
    try {
      await trackCvOptimization({
        userId,
        deviceId: deviceId || null,
        changesCount: 0,
        sectionsModified: [],
        duration,
        status: 'error',
        error: errorMessage,
      });
    } catch (trackError) {
      console.error('[improveCvJob] Erreur tracking télémétrie:', trackError);
    }

    await refundFeatureUsage(taskId);
    await updateBackgroundTask(taskId, userId, { status: 'failed', result: null, error: errorMessage });
    await updateCvFile(userId, cvFile, { optimiseStatus: 'failed' }).catch(() => {});

    // Émettre événement SSE cv_improvement:failed
    dbEmitter.emitCvImprovementFailed(userId, {
      taskId,
      error: errorMessage,
    });
  }
}
