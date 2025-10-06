import { promises as fs } from "fs";
import path from "path";
import { DateTime } from "luxon";

import prisma from "@/lib/prisma";
import { ensureUserCvDir, readUserCvFile, writeUserCvFile, getUserCvDir } from "@/lib/cv/storage";
import { enqueueJob } from "@/lib/backgroundTasks/jobQueue";
import { setCvSource } from "@/lib/cv/source";
import { registerAbortController, clearRegisteredProcess } from "@/lib/backgroundTasks/processRegistry";

const DEFAULT_ANALYSIS_LEVEL = "medium";

// Import dynamique pour éviter de charger les modules lourds au démarrage
async function getGenerateCvWithScore() {
  const module = await import("@/lib/openai/generateCvWithScore");
  return module.generateCvWithScore;
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

function validateCvContent(content) {
  try {
    const parsed = JSON.parse(content);
    const header = parsed?.header || {};
    const fullName = (header.full_name || "").trim();
    const currentTitle = (header.current_title || "").trim();
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

/**
 * Version optimisée du job de génération qui génère CV + score en un seul appel
 */
export async function runGenerateCvJobOptimized({
  taskId,
  user,
  payload,
  deviceId,
}) {
  const userId = user.id;

  console.log(`[generateCvJobOptimized] Démarrage job ${taskId} pour user ${userId}`);

  // Vérifier le statut de la tâche
  try {
    const record = await prisma.backgroundTask.findUnique({ where: { id: taskId } });
    if (!record || record.status === 'cancelled') {
      await cleanupResources({ uploadDirectory: payload.uploadDirectory, tempUploads: payload.uploads });
      return;
    }
  } catch (error) {
    console.warn(`Impossible de vérifier la tâche ${taskId}`, error);
  }

  // Créer un AbortController pour pouvoir annuler
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

  // Récupérer le CV de référence
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

    // Appel de la fonction optimisée qui retourne CV + score + suggestions
    const generateCvWithScore = await getGenerateCvWithScore();
    results = await generateCvWithScore({
      mainCvContent: referenceContent,
      referenceFile,
      links: payload.links || [],
      files,
      analysisLevel,
      requestedModel: payload.model,
      signal: abortController.signal,
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
      console.log(`[generateCvJobOptimized] Tâche ${taskId} annulée`);
      await updateBackgroundTask(taskId, userId, {
        status: 'cancelled',
        result: null,
        error: null,
      });
      return;
    }

    console.error(`[generateCvJobOptimized] Erreur génération:`, error);

    const isQuotaExceeded = error.message && /insufficient_quota|exceeded your current quota/i.test(error.message);
    const errorMessage = isQuotaExceeded
      ? "Quota OpenAI dépassé. Vérifiez votre facturation."
      : (error.message || 'Échec lors de la génération du CV');

    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: errorMessage,
    });
    return;
  }

  // Sauvegarde des CV générés avec leurs métadonnées enrichies
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
          generator: "chatgpt-optimized",
          source: "chatgpt-with-score",
          updated_at: isoNow,
          match_score: result.matchScore,
          analysis_level: analysisLevel,
        };
        if (!nextMeta.created_at) nextMeta.created_at = isoNow;
        parsed.meta = nextMeta;
        enriched = JSON.stringify(parsed, null, 2);
      } catch (metaError) {
        console.error(`Impossible d'enrichir ${filename} avec les métadonnées`, metaError);
      }

      // Valider le contenu avant de sauvegarder
      if (!validateCvContent(enriched)) {
        console.warn(`[generateCvJobOptimized] CV vide détecté : ${filename}`);
        hasEmptyCv = true;
        continue;
      }

      // Sauvegarder le fichier CV
      await writeUserCvFile(userId, filename, enriched);
      createdFiles.push(filename);

      // Déterminer la source (lien ou PDF)
      const sourceUrl = Array.isArray(payload.links) && payload.links.length > 0
        ? payload.links[i] || payload.links[0]
        : null;
      const sourceUpload = Array.isArray(payload.uploads) && payload.uploads.length > 0
        ? payload.uploads[0].name
        : null;

      // Créer/Mettre à jour l'entrée CvFile avec les nouvelles métadonnées
      await prisma.cvFile.upsert({
        where: { userId_filename: { userId, filename } },
        update: {
          matchScore: result.matchScore,
          matchScoreUpdatedAt: new Date(),
          scoreBreakdown: JSON.stringify(result.scoreBreakdown),
          improvementSuggestions: JSON.stringify(result.suggestions),
          missingSkills: JSON.stringify(result.missingSkills),
          matchingSkills: JSON.stringify(result.matchingSkills),
          extractedJobOffer: result.extractedJobOffer || null,
        },
        create: {
          userId,
          filename,
          sourceType: sourceUrl ? 'link' : (sourceUpload ? 'pdf' : null),
          sourceValue: sourceUrl || sourceUpload || null,
          extractedJobOffer: result.extractedJobOffer || null,
          createdBy: 'generate-cv',
          analysisLevel,
          matchScore: result.matchScore,
          matchScoreUpdatedAt: new Date(),
          scoreBreakdown: JSON.stringify(result.scoreBreakdown),
          improvementSuggestions: JSON.stringify(result.suggestions),
          missingSkills: JSON.stringify(result.missingSkills),
          matchingSkills: JSON.stringify(result.matchingSkills),
        },
      });

      // Enregistrer la source (pour compatibilité avec l'ancien système)
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

      console.log(`[generateCvJobOptimized] ✅ CV généré : ${filename} - Score: ${result.matchScore}/100`);

      // Logger les suggestions pour debug
      if (result.suggestions?.length > 0) {
        console.log(`[generateCvJobOptimized] Suggestions pour ${filename}:`);
        result.suggestions.forEach(s => {
          console.log(`  - [${s.priority}] ${s.suggestion} (${s.impact})`);
        });
      }
    } catch (error) {
      console.error(`Impossible de persister ${filename}`, error);
    }
  }

  await cleanupResources({ uploadDirectory: payload.uploadDirectory, tempUploads: payload.uploads });
  clearRegisteredProcess(taskId);

  // Si tous les CV générés sont vides, marquer comme échoué
  if (hasEmptyCv && createdFiles.length === 0) {
    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: 'Aucun contenu type CV détecté.',
    });
    return;
  }

  // Préparer le résultat enrichi avec les scores et suggestions
  const enrichedResults = createdFiles.map((file, index) => {
    const result = results[index];
    return {
      file,
      matchScore: result?.matchScore || null,
      suggestions: result?.suggestions || [],
    };
  });

  await updateBackgroundTask(taskId, userId, {
    status: 'completed',
    result: JSON.stringify({
      files: createdFiles,
      results: enrichedResults,
    }),
    error: null,
  });

  console.log(`[generateCvJobOptimized] ✨ Job terminé - ${createdFiles.length} CV générés avec scores`);
}