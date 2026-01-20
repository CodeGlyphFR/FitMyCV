import { DateTime } from "luxon";
import prisma from "@/lib/prisma";
import { ensureUserCvDir, readUserCvFile, writeUserCvFile } from "@/lib/cv-core/storage";
import { enqueueJob } from "@/lib/background-jobs/jobQueue";
import { registerAbortController, clearRegisteredProcess } from "@/lib/background-jobs/processRegistry";
import { updateBackgroundTask, updateCvFile } from "@/lib/events/prismaWithEvents";
import { trackEvent, EventTypes } from "@/lib/telemetry/server";
import { refundFeatureUsage } from "@/lib/subscription/featureUsage";

// Import dynamique pour éviter de charger les modules lourds au démarrage
async function getTranslateCv() {
  const module = await import("@/lib/translation/service");
  return module.translateCv;
}

function deriveTranslatedFilename() {
  const timestamp = DateTime.now().toFormat('yyyyMMddHHmmssSSS');
  return `${timestamp}.json`;
}

export function scheduleTranslateCvJob(jobInput) {
  enqueueJob(() => runTranslateCvJob(jobInput));
}

export async function runTranslateCvJob({
  taskId,
  user,
  sourceFile,
  targetLanguage,
  deviceId,
}) {
  const userId = user.id;
  const startTime = Date.now();

  console.log(`[translateCvJob] starting job ${taskId} for user ${userId}`);

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

  await ensureUserCvDir(userId);

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

  // Lire le CV source
  let cvContent;
  try {
    cvContent = await readUserCvFile(userId, sourceFile);
  } catch (error) {
    console.error(`[translateCvJob] Impossible de lire le CV source ${sourceFile}:`, error);
    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: `CV source '${sourceFile}' introuvable`,
    });
    clearRegisteredProcess(taskId);
    return;
  }

  let translatedContent;
  try {
    // Vérifier si annulé avant l'opération longue
    if (abortController.signal.aborted) {
      throw new Error('Task cancelled');
    }

    // Import dynamique puis appel de la fonction
    const translateCv = await getTranslateCv();
    translatedContent = await translateCv({
      cvContent,
      targetLanguage,
      signal: abortController.signal,
      userId, // Pour la télémétrie OpenAI
    });

    // Vérifier si annulé après l'opération
    if (abortController.signal.aborted) {
      throw new Error('Task cancelled');
    }
  } catch (error) {
    clearRegisteredProcess(taskId);

    // Si c'est une annulation
    if (error.message === 'Task cancelled' || abortController.signal.aborted) {
      console.log(`[translateCvJob] Tâche ${taskId} annulée`);
      await refundFeatureUsage(taskId);
      await updateBackgroundTask(taskId, userId, {
        status: 'cancelled',
        result: null,
        error: null,
      });
      return;
    }

    console.error(`[translateCvJob] Erreur lors de la traduction pour la tâche ${taskId}:`, error);
    console.error(`[translateCvJob] Stack trace:`, error.stack);

    const isQuotaExceeded = error.message && /insufficient_quota|exceeded your current quota/i.test(error.message);
    const errorMessage = isQuotaExceeded
      ? "Quota OpenAI dépassé. Vérifiez votre facturation."
      : (error.message || 'Échec lors de la traduction du CV');

    console.error(`[translateCvJob] Message d'erreur retourné: ${errorMessage}`);

    await refundFeatureUsage(taskId);
    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: errorMessage,
    });

    // Tracking télémétrie - Erreur
    const duration = Date.now() - startTime;
    try {
      await trackEvent({
        type: EventTypes.CV_TRANSLATED,
        userId,
        deviceId: deviceId || null,
        metadata: {
          targetLanguage,
          sourceFile,
        },
        duration,
        status: 'error',
        error: errorMessage,
      });
    } catch (trackError) {
      console.error('[translateCvJob] Erreur tracking télémétrie:', trackError);
    }

    return;
  }

  // Récupérer les métadonnées du CV source
  let sourceCvData = null;
  try {
    sourceCvData = await prisma.cvFile.findUnique({
      where: { userId_filename: { userId, filename: sourceFile } },
      select: {
        sourceType: true,
        sourceValue: true,
        createdBy: true,
        jobOfferId: true, // Conservé pour permettre le recalcul du score
      },
    });
  } catch (error) {
    console.warn(`[translateCvJob] Impossible de récupérer les métadonnées du CV source:`, error);
  }

  // Génération du nom de fichier pour la traduction
  const filename = deriveTranslatedFilename();

  // Nettoyer les métadonnées d'amélioration dans le CV traduit
  let cvData;
  try {
    cvData = JSON.parse(translatedContent);

    // Supprimer les métadonnées liées à l'amélioration précédente
    if (cvData.meta) {
      delete cvData.meta.improved_from;
      delete cvData.meta.improved_at;
      delete cvData.meta.score_before;
      delete cvData.meta.score_estimate;
      delete cvData.meta.changes_count;
      delete cvData.meta.changes_made;
      delete cvData.meta.modified_sections;

      console.log('[translateCvJob] Métadonnées d\'amélioration supprimées du CV traduit');
    }

    // Langue stockée en DB (CvFile.language), pas dans le JSON
    console.log(`[translateCvJob] Langue cible: ${targetLanguage}`);

    // Reconvertir en JSON
    translatedContent = JSON.stringify(cvData, null, 2);
  } catch (error) {
    console.warn('[translateCvJob] Impossible de parser le CV pour nettoyer les métadonnées:', error);
    // Continuer avec le contenu tel quel
  }

  // Sauvegarde du CV traduit
  try {
    await writeUserCvFile(userId, filename, translatedContent);

    // Créer l'entrée dans la base de données avec la langue cible
    // NOTE: writeUserCvFile() crée déjà l'entrée CvFile, donc on fait toujours un UPDATE ici
    // Il faut donc mettre à jour TOUS les attributs importants dans update, pas seulement dans create
    await prisma.cvFile.upsert({
      where: { userId_filename: { userId, filename } },
      update: {
        language: targetLanguage,
        createdBy: 'translate-cv',
        originalCreatedBy: sourceCvData?.createdBy || null,
        isTranslated: true,
        sourceType: sourceCvData?.sourceType || null,
        sourceValue: sourceCvData?.sourceValue || null,
        jobOfferId: sourceCvData?.jobOfferId || null,
        // Réinitialiser les données d'analyse
        matchScore: null,
        matchScoreUpdatedAt: null,
        matchScoreStatus: null,
        scoreBreakdown: null,
        improvementSuggestions: null,
        missingSkills: null,
        matchingSkills: null,
        optimiseStatus: null,
        optimiseUpdatedAt: null,
      },
      create: {
        userId,
        filename,
        sourceType: sourceCvData?.sourceType || null,
        sourceValue: sourceCvData?.sourceValue || null,
        createdBy: 'translate-cv',
        originalCreatedBy: sourceCvData?.createdBy || null, // Conserver le createdBy original pour l'icône
        isTranslated: true,
        language: targetLanguage, // Langue cible de la traduction
        // Conserver uniquement jobOfferId pour permettre le recalcul du score
        jobOfferId: sourceCvData?.jobOfferId || null,
        // Réinitialiser toutes les données d'analyse (score, suggestions, etc.)
        // L'utilisateur devra recalculer le score dans la langue du CV traduit
        matchScore: null,
        matchScoreUpdatedAt: null,
        matchScoreStatus: null,
        scoreBreakdown: null,
        improvementSuggestions: null,
        missingSkills: null,
        matchingSkills: null,
        optimiseStatus: null,
        optimiseUpdatedAt: null,
      },
    });

    console.log(`[translateCvJob] CV traduit avec succès : ${filename}`);

    // Tracking télémétrie - Succès
    const duration = Date.now() - startTime;
    try {
      await trackEvent({
        type: EventTypes.CV_TRANSLATED,
        userId,
        deviceId: deviceId || null,
        metadata: {
          targetLanguage,
          sourceFile,
        },
        duration,
        status: 'success',
      });
    } catch (trackError) {
      console.error('[translateCvJob] Erreur tracking télémétrie:', trackError);
    }

    clearRegisteredProcess(taskId);

    await updateBackgroundTask(taskId, userId, {
      status: 'completed',
      result: JSON.stringify({ files: [filename] }),
      error: null,
    });
  } catch (error) {
    clearRegisteredProcess(taskId);

    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: `Impossible de sauvegarder le CV traduit : ${error.message}`,
    });
  }
}
