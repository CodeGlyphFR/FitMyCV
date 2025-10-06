import { DateTime } from "luxon";
import prisma from "@/lib/prisma";
import { ensureUserCvDir, readUserCvFile, writeUserCvFile } from "@/lib/cv/storage";
import { enqueueJob } from "@/lib/backgroundTasks/jobQueue";
import { registerAbortController, clearRegisteredProcess } from "@/lib/backgroundTasks/processRegistry";

// Import dynamique pour éviter de charger les modules lourds au démarrage
async function getTranslateCv() {
  const module = await import("@/lib/openai/translateCv");
  return module.translateCv;
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

    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: errorMessage,
    });
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
        analysisLevel: true,
        createdBy: true,
        extractedJobOffer: true, // Conservé pour permettre le recalcul du score
      },
    });
  } catch (error) {
    console.warn(`[translateCvJob] Impossible de récupérer les métadonnées du CV source:`, error);
  }

  // Génération du nom de fichier pour la traduction
  const filename = deriveTranslatedFilename();

  // Sauvegarde du CV traduit
  try {
    await writeUserCvFile(userId, filename, translatedContent);

    // Créer l'entrée dans la base de données en héritant des métadonnées du CV source
    await prisma.cvFile.upsert({
      where: { userId_filename: { userId, filename } },
      update: {},
      create: {
        userId,
        filename,
        sourceType: sourceCvData?.sourceType || null,
        sourceValue: sourceCvData?.sourceValue || null,
        createdBy: 'translate-cv',
        originalCreatedBy: sourceCvData?.createdBy || null, // Conserver le createdBy original pour l'icône
        analysisLevel: sourceCvData?.analysisLevel || null,
        isTranslated: true,
        // Conserver uniquement extractedJobOffer pour permettre le recalcul du score
        extractedJobOffer: sourceCvData?.extractedJobOffer || null,
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
