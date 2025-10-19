import { promises as fs } from "fs";
import path from "path";
import { DateTime } from "luxon";

import prisma from "@/lib/prisma";
import { ensureUserCvDir, readUserCvFile, writeUserCvFile, getUserCvDir } from "@/lib/cv/storage";
import { enqueueJob } from "@/lib/backgroundTasks/jobQueue";
import { setCvSource } from "@/lib/cv/source";
import { registerAbortController, clearRegisteredProcess } from "@/lib/backgroundTasks/processRegistry";
import { updateBackgroundTask } from "@/lib/events/prismaWithEvents";
import { trackCvGeneration } from "@/lib/telemetry/server";

const DEFAULT_ANALYSIS_LEVEL = "medium";

// Import dynamique pour éviter de charger les modules lourds au démarrage
async function getGenerateCv() {
  const module = await import("@/lib/openai/generateCv");
  return module.generateCv;
}

function sanitizeLabel(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.slice(0, 200);
}

function validateCvContent(content) {
  try {
    const parsed = JSON.parse(content);
    const header = parsed?.header || {};
    const fullName = (header.full_name || "").trim();
    const currentTitle = (header.current_title || "").trim();

    // Le CV doit avoir au moins un nom ET un titre de poste
    return fullName.length > 0 && currentTitle.length > 0;
  } catch (error) {
    console.error("Erreur lors de la validation du CV:", error);
    return false;
  }
}

async function deleteCvFile(userId, filename) {
  try {
    const cvDir = getUserCvDir(userId);
    const filePath = path.join(cvDir, filename);
    await fs.unlink(filePath);
    console.log(`[generateCvJob] Fichier supprimé : ${filename}`);
  } catch (error) {
    console.error(`Erreur lors de la suppression du fichier ${filename}:`, error);
  }

  try {
    await prisma.cvFile.deleteMany({
      where: { userId, filename }
    });
    await prisma.cvSource.deleteMany({
      where: { userId, filename }
    });
    console.log(`[generateCvJob] Entrées DB supprimées pour : ${filename}`);
  } catch (error) {
    console.error(`Erreur lors de la suppression des entrées DB pour ${filename}:`, error);
  }
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
  const startTime = Date.now();

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

  let results;
  try {
    // Vérifier si annulé avant l'opération longue
    if (abortController.signal.aborted) {
      throw new Error('Task cancelled');
    }

    // Import dynamique puis appel de la fonction
    const generateCv = await getGenerateCv();
    results = await generateCv({
      mainCvContent: referenceContent,
      referenceFile,
      links: payload.links || [],
      files,
      analysisLevel,
      requestedModel: payload.model,
      signal: abortController.signal, // Passer le signal pour annulation
      userId, // Pour la télémétrie OpenAI
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

    // Tracking télémétrie - Erreur
    const duration = Date.now() - startTime;
    const sourceType = (payload.links && payload.links.length > 0) ? 'link' : 'pdf';
    const sourceCount = (payload.links?.length || 0) + (payload.uploads?.length || 0);

    try {
      await trackCvGeneration({
        userId,
        deviceId: deviceId || null,
        sessionId: null,
        analysisLevel: analysisLevel,
        sourceType,
        sourceCount,
        duration,
        status: 'error',
        error: errorMessage,
      });
    } catch (trackError) {
      console.error('[generateCvJob] Erreur tracking télémétrie:', trackError);
    }

    return;
  }

  // Sauvegarde des CV générés
  const createdFiles = [];
  let hasEmptyCv = false;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const filename = deriveBaseName(i);

    try {
      // Enrichissement avec métadonnées
      let enriched = result.cvContent;
      try {
        const parsed = JSON.parse(result.cvContent);
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

      // Valider le contenu avant de sauvegarder
      if (!validateCvContent(enriched)) {
        console.warn(`[generateCvJob] CV vide détecté : ${filename}`);
        hasEmptyCv = true;
        continue;
      }

      await writeUserCvFile(userId, filename, enriched);
      createdFiles.push(filename);

      await prisma.cvFile.upsert({
        where: { userId_filename: { userId, filename } },
        update: {
          extractedJobOffer: result.extractedJobOffer || null,
        },
        create: {
          userId,
          filename,
          extractedJobOffer: result.extractedJobOffer || null,
        },
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

      // Tracking télémétrie - Succès pour ce CV
      const duration = Date.now() - startTime;
      const sourceType = sourceUrl ? 'link' : (sourceUpload ? 'pdf' : null);

      try {
        await trackCvGeneration({
          userId,
          deviceId: deviceId || null,
          sessionId: null,
          analysisLevel: analysisLevel,
          sourceType: sourceType || 'link',
          sourceCount: 1,
          duration,
          status: 'success',
        });
      } catch (trackError) {
        console.error('[generateCvJob] Erreur tracking télémétrie:', trackError);
      }
    } catch (error) {
      console.error(`Impossible de persister ${filename}`, error);
    }
  }

  await cleanupResources({ uploadDirectory: payload.uploadDirectory, tempUploads: payload.uploads });
  clearRegisteredProcess(taskId);

  // Si tous les CV générés sont vides, marquer la tâche comme échouée
  if (hasEmptyCv && createdFiles.length === 0) {
    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: 'Aucun contenu type CV détecté.',
    });
    return;
  }

  await updateBackgroundTask(taskId, userId, {
    status: 'completed',
    result: JSON.stringify({ files: createdFiles }),
    error: null,
  });
}

