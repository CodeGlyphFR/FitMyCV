import prisma from "@/lib/prisma";
import { readUserCvFile } from "@/lib/cv-core/storage";
import { enqueueJob } from "@/lib/background-jobs/jobQueue";
import { registerAbortController, clearRegisteredProcess } from "@/lib/background-jobs/processRegistry";
import { updateBackgroundTask, updateCvFile } from "@/lib/events/prismaWithEvents";
import { trackMatchScore } from "@/lib/telemetry/server";
import { refundFeatureUsage } from "@/lib/subscription/featureUsage";

// Import dynamique pour éviter de charger les modules lourds au démarrage
async function getCalculateMatchScoreWithAnalysis() {
  const module = await import("@/lib/scoring/service");
  return module.calculateMatchScoreWithAnalysis;
}

export function scheduleCalculateMatchScoreJob(jobInput) {
  enqueueJob(() => runCalculateMatchScoreJob(jobInput));
}

export async function runCalculateMatchScoreJob({
  taskId,
  user,
  cvFile,
  jobOfferUrl,
  isAutomatic = false,
  deviceId,
}) {
  const userId = user.id;
  const startTime = Date.now();

  console.log(`[calculateMatchScoreJob] starting job ${taskId} for user ${userId}, CV: ${cvFile}`);

  try {
    const record = await prisma.backgroundTask.findUnique({ where: { id: taskId } });
    if (!record || record.status === 'cancelled') {
      return;
    }
  } catch (error) {
    console.warn(`Impossible de vérifier la tâche ${taskId} avant démarrage`, error);
  }

  // Créer un AbortController pour pouvoir annuler la tâche
  const abortController = new AbortController();
  registerAbortController(taskId, abortController);

  await updateBackgroundTask(taskId, userId, {
    status: 'running',
    error: null,
    deviceId,
  });

  // Mettre le status du CV à "calculating"
  await updateCvFile(userId, cvFile, {
    matchScoreStatus: 'inprogress',
  }).catch(err => console.error(`[calculateMatchScoreJob] Impossible de mettre à jour le status du CV:`, err));

  // Vérifier si annulé
  if (abortController.signal.aborted) {
    await updateBackgroundTask(taskId, userId, {
      status: 'cancelled',
      result: null,
      error: null,
    });
    clearRegisteredProcess(taskId);
    return;
  }

  // Lire le CV
  let cvContent;
  try {
    cvContent = await readUserCvFile(userId, cvFile);
    console.log(`[calculateMatchScoreJob] CV lu avec succès, taille: ${cvContent.length} caractères`);
  } catch (error) {
    console.error(`[calculateMatchScoreJob] Impossible de lire le CV ${cvFile}:`, error);
    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: `CV '${cvFile}' introuvable`,
    });
    clearRegisteredProcess(taskId);
    return;
  }

  // Récupérer le record CvFile pour obtenir jobOffer si disponible
  const cvFileRecord = await prisma.cvFile.findUnique({
    where: {
      userId_filename: {
        userId,
        filename: cvFile,
      },
    },
    select: {
      jobOffer: true, // Relation vers JobOffer
      sourceValue: true,
      matchScore: true,
      matchScoreUpdatedAt: true,
      scoreBreakdown: true,
      improvementSuggestions: true,
      missingSkills: true,
      matchingSkills: true,
    },
  }).catch(() => null);

  // Calculer le score et l'analyse - l'analyse est TOUJOURS recalculée
  let result;
  try {
    // Vérifier si annulé avant l'opération longue
    if (abortController.signal.aborted) {
      throw new Error('Task cancelled');
    }

    // Import dynamique puis appel de la fonction
    const calculateMatchScoreWithAnalysis = await getCalculateMatchScoreWithAnalysis();
    result = await calculateMatchScoreWithAnalysis({
      cvContent,
      jobOfferUrl,
      cvFile: cvFileRecord, // Passer le record pour utiliser jobOffer.content
      signal: abortController.signal,
      userId, // Pour la télémétrie OpenAI
    });

    console.log(`[calculateMatchScoreJob] Score calculé: ${result.matchScore}/100, Suggestions: ${result.suggestions.length}`);

    // Vérifier si annulé après l'opération
    if (abortController.signal.aborted) {
      throw new Error('Task cancelled');
    }
  } catch (error) {
    clearRegisteredProcess(taskId);

    // Si c'est une annulation
    if (error.message === 'Task cancelled' || abortController.signal.aborted) {
      console.log(`[calculateMatchScoreJob] Tâche ${taskId} annulée`);
      await refundFeatureUsage(taskId);
      await updateBackgroundTask(taskId, userId, {
        status: 'cancelled',
        result: null,
        error: null,
      });
      return;
    }

    console.error(`[calculateMatchScoreJob] Erreur lors du calcul du score pour la tâche ${taskId}:`, error);
    console.error(`[calculateMatchScoreJob] Stack trace:`, error.stack);

    const isQuotaExceeded = error.message && /insufficient_quota|exceeded your current quota/i.test(error.message);
    const errorMessage = isQuotaExceeded
      ? "Quota OpenAI dépassé. Vérifiez votre facturation."
      : (error.message || 'Échec lors du calcul du score de match');

    console.error(`[calculateMatchScoreJob] Message d'erreur retourné: ${errorMessage}`);

    await updateCvFile(userId, cvFile, {
      matchScoreStatus: 'failed',
    }).catch(err => console.error(`[calculateMatchScoreJob] Impossible de mettre à jour le status du CV:`, err));

    await refundFeatureUsage(taskId);
    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: errorMessage,
    });

    // Tracking télémétrie - Erreur
    const duration = Date.now() - startTime;
    try {
      await trackMatchScore({
        userId,
        deviceId: deviceId || null,
        score: 0,
        isAutomatic,
        tokensUsed: 0,
        tokensRemaining: 0,
        duration,
        status: 'error',
        error: errorMessage,
      });
    } catch (trackError) {
      console.error('[calculateMatchScoreJob] Erreur tracking télémétrie:', trackError);
    }

    return;
  }

  // ✅ Succès - Sauvegarder le score et l'analyse (le compteur a déjà été incrémenté au début)
  try {
    // Calculate duration before tracking
    const duration = Date.now() - startTime;

    // Sauvegarder le score et l'analyse complète dans le CV et mettre le status à "idle"
    await updateCvFile(userId, cvFile, {
      matchScore: result.matchScore,
      matchScoreUpdatedAt: new Date(),
      matchScoreStatus: 'idle',
      scoreBreakdown: JSON.stringify(result.scoreBreakdown),
      improvementSuggestions: JSON.stringify(result.suggestions),
      missingSkills: JSON.stringify(result.missingSkills),
      matchingSkills: JSON.stringify(result.matchingSkills),
      // Réinitialiser scoreBefore car ce n'est pas une optimisation
      scoreBefore: null,
    });

    console.log(`[calculateMatchScoreJob] ✅ Calcul réussi - Score: ${result.matchScore}/100`);

    // Tracking télémétrie - Succès
    try {
      await trackMatchScore({
        userId,
        deviceId: deviceId || null,
        score: result.matchScore,
        isAutomatic,
        tokensUsed: 0,
        tokensRemaining: 0,
        duration,
        status: 'success',
      });
    } catch (trackError) {
      console.error('[calculateMatchScoreJob] Erreur tracking télémétrie:', trackError);
    }

    clearRegisteredProcess(taskId);

    await updateBackgroundTask(taskId, userId, {
      status: 'completed',
      result: JSON.stringify({
        score: result.matchScore,
        suggestions: result.suggestions.length
      }),
      error: null,
      successMessage: `Score de match calculé: ${result.matchScore}/100 avec ${result.suggestions.length} suggestions`
    });
  } catch (error) {
    clearRegisteredProcess(taskId);

    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: `Impossible de sauvegarder le score : ${error.message}`,
    });
  }
}
