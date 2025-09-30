import { promises as fs } from "fs";
import { DateTime } from "luxon";

import prisma from "@/lib/prisma";
import { ensureUserCvDir, readUserCvFile, writeUserCvFile } from "@/lib/cv/storage";
import { enqueueJob } from "@/lib/backgroundTasks/jobQueue";
import { setCvSource } from "@/lib/cv/source";
import { registerAbortController, clearRegisteredProcess } from "@/lib/backgroundTasks/processRegistry";

const DEFAULT_ANALYSIS_LEVEL = "medium";

// Import dynamique pour éviter de charger les modules lourds au démarrage
async function getGenerateCv() {
  const module = await import("@/lib/openai/generateCv");
  return module.generateCv;
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

function sanitizeLabel(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.slice(0, 200);
}

async function cleanupResources({ uploadDirectory, tempUploads }) {
  try {
    if (uploadDirectory) {
      await fs.rm(uploadDirectory, { recursive: true, force: true });
    }
  } catch (error) {
    console.error("Impossible de nettoyer le dossier temporaire (uploads)", error);
  }

  if (tempUploads?.length) {
    for (const file of tempUploads) {
      try {
        await fs.rm(file.path, { force: true });
      } catch (error) {}
    }
  }
}

function deriveBaseName(index) {
  const timestamp = DateTime.now().toFormat('yyyyMMddHHmmssSSS');
  if (index === 0) {
    return `${timestamp}.json`;
  }
  return `${timestamp}-${index + 1}.json`;
}

export function scheduleGenerateCvJob(jobInput) {
  enqueueJob(() => runGenerateCvJob(jobInput));
}

export async function runGenerateCvJob({
  taskId,
  user,
  payload,
  deviceId,
}) {
  const userId = user.id;

  console.log(`[generateCvJob] starting job ${taskId} for user ${userId}`);

  try {
    const record = await prisma.backgroundTask.findUnique({ where: { id: taskId } });
    if (!record || record.status === 'cancelled') {
      await cleanupResources({ uploadDirectory: payload.uploadDirectory, tempUploads: payload.uploads });
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
    await cleanupResources({ uploadDirectory: payload.uploadDirectory, tempUploads: payload.uploads });
    await updateBackgroundTask(taskId, userId, {
      status: 'cancelled',
      result: null,
      error: null,
    });
    clearRegisteredProcess(taskId);
    return;
  }

  const referenceFile = (payload.baseFile || '').trim();
  if (!referenceFile) {
    await cleanupResources({ uploadDirectory: payload.uploadDirectory, tempUploads: payload.uploads });
    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: 'Aucun CV de référence spécifié',
    });
    return;
  }

  let referenceContent = null;
  try {
    referenceContent = await readUserCvFile(userId, referenceFile);
  } catch (error) {
    console.error(`Impossible de lire le CV de référence ${referenceFile}:`, error);
  }

  if (!referenceContent) {
    await cleanupResources({ uploadDirectory: payload.uploadDirectory, tempUploads: payload.uploads });
    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: `CV de référence '${referenceFile}' introuvable`,
    });
    return;
  }

  const analysisLevel = payload.analysisLevel || DEFAULT_ANALYSIS_LEVEL;

  // Préparation des fichiers joints
  const files = (payload.uploads || []).map(file => ({
    path: file.path,
    name: file.name,
    size: file.size,
    type: file.type,
  }));

  let generatedContents;
  try {
    // Vérifier si annulé avant l'opération longue
    if (abortController.signal.aborted) {
      throw new Error('Task cancelled');
    }

    // Import dynamique puis appel de la fonction
    const generateCv = await getGenerateCv();
    generatedContents = await generateCv({
      mainCvContent: referenceContent,
      referenceFile,
      links: payload.links || [],
      files,
      analysisLevel,
      requestedModel: payload.model,
      signal: abortController.signal, // Passer le signal pour annulation
    });

    // Vérifier si annulé après l'opération
    if (abortController.signal.aborted) {
      throw new Error('Task cancelled');
    }
  } catch (error) {
    await cleanupResources({ uploadDirectory: payload.uploadDirectory, tempUploads: payload.uploads });
    clearRegisteredProcess(taskId);

    // Si c'est une annulation
    if (error.message === 'Task cancelled' || abortController.signal.aborted) {
      console.log(`[generateCvJob] Tâche ${taskId} annulée`);
      await updateBackgroundTask(taskId, userId, {
        status: 'cancelled',
        result: null,
        error: null,
      });
      return;
    }

    console.error(`[generateCvJob] Erreur lors de la génération de CV pour la tâche ${taskId}:`, error);
    console.error(`[generateCvJob] Stack trace:`, error.stack);

    const isQuotaExceeded = error.message && /insufficient_quota|exceeded your current quota/i.test(error.message);
    const errorMessage = isQuotaExceeded
      ? "Quota OpenAI dépassé. Vérifiez votre facturation."
      : (error.message || 'Échec lors de la génération du CV');

    console.error(`[generateCvJob] Message d'erreur retourné: ${errorMessage}`);

    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: errorMessage,
    });
    return;
  }

  // Sauvegarde des CV générés
  const createdFiles = [];
  for (let i = 0; i < generatedContents.length; i++) {
    const content = generatedContents[i];
    const filename = deriveBaseName(i);

    try {
      // Enrichissement avec métadonnées
      let enriched = content;
      try {
        const parsed = JSON.parse(content);
        const isoNow = new Date().toISOString();
        const nextMeta = {
          ...(parsed.meta || {}),
          generator: "chatgpt",
          source: "chatgpt",
          updated_at: isoNow,
        };
        if (!nextMeta.created_at) nextMeta.created_at = isoNow;
        parsed.meta = nextMeta;
        enriched = JSON.stringify(parsed, null, 2);
      } catch (metaError) {
        console.error(`Impossible d'enrichir ${filename} avec les métadonnées`, metaError);
      }

      await writeUserCvFile(userId, filename, enriched);
      createdFiles.push(filename);

      await prisma.cvFile.upsert({
        where: { userId_filename: { userId, filename } },
        update: {},
        create: { userId, filename },
      });

      // Enregistrer la source
      const sourceUrl = Array.isArray(payload.links) && payload.links.length > 0 ? payload.links[i] || payload.links[0] : null;
      const sourceUpload = Array.isArray(payload.uploads) && payload.uploads.length > 0 ? payload.uploads[0].name : null;

      if (sourceUrl) {
        try {
          await setCvSource(userId, filename, 'link', sourceUrl, 'generate-cv', analysisLevel);
        } catch (sourceError) {
          console.error(`Impossible d'enregistrer la source pour ${filename}:`, sourceError);
        }
      } else if (sourceUpload) {
        try {
          await setCvSource(userId, filename, 'pdf', sourceUpload, 'generate-cv', analysisLevel);
        } catch (sourceError) {
          console.error(`Impossible d'enregistrer la source pour ${filename}:`, sourceError);
        }
      }

      console.log(`[generateCvJob] CV généré avec succès : ${filename}`);
    } catch (error) {
      console.error(`Impossible de persister ${filename}`, error);
    }
  }

  await cleanupResources({ uploadDirectory: payload.uploadDirectory, tempUploads: payload.uploads });
  clearRegisteredProcess(taskId);

  await updateBackgroundTask(taskId, userId, {
    status: 'completed',
    result: JSON.stringify({ files: createdFiles }),
    error: null,
  });
}

export function buildGenerateCvPayload({
  links,
  baseFile,
  baseFileLabel,
  analysisLevel,
  model,
  uploads,
}) {
  return {
    links,
    baseFile,
    baseFileLabel: sanitizeLabel(baseFileLabel),
    analysisLevel: analysisLevel || DEFAULT_ANALYSIS_LEVEL,
    model,
    uploads: uploads.map(file => ({
      path: file.path,
      name: file.name,
      size: file.size,
      type: file.type,
    })),
  };
}
