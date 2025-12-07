import { promises as fs } from "fs";
import { DateTime } from "luxon";

import prisma from "@/lib/prisma";
import { ensureUserCvDir, writeUserCvFile } from "@/lib/cv/storage";
import { enqueueJob } from "@/lib/backgroundTasks/jobQueue";
import { setCvSource } from "@/lib/cv/source";
import { registerAbortController, clearRegisteredProcess } from "@/lib/backgroundTasks/processRegistry";
import { updateBackgroundTask, updateCvFile } from "@/lib/events/prismaWithEvents";
import { trackCvTemplateCreationFromUrl, trackCvTemplateCreationFromPdf } from "@/lib/telemetry/server";
import { refundFeatureUsage } from "@/lib/subscription/featureUsage";

// Import dynamique pour éviter de charger les modules lourds au démarrage
async function getCreateTemplateCv() {
  const module = await import("@/lib/openai/createTemplateCv");
  return module.createTemplateCv;
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

export function scheduleCreateTemplateCvJob(jobInput) {
  enqueueJob(() => runCreateTemplateCvJob(jobInput));
}

export async function runCreateTemplateCvJob({
  taskId,
  user,
  payload,
  deviceId,
}) {
  const userId = user.id;
  const startTime = Date.now();

  console.log(`[createTemplateCvJob] starting job ${taskId} for user ${userId}`);

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
    const createTemplateCv = await getCreateTemplateCv();
    generatedContents = await createTemplateCv({
      links: payload.links || [],
      files,
      signal: abortController.signal,
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
      console.log(`[createTemplateCvJob] Tâche ${taskId} annulée`);
      await refundFeatureUsage(taskId);
      await updateBackgroundTask(taskId, userId, {
        status: 'cancelled',
        result: null,
        error: null,
      });
      return;
    }

    console.error(`[createTemplateCvJob] Erreur lors de la création de CV modèle pour la tâche ${taskId}:`, error);
    console.error(`[createTemplateCvJob] Stack trace:`, error.stack);

    const isQuotaExceeded = error.message && /insufficient_quota|exceeded your current quota/i.test(error.message);
    const errorMessage = isQuotaExceeded
      ? "Quota OpenAI dépassé. Vérifiez votre facturation."
      : (error.message || 'Échec lors de la création du CV modèle');

    console.error(`[createTemplateCvJob] Message d'erreur retourné: ${errorMessage}`);

    await refundFeatureUsage(taskId);
    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: errorMessage,
    });

    // Tracking télémétrie - Erreur
    const duration = Date.now() - startTime;
    const sourceType = (payload.links && payload.links.length > 0) ? 'link' : 'pdf';
    const sourceCount = (payload.links?.length || 0) + (payload.uploads?.length || 0);
    const trackFunction = sourceType === 'link' ? trackCvTemplateCreationFromUrl : trackCvTemplateCreationFromPdf;

    try {
      await trackFunction({
        userId,
        deviceId: deviceId || null,
        sourceCount,
        duration,
        status: 'error',
        error: errorMessage,
      });
    } catch (trackError) {
      console.error('[createTemplateCvJob] Erreur tracking télémétrie:', trackError);
    }

    return;
  }

  // Sauvegarde des CV générés
  const createdFiles = [];
  let hasEmptyCv = false;

  for (let i = 0; i < generatedContents.length; i++) {
    const result = generatedContents[i];
    const content = result.cvContent;
    const source = result.source;
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
          source: "chatgpt-template",
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
        console.warn(`[createTemplateCvJob] CV vide détecté : ${filename}`);
        hasEmptyCv = true;
        continue;
      }

      // Détecter la langue du CV (stockée en DB, pas dans le JSON)
      let detectedLanguage = null;
      try {
        const cvData = JSON.parse(enriched);
        const summaryDescription = cvData?.summary?.description || '';

        const { detectCvLanguageWithOpenAI } = await import('@/lib/openai/detectLanguage');
        detectedLanguage = await detectCvLanguageWithOpenAI({
          summaryDescription,
          signal: abortController.signal,
          userId,
        });
        console.log(`[createTemplateCvJob] Langue détectée: ${detectedLanguage}`);
      } catch (langError) {
        console.error('[createTemplateCvJob] Erreur détection langue (non-bloquant):', langError.message);
      }

      await writeUserCvFile(userId, filename, enriched);
      createdFiles.push(filename);

      // Déterminer le type de source
      const sourceUrl = Array.isArray(payload.links) && payload.links.length > 0 ? payload.links[i] || payload.links[0] : null;
      const sourceUpload = Array.isArray(payload.uploads) && payload.uploads.length > 0 ? payload.uploads[0].name : null;

      // Créer/Mettre à jour l'entrée CvFile avec métadonnées (langue incluse)
      await prisma.cvFile.upsert({
        where: { userId_filename: { userId, filename } },
        update: {
          jobOfferId: result.jobOfferId || null,
          language: detectedLanguage,
        },
        create: {
          userId,
          filename,
          createdBy: 'create-template',
          sourceType: sourceUrl ? 'link' : (sourceUpload ? 'pdf' : null),
          sourceValue: sourceUrl || sourceUpload || null,
          jobOfferId: result.jobOfferId || null,
          language: detectedLanguage,
        },
      });

      // Enregistrer la source (pour compatibilité)
      if (sourceUrl) {
        try {
          await setCvSource(userId, filename, 'link', sourceUrl, 'create-template');
        } catch (sourceError) {
          console.error(`Impossible d'enregistrer la source pour ${filename}:`, sourceError);
        }
      } else if (sourceUpload) {
        try {
          await setCvSource(userId, filename, 'pdf', sourceUpload, 'create-template');
        } catch (sourceError) {
          console.error(`Impossible d'enregistrer la source pour ${filename}:`, sourceError);
        }
      }

      console.log(`[createTemplateCvJob] CV modèle créé avec succès : ${filename}${result.jobOfferId ? ' (avec extraction offre)' : ''}`);

      // Tracking télémétrie - Succès pour ce CV
      const duration = Date.now() - startTime;
      const sourceType = sourceUrl ? 'link' : (sourceUpload ? 'pdf' : null);
      const trackFunction = sourceType === 'link' || !sourceType ? trackCvTemplateCreationFromUrl : trackCvTemplateCreationFromPdf;

      try {
        await trackFunction({
          userId,
          deviceId: deviceId || null,
          sourceCount: 1,
          duration,
          status: 'success',
        });
      } catch (trackError) {
        console.error('[createTemplateCvJob] Erreur tracking télémétrie:', trackError);
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

