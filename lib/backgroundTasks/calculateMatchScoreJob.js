import prisma from "@/lib/prisma";
import { readUserCvFile } from "@/lib/cv/storage";
import { enqueueJob } from "@/lib/backgroundTasks/jobQueue";
import { registerAbortController, clearRegisteredProcess } from "@/lib/backgroundTasks/processRegistry";

// Import dynamique pour éviter de charger les modules lourds au démarrage
async function getCalculateMatchScoreWithAnalysis() {
  const module = await import("@/lib/openai/calculateMatchScoreWithAnalysis");
  return module.calculateMatchScoreWithAnalysis;
}

async function updateBackgroundTask(taskId, userId, data) {
  if (!taskId) return;
  try {
    await prisma.backgroundTask.updateMany({
      where: { id: taskId, userId },
      data,
    });
  } catch (error) {
    console.warn(`Impossible de mettre à jour la tâche ${taskId}`, error);
  }
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
  await prisma.cvFile.update({
    where: {
      userId_filename: {
        userId,
        filename: cvFile,
      },
    },
    data: {
      matchScoreStatus: 'inprogress',
    },
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

  // Récupérer le record CvFile pour obtenir extractedJobOffer si disponible
  const cvFileRecord = await prisma.cvFile.findUnique({
    where: {
      userId_filename: {
        userId,
        filename: cvFile,
      },
    },
    select: {
      extractedJobOffer: true,
      sourceValue: true,
      matchScore: true,
      matchScoreUpdatedAt: true,
      scoreBreakdown: true,
      improvementSuggestions: true,
      missingSkills: true,
      matchingSkills: true,
    },
  }).catch(() => null);

  // Vérifier si le score a été calculé il y a moins de 5 minutes
  let result;
  if (cvFileRecord?.matchScore !== null && cvFileRecord?.matchScoreUpdatedAt) {
    const now = new Date();
    const lastUpdate = new Date(cvFileRecord.matchScoreUpdatedAt);
    const minutesSinceUpdate = (now - lastUpdate) / (1000 * 60);

    if (minutesSinceUpdate < 5) {
      const secondsSinceUpdate = Math.round(minutesSinceUpdate * 60);
      console.log(`[calculateMatchScoreJob] Score calculé il y a ${secondsSinceUpdate}s → retour du même score sans appel GPT`);

      // Simuler un délai de calcul (7-16 secondes)
      const randomDelay = 7000 + Math.floor(Math.random() * 9000); // 7000ms à 16000ms
      console.log(`[calculateMatchScoreJob] Simulation d'un délai de ${Math.round(randomDelay / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, randomDelay));

      // Retourner les données existantes sans appeler GPT
      try {
        result = {
          matchScore: cvFileRecord.matchScore,
          scoreBreakdown: JSON.parse(cvFileRecord.scoreBreakdown || '{}'),
          suggestions: JSON.parse(cvFileRecord.improvementSuggestions || '[]'),
          missingSkills: JSON.parse(cvFileRecord.missingSkills || '[]'),
          matchingSkills: JSON.parse(cvFileRecord.matchingSkills || '[]')
        };
        console.log(`[calculateMatchScoreJob] ✅ Score retourné (cache 5 min): ${result.matchScore}/100`);
      } catch (parseError) {
        console.error('[calculateMatchScoreJob] Erreur parsing données en cache, recalcul nécessaire:', parseError);
        result = null; // Forcer le recalcul si parsing échoue
      }
    }
  }

  // Si pas de court-circuit (> 5 min ou pas de score), calculer normalement
  if (!result) {
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
        cvFile: cvFileRecord, // Passer le record pour utiliser extractedJobOffer en cache
        previousScore: cvFileRecord?.matchScore, // Passer le score précédent pour logique incrémentale
        signal: abortController.signal,
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

    // ❌ En cas d'erreur, DÉCRÉMENTER le compteur (car il a été incrémenté au début)
    if (!isAutomatic) {
      const userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          matchScoreRefreshCount: true,
        },
      });

      if (userRecord && userRecord.matchScoreRefreshCount > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            matchScoreRefreshCount: userRecord.matchScoreRefreshCount - 1,
          },
        });
        console.log(`[calculateMatchScoreJob] ❌ Erreur - Compteur décrémenté: ${userRecord.matchScoreRefreshCount - 1}/5`);
      }
    }

    await prisma.cvFile.update({
      where: {
        userId_filename: {
          userId,
          filename: cvFile,
        },
      },
      data: {
        matchScoreStatus: 'failed',
      },
    }).catch(err => console.error(`[calculateMatchScoreJob] Impossible de mettre à jour le status du CV:`, err));

    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: errorMessage,
    });
    return;
    }
  }

  // ✅ Succès - Sauvegarder le score et l'analyse (le compteur a déjà été incrémenté au début)
  try {
    // Sauvegarder le score et l'analyse complète dans le CV et mettre le status à "idle"
    await prisma.cvFile.update({
      where: {
        userId_filename: {
          userId,
          filename: cvFile,
        },
      },
      data: {
        matchScore: result.matchScore,
        matchScoreUpdatedAt: new Date(),
        matchScoreStatus: 'idle',
        scoreBreakdown: JSON.stringify(result.scoreBreakdown),
        improvementSuggestions: JSON.stringify(result.suggestions),
        missingSkills: JSON.stringify(result.missingSkills),
        matchingSkills: JSON.stringify(result.matchingSkills),
      },
    });

    let finalRefreshCount = 0;

    // Récupérer le compteur actuel pour le retourner dans le résultat
    if (!isAutomatic) {
      const userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          matchScoreRefreshCount: true,
        },
      });

      finalRefreshCount = userRecord?.matchScoreRefreshCount || 0;
      console.log(`[calculateMatchScoreJob] ✅ Calcul réussi - Compteur actuel: ${finalRefreshCount}/5`);
    } else {
      console.log(`[calculateMatchScoreJob] ✅ Calcul automatique réussi (pas de compteur)`);
    }

    clearRegisteredProcess(taskId);

    await updateBackgroundTask(taskId, userId, {
      status: 'completed',
      result: JSON.stringify({
        score: result.matchScore,
        refreshCount: finalRefreshCount,
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
