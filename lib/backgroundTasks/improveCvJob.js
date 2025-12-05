import prisma from "@/lib/prisma";
import { readUserCvFile, writeUserCvFile } from "@/lib/cv/storage";
import { createCvVersion } from "@/lib/cv/versioning";
import { enqueueJob } from "@/lib/backgroundTasks/jobQueue";
import { registerAbortController, clearRegisteredProcess } from "@/lib/backgroundTasks/processRegistry";
import { updateBackgroundTask, updateCvFile, createCvFile } from "@/lib/events/prismaWithEvents";
import { trackCvOptimization } from "@/lib/telemetry/server";
import { refundFeatureUsage } from "@/lib/subscription/featureUsage";

// Import dynamique pour éviter de charger les modules lourds au démarrage
async function getImproveCv() {
  const module = await import("@/lib/openai/improveCv");
  return module.improveCv;
}

export function scheduleImproveCvJob(jobInput) {
  enqueueJob(() => runImproveCvJob(jobInput));
}

export async function runImproveCvJob({
  taskId,
  user,
  cvFile,
  jobOfferContent,
  jobOfferUrl, // Gardé pour les métadonnées uniquement
  currentScore,
  suggestions,
  replaceExisting = false,
  deviceId,
}) {
  const userId = user.id;
  const startTime = Date.now();

  console.log(`[improveCvJob] starting job ${taskId} for user ${userId}, CV: ${cvFile}`);

  // Créer un AbortController IMMÉDIATEMENT pour pouvoir annuler la tâche
  const abortController = new AbortController();
  registerAbortController(taskId, abortController);

  // Variable pour tracker si on doit arrêter
  let shouldStop = false;

  // Listener sur abort pour arrêter immédiatement
  abortController.signal.addEventListener('abort', () => {
    console.log(`[improveCvJob] Signal abort reçu pour ${taskId}`);
    shouldStop = true;
  });

  try {
    const record = await prisma.backgroundTask.findUnique({ where: { id: taskId } });
    if (!record || record.status === 'cancelled') {
      console.log(`[improveCvJob] Tâche ${taskId} déjà annulée`);
      // Réinitialiser le status du CV
      await updateCvFile(userId, cvFile, {
        optimiseStatus: 'idle',
        optimiseUpdatedAt: new Date()
      }).catch(() => {});
      clearRegisteredProcess(taskId);
      return;
    }
  } catch (error) {
    console.warn(`Impossible de vérifier la tâche ${taskId} avant démarrage`, error);
  }

  if (shouldStop) {
    console.log(`[improveCvJob] Arrêt demandé après vérification initiale`);
    await updateCvFile(userId, cvFile, {
      optimiseStatus: 'idle',
      optimiseUpdatedAt: new Date()
    }).catch(() => {});
    clearRegisteredProcess(taskId);
    return;
  }

  await updateBackgroundTask(taskId, userId, {
    status: 'running',
    error: null,
    deviceId,
  });

  // Mettre le status d'optimisation à "inprogress"
  await updateCvFile(userId, cvFile, {
    optimiseStatus: 'inprogress',
  }).catch(err => console.error(`[improveCvJob] Impossible de mettre à jour le status du CV:`, err));

  // Vérifier si annulé
  if (shouldStop || abortController.signal.aborted) {
    console.log(`[improveCvJob] Arrêt détecté avant lecture CV`);
    await updateBackgroundTask(taskId, userId, {
      status: 'cancelled',
      result: null,
      error: null,
    });
    // Réinitialiser le status du CV
    await updateCvFile(userId, cvFile, {
      optimiseStatus: 'idle',
      optimiseUpdatedAt: new Date()
    }).catch(() => {});
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
    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: `CV '${cvFile}' introuvable`,
    });
    await updateCvFile(userId, cvFile, {
      optimiseStatus: 'failed'
    }).catch(() => {});
    clearRegisteredProcess(taskId);
    return;
  }

  // Améliorer le CV
  let result;
  try {
    // Vérifier si annulé avant l'opération longue
    if (shouldStop || abortController.signal.aborted) {
      console.log(`[improveCvJob] Arrêt détecté avant appel OpenAI`);
      throw new Error('Task cancelled');
    }

    // Import dynamique puis appel de la fonction
    const improveCv = await getImproveCv();
    result = await improveCv({
      cvContent,
      jobOfferContent,
      currentScore,
      suggestions,
      signal: abortController.signal,
      userId, // Pour la télémétrie OpenAI
    });

    console.log(`[improveCvJob] Amélioration terminée - ${result.changesMade?.length || 0} modifications`);

    // Vérifier si annulé après l'opération
    if (shouldStop || abortController.signal.aborted) {
      console.log(`[improveCvJob] Arrêt détecté après appel OpenAI`);
      throw new Error('Task cancelled');
    }
  } catch (error) {
    clearRegisteredProcess(taskId);

    // Si c'est une annulation
    if (error.message === 'Task cancelled' || abortController.signal.aborted) {
      console.log(`[improveCvJob] Tâche ${taskId} annulée pendant l'amélioration`);
      await refundFeatureUsage(taskId);
      await updateBackgroundTask(taskId, userId, {
        status: 'cancelled',
        result: null,
        error: null,
      });
      // Réinitialiser le status du CV
      await updateCvFile(userId, cvFile, {
        optimiseStatus: 'idle',
        optimiseUpdatedAt: new Date()
      }).catch(() => {});
      return;
    }

    console.error(`[improveCvJob] Erreur lors de l'amélioration pour la tâche ${taskId}:`, error);
    console.error(`[improveCvJob] Stack trace:`, error.stack);

    const isQuotaExceeded = error.message && /insufficient_quota|exceeded your current quota/i.test(error.message);
    const errorMessage = isQuotaExceeded
      ? "Quota OpenAI dépassé. Vérifiez votre facturation."
      : (error.message || 'Échec lors de l\'amélioration du CV');

    console.error(`[improveCvJob] Message d'erreur retourné: ${errorMessage}`);

    await updateCvFile(userId, cvFile, {
      optimiseStatus: 'failed'
    }).catch(err => console.error(`[improveCvJob] Impossible de mettre à jour le status du CV:`, err));

    // Tracking télémétrie - Erreur
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
    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: errorMessage,
    });
    return;
  }

  // Vérifier une dernière fois avant sauvegarde
  try {
    const taskCheck = await prisma.backgroundTask.findUnique({
      where: { id: taskId },
      select: { status: true }
    });

    if (!taskCheck || taskCheck.status === 'cancelled') {
      console.log(`[improveCvJob] Tâche ${taskId} annulée avant sauvegarde - abandon`);
      // Réinitialiser le status du CV
      await updateCvFile(userId, cvFile, {
        optimiseStatus: 'idle',
        optimiseUpdatedAt: new Date()
      }).catch(() => {});
      clearRegisteredProcess(taskId);
      return;
    }
  } catch (error) {
    console.warn(`[improveCvJob] Erreur vérification status:`, error);
  }

  // Déterminer le nom de fichier à utiliser
  let improvedFilename;
  if (replaceExisting) {
    improvedFilename = cvFile;
  } else {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    improvedFilename = `improved_${timestamp}.json`;
  }

  // Parser le CV original et merger avec les sections modifiées
  const originalCv = JSON.parse(cvContent);
  const modifiedSections = result.modifiedSections;

  // Deep merge des sections modifiées dans le CV original
  const improvedCv = { ...originalCv };

  for (const [section, sectionData] of Object.entries(modifiedSections)) {
    if (typeof sectionData === 'object' && !Array.isArray(sectionData)) {
      // Merge partiel pour les objets (ex: header.current_title)
      improvedCv[section] = {
        ...improvedCv[section],
        ...sectionData
      };
    } else {
      // Remplacement complet pour les arrays et primitives
      improvedCv[section] = sectionData;
    }
  }

  const changesMade = result.changesMade && result.changesMade.length > 0
    ? result.changesMade
    : [
        {
          section: "summary",
          field: "description",
          change: "Contenu optimisé pour l'offre d'emploi",
          reason: "Amélioration automatique basée sur les suggestions"
        },
        {
          section: "skills",
          field: "hard_skills",
          change: "Compétences réorganisées par pertinence",
          reason: "Alignement avec les besoins de l'offre"
        }
      ];

  const modifiedSectionNames = [...new Set(changesMade.map(c => c.section))];

  improvedCv.meta = {
    ...improvedCv.meta,
    improved_from: cvFile,
    improved_at: new Date().toISOString(),
    score_before: currentScore,
    changes_count: changesMade.length,
    changes_made: changesMade,
    modified_sections: modifiedSectionNames
  };

  // Sauvegarde du CV amélioré
  try {
    // Si on remplace le CV existant, créer une version de sauvegarde AVANT modification
    if (replaceExisting) {
      try {
        await createCvVersion(userId, cvFile, 'Avant optimisation IA');
        console.log(`[improveCvJob] Version créée pour ${cvFile} avant optimisation`);
      } catch (versionError) {
        // Ne pas bloquer si la création de version échoue (ex: CV sans content dans DB)
        console.warn(`[improveCvJob] Impossible de créer une version:`, versionError.message);
      }
    }

    await writeUserCvFile(userId, improvedFilename, JSON.stringify(improvedCv, null, 2));
    console.log(`[improveCvJob] CV sauvegardé: ${improvedFilename}`);

    // Récupérer le cvRecord pour avoir extractedJobOffer
    const cvRecord = await prisma.cvFile.findUnique({
      where: {
        userId_filename: { userId, filename: cvFile }
      }
    });

    if (replaceExisting) {
      // Mettre à jour l'entrée existante dans la DB
      await updateCvFile(userId, improvedFilename, {
        optimiseStatus: 'idle',
        optimiseUpdatedAt: new Date(),
        updatedAt: new Date()
      });
    } else {
      // Créer une nouvelle entrée dans la DB
      await createCvFile({
        userId,
        filename: improvedFilename,
        sourceType: cvRecord?.sourceType || 'link',
        sourceValue: cvRecord?.sourceValue || jobOfferUrl,
        createdBy: 'improve-cv',
        analysisLevel: cvRecord?.analysisLevel || null,
        matchScore: null,
        matchScoreUpdatedAt: null,
        scoreBreakdown: null,
        improvementSuggestions: null,
        missingSkills: null,
        matchingSkills: null,
        extractedJobOffer: cvRecord?.extractedJobOffer || null,
        optimiseStatus: 'idle',
        optimiseUpdatedAt: new Date()
      });
    }

    // Vérifier une dernière fois avant de marquer comme completed
    const taskBeforeCompletion = await prisma.backgroundTask.findUnique({
      where: { id: taskId },
      select: { status: true }
    });

    if (!taskBeforeCompletion || taskBeforeCompletion.status === 'cancelled') {
      console.log(`[improveCvJob] Tâche ${taskId} annulée avant completion - abandon`);
      // Réinitialiser le status du CV (le fichier a été sauvegardé mais on garde le status idle)
      await updateCvFile(userId, cvFile, {
        optimiseStatus: 'idle',
        optimiseUpdatedAt: new Date()
      }).catch(() => {});
      clearRegisteredProcess(taskId);
      return;
    }

    clearRegisteredProcess(taskId);

    const changesCount = result.changesMade?.length || 0;
    const successMessage = replaceExisting
      ? `CV remplacé avec ${changesCount} amélioration${changesCount > 1 ? 's' : ''}`
      : `CV amélioré avec ${changesCount} modification${changesCount > 1 ? 's' : ''}`;

    // Tracking télémétrie - Succès
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
        changesMade: result.changesMade,
        changesCount,
        replaced: replaceExisting
      }),
      error: null,
      successMessage
    });

    // ✅ MAINTENANT que la tâche est complétée avec succès, supprimer les données d'analyse
    // pour forcer l'utilisateur à recalculer le score (dans TOUS les cas)
    await updateCvFile(userId, improvedFilename, {
      scoreBreakdown: null,
      improvementSuggestions: null,
      missingSkills: null,
      matchingSkills: null,
      matchScore: null,
      matchScoreUpdatedAt: null,
    });
    console.log(`[improveCvJob] ✅ Données d'analyse et score supprimés pour forcer recalcul du score`);

    console.log(`[improveCvJob] ✅ Amélioration terminée: ${improvedFilename}`);

  } catch (error) {
    clearRegisteredProcess(taskId);

    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: `Impossible de sauvegarder le CV amélioré : ${error.message}`,
    });

    await updateCvFile(userId, cvFile, {
      optimiseStatus: 'failed'
    }).catch(() => {});
  }
}
