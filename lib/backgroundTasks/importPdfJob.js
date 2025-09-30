import { promises as fs } from "fs";
import path from "path";
import { DateTime } from "luxon";

import prisma from "@/lib/prisma";
import { ensureUserCvDir, writeUserCvFile } from "@/lib/cv/storage";
import { enqueueJob } from "@/lib/backgroundTasks/jobQueue";
import { setCvSource } from "@/lib/cv/source";
import { importPdfCv } from "@/lib/openai/importPdf";

const DEFAULT_ANALYSIS_LEVEL = "medium";

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

  await updateBackgroundTask(taskId, userId, {
    status: 'running',
    error: null,
    deviceId,
  });

  await ensureUserCvDir(userId);

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
    // Appel de la fonction JavaScript d'import PDF
    cvContent = await importPdfCv({
      pdfFilePath,
      analysisLevel: analysisLevel || DEFAULT_ANALYSIS_LEVEL,
      requestedModel,
    });
  } catch (error) {
    console.error(`[importPdfJob] Erreur lors de l'import PDF pour la tâche ${taskId}:`, error);
    console.error(`[importPdfJob] Stack trace:`, error.stack);

    await cleanupResources({ uploadDirectory: upload.directory });

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
        await setCvSource(userId, filename, 'pdf', pdfFileName);
      } catch (sourceError) {
        console.error(`Impossible d'enregistrer la source pour ${filename}:`, sourceError);
      }
    }

    console.log(`[importPdfJob] CV importé avec succès : ${filename}`);

    await cleanupResources({ uploadDirectory: upload.directory });

    await updateBackgroundTask(taskId, userId, {
      status: 'completed',
      result: JSON.stringify({ files: [filename] }),
      error: null,
    });
  } catch (error) {
    await cleanupResources({ uploadDirectory: upload.directory });

    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: `Impossible de sauvegarder le CV : ${error.message}`,
    });
  }
}
