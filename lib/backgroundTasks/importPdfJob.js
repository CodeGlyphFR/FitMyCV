import { promises as fs } from "fs";
import { DateTime } from "luxon";

import prisma from "@/lib/prisma";
import { ensureUserCvDir, writeUserCvFile } from "@/lib/cv/storage";
import { enqueueJob } from "@/lib/backgroundTasks/jobQueue";
import { setCvSource } from "@/lib/cv/source";
import { registerAbortController, clearRegisteredProcess } from "@/lib/backgroundTasks/processRegistry";

const DEFAULT_ANALYSIS_LEVEL = "medium";

// Import dynamique pour éviter de charger les modules lourds au démarrage
async function getImportPdfCv() {
  const module = await import("@/lib/openai/importPdf");
  return module.importPdfCv;
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

async function cleanupResources({ uploadDirectory }) {
  try {
    if (uploadDirectory) {
      await fs.rm(uploadDirectory, { recursive: true, force: true });
    }
  } catch (error) {
    console.error("Impossible de nettoyer le dossier temporaire (upload)", error);
  }
}

function deriveFilename() {
  const timestamp = DateTime.now().toFormat('yyyyMMddHHmmssSSS');
  return `${timestamp}.json`;
}

export function scheduleImportPdfJob(jobInput) {
  enqueueJob(() => runImportPdfJob(jobInput));
}

export async function runImportPdfJob({
  taskId,
  user,
  upload,
  analysisLevel,
  requestedModel,
  deviceId,
}) {
  const userId = user.id;

  console.log(`[importPdfJob] starting job ${taskId} for user ${userId}`);

  try {
    const record = await prisma.backgroundTask.findUnique({ where: { id: taskId } });
    if (!record || record.status === 'cancelled') {
      await cleanupResources({ uploadDirectory: upload.directory });
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
    await cleanupResources({ uploadDirectory: upload.directory });
    await updateBackgroundTask(taskId, userId, {
      status: 'cancelled',
      result: null,
      error: null,
    });
    clearRegisteredProcess(taskId);
    return;
  }

  const pdfFilePath = upload.saved?.path;
  if (!pdfFilePath) {
    await cleanupResources({ uploadDirectory: upload.directory });
    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: 'Chemin du fichier PDF manquant',
    });
    return;
  }

  try {
    // Vérifier que le fichier existe
    await fs.access(pdfFilePath);
  } catch (error) {
    await cleanupResources({ uploadDirectory: upload.directory });
    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: `Fichier PDF introuvable : ${pdfFilePath}`,
    });
    return;
  }

  let cvContent;
  try {
    // Vérifier si annulé avant l'opération longue
    if (abortController.signal.aborted) {
      throw new Error('Task cancelled');
    }

    // Import dynamique puis appel de la fonction
    const importPdfCv = await getImportPdfCv();
    cvContent = await importPdfCv({
      pdfFilePath,
      analysisLevel: analysisLevel || DEFAULT_ANALYSIS_LEVEL,
      requestedModel,
      signal: abortController.signal, // Passer le signal pour annulation
    });

    // Vérifier si annulé après l'opération
    if (abortController.signal.aborted) {
      throw new Error('Task cancelled');
    }
  } catch (error) {
    await cleanupResources({ uploadDirectory: upload.directory });
    clearRegisteredProcess(taskId);

    // Si c'est une annulation
    if (error.message === 'Task cancelled' || abortController.signal.aborted) {
      console.log(`[importPdfJob] Tâche ${taskId} annulée`);
      await updateBackgroundTask(taskId, userId, {
        status: 'cancelled',
        result: null,
        error: null,
      });
      return;
    }

    console.error(`[importPdfJob] Erreur lors de l'import PDF pour la tâche ${taskId}:`, error);
    console.error(`[importPdfJob] Stack trace:`, error.stack);

    const isQuotaExceeded = error.message && /insufficient_quota|exceeded your current quota/i.test(error.message);
    const errorMessage = isQuotaExceeded
      ? "Quota OpenAI dépassé. Vérifiez votre facturation."
      : (error.message || 'Échec lors de l\'import du PDF');

    console.error(`[importPdfJob] Message d'erreur retourné: ${errorMessage}`);

    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: errorMessage,
    });
    return;
  }

  // Génération du nom de fichier
  const filename = deriveFilename();

  // Sauvegarde du CV
  try {
    await writeUserCvFile(userId, filename, cvContent);

    await prisma.cvFile.upsert({
      where: { userId_filename: { userId, filename } },
      update: {},
      create: { userId, filename },
    });

    // Enregistrer la source PDF
    const pdfFileName = upload.saved?.name || upload.name;
    if (pdfFileName) {
      try {
        await setCvSource(userId, filename, 'pdf', pdfFileName, 'import-pdf', analysisLevel);
      } catch (sourceError) {
        console.error(`Impossible d'enregistrer la source pour ${filename}:`, sourceError);
      }
    }

    console.log(`[importPdfJob] CV importé avec succès : ${filename}`);

    await cleanupResources({ uploadDirectory: upload.directory });
    clearRegisteredProcess(taskId);

    await updateBackgroundTask(taskId, userId, {
      status: 'completed',
      result: JSON.stringify({ files: [filename] }),
      error: null,
    });
  } catch (error) {
    await cleanupResources({ uploadDirectory: upload.directory });
    clearRegisteredProcess(taskId);

    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: `Impossible de sauvegarder le CV : ${error.message}`,
    });
  }
}
