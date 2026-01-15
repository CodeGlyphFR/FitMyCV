import { DateTime } from "luxon";

import prisma from "@/lib/prisma";
import { ensureUserCvDir, writeUserCvFile } from "@/lib/cv/storage";
import { enqueueJob } from "@/lib/backgroundTasks/jobQueue";
import { setCvSource } from "@/lib/cv/source";
import { registerAbortController, clearRegisteredProcess } from "@/lib/backgroundTasks/processRegistry";
import { updateBackgroundTask } from "@/lib/events/prismaWithEvents";
import { trackCvGenerationFromJobTitle } from "@/lib/telemetry/server";
import { refundFeatureUsage } from "@/lib/subscription/featureUsage";

// Import dynamique pour éviter de charger les modules lourds au démarrage
async function getGenerateCvFromJobTitle() {
  const module = await import("@/lib/openai/generateCvFromJobTitle");
  return module.generateCvFromJobTitle;
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

function deriveBaseName() {
  const timestamp = DateTime.now().toFormat('yyyyMMddHHmmssSSS');
  return `${timestamp}.json`;
}

export function scheduleGenerateCvFromJobTitleJob(jobInput) {
  enqueueJob(() => runGenerateCvFromJobTitleJob(jobInput));
}

export async function runGenerateCvFromJobTitleJob({
  taskId,
  user,
  payload,
  deviceId,
}) {
  const userId = user.id;
  const startTime = Date.now();

  console.log(`[generateCvFromJobTitleJob] starting job ${taskId} for user ${userId}`);

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

  const jobTitle = payload.jobTitle;
  const language = payload.language || 'français';

  if (!jobTitle || typeof jobTitle !== 'string' || !jobTitle.trim()) {
    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: 'Titre de poste manquant',
    });
    clearRegisteredProcess(taskId);
    return;
  }

  let generatedContent;
  try {
    // Vérifier si annulé avant l'opération longue
    if (abortController.signal.aborted) {
      throw new Error('Task cancelled');
    }

    // Import dynamique puis appel de la fonction
    const generateCvFromJobTitle = await getGenerateCvFromJobTitle();
    generatedContent = await generateCvFromJobTitle({
      jobTitle: jobTitle.trim(),
      language,
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
      console.log(`[generateCvFromJobTitleJob] Tâche ${taskId} annulée`);
      await refundFeatureUsage(taskId);
      await updateBackgroundTask(taskId, userId, {
        status: 'cancelled',
        result: null,
        error: null,
      });
      return;
    }

    console.error(`[generateCvFromJobTitleJob] Erreur lors de la génération de CV pour la tâche ${taskId}:`, error);
    console.error(`[generateCvFromJobTitleJob] Stack trace:`, error.stack);

    const isQuotaExceeded = error.message && /insufficient_quota|exceeded your current quota/i.test(error.message);
    const isInvalidTitle = error.message && /titre de poste.*invalide|ne semble pas être un poste/i.test(error.message);

    let errorMessage;
    if (isQuotaExceeded) {
      errorMessage = "Quota OpenAI dépassé. Vérifiez votre facturation.";
    } else if (isInvalidTitle) {
      errorMessage = `"${jobTitle}" ne semble pas être un titre de poste valide.`;
    } else {
      errorMessage = error.message || 'Échec lors de la génération du CV';
    }

    console.error(`[generateCvFromJobTitleJob] Message d'erreur retourné: ${errorMessage}`);

    await refundFeatureUsage(taskId);
    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: errorMessage,
    });

    // Tracking télémétrie - Erreur
    const duration = Date.now() - startTime;
    try {
      await trackCvGenerationFromJobTitle({
        userId,
        deviceId: deviceId || null,
        sourceType: 'job-title',
        sourceCount: 1,
        duration,
        status: 'error',
        error: errorMessage,
      });
    } catch (trackError) {
      console.error('[generateCvFromJobTitleJob] Erreur tracking télémétrie:', trackError);
    }

    return;
  }

  // Sauvegarde du CV généré
  const filename = deriveBaseName();

  try {
    // Enrichissement avec métadonnées
    let enriched = generatedContent;
    try {
      const parsed = JSON.parse(generatedContent);
      const isoNow = new Date().toISOString();
      const nextMeta = {
        ...(parsed.meta || {}),
        generator: "chatgpt",
        source: "chatgpt-job-title",
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
      console.warn(`[generateCvFromJobTitleJob] CV vide détecté : ${filename}`);
      await updateBackgroundTask(taskId, userId, {
        status: 'failed',
        result: null,
        error: 'Aucun contenu type CV détecté.',
      });
      clearRegisteredProcess(taskId);
      return;
    }

    // Normaliser la langue (stockée en DB, pas dans le JSON)
    let normalizedLanguage = null;
    try {
      const { normalizeLanguageInput } = await import('@/lib/cv/languageConstants');
      normalizedLanguage = normalizeLanguageInput(language);
      console.log(`[generateCvFromJobTitleJob] Langue: ${normalizedLanguage}`);
    } catch (langError) {
      console.error('[generateCvFromJobTitleJob] Erreur normalisation langue (non-bloquant):', langError.message);
    }

    await writeUserCvFile(userId, filename, enriched);

    // Stocker métadonnées en DB (langue incluse)
    await prisma.cvFile.upsert({
      where: { userId_filename: { userId, filename } },
      update: {
        language: normalizedLanguage,
      },
      create: {
        userId,
        filename,
        createdBy: 'generate-cv-job-title',
        language: normalizedLanguage,
      },
    });

    // Enregistrer la source (le titre de poste)
    try {
      await setCvSource(userId, filename, 'job-title', jobTitle, 'generate-cv-job-title');
    } catch (sourceError) {
      console.error(`Impossible d'enregistrer la source pour ${filename}:`, sourceError);
    }

    console.log(`[generateCvFromJobTitleJob] CV généré avec succès : ${filename}`);

    // Tracking télémétrie - Succès
    const duration = Date.now() - startTime;
    try {
      await trackCvGenerationFromJobTitle({
        userId,
        deviceId: deviceId || null,
        sourceType: 'job-title',
        sourceCount: 1,
        duration,
        status: 'success',
      });
    } catch (trackError) {
      console.error('[generateCvFromJobTitleJob] Erreur tracking télémétrie:', trackError);
    }
  } catch (error) {
    console.error(`Impossible de persister ${filename}`, error);
    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: 'Impossible de sauvegarder le CV généré',
    });
    clearRegisteredProcess(taskId);
    return;
  }

  clearRegisteredProcess(taskId);

  await updateBackgroundTask(taskId, userId, {
    status: 'completed',
    result: JSON.stringify({ file: filename }),
    error: null,
  });
}

