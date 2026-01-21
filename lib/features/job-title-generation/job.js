import { DateTime } from "luxon";
import prisma from "@/lib/prisma";
import { ensureUserCvDir, writeUserCvFile } from "@/lib/cv-core/storage";
import { setCvSource } from "@/lib/cv-core/source";
import { createJobRunner } from "@/lib/background-jobs/jobRunner";
import { trackCvGenerationFromJobTitle } from "@/lib/telemetry/server";

async function getGenerateCvFromJobTitle() {
  const module = await import("@/lib/features/job-title-generation/service");
  return module.generateCvFromJobTitle;
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

const { schedule: scheduleGenerateCvFromJobTitleJob, run: runGenerateCvFromJobTitleJob } = createJobRunner({
  name: 'generateCvFromJobTitle',

  getService: getGenerateCvFromJobTitle,

  beforeRun: async ({ user, payload }) => {
    await ensureUserCvDir(user.id);

    const jobTitle = payload.jobTitle;
    if (!jobTitle || typeof jobTitle !== 'string' || !jobTitle.trim()) {
      throw new Error('Titre de poste manquant');
    }
  },

  prepareInput: async ({ user, payload }, signal) => {
    return {
      jobTitle: payload.jobTitle.trim(),
      language: payload.language || 'français',
      signal,
      userId: user.id,
    };
  },

  handleResult: async ({ jobInput, result, userId }) => {
    const { payload } = jobInput;
    const jobTitle = payload.jobTitle;
    const language = payload.language || 'français';

    // Génération du nom de fichier
    const filename = `${DateTime.now().toFormat('yyyyMMddHHmmssSSS')}.json`;

    // Enrichissement avec métadonnées
    let enriched = result;
    try {
      const parsed = JSON.parse(result);
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

    // Validation
    if (!validateCvContent(enriched)) {
      console.warn(`[generateCvFromJobTitleJob] CV vide détecté : ${filename}`);
      throw new Error('Aucun contenu type CV détecté.');
    }

    // Normaliser la langue
    let normalizedLanguage = null;
    try {
      const { normalizeLanguageInput } = await import('@/lib/cv-core/language/languageConstants');
      normalizedLanguage = normalizeLanguageInput(language);
      console.log(`[generateCvFromJobTitleJob] Langue: ${normalizedLanguage}`);
    } catch (langError) {
      console.error('[generateCvFromJobTitleJob] Erreur normalisation langue (non-bloquant):', langError.message);
    }

    await writeUserCvFile(userId, filename, enriched);

    // Stocker métadonnées en DB
    await prisma.cvFile.upsert({
      where: { userId_filename: { userId, filename } },
      update: { language: normalizedLanguage },
      create: {
        userId,
        filename,
        createdBy: 'generate-cv-job-title',
        language: normalizedLanguage,
      },
    });

    // Enregistrer la source
    try {
      await setCvSource(userId, filename, 'job-title', jobTitle, 'generate-cv-job-title');
    } catch (sourceError) {
      console.error(`Impossible d'enregistrer la source pour ${filename}:`, sourceError);
    }

    console.log(`[generateCvFromJobTitleJob] CV généré avec succès : ${filename}`);

    return {
      data: { file: filename },
      trackingData: { jobTitle },
    };
  },

  trackSuccess: async ({ userId, deviceId, duration }) => {
    await trackCvGenerationFromJobTitle({
      userId,
      deviceId: deviceId || null,
      sourceType: 'job-title',
      sourceCount: 1,
      duration,
      status: 'success',
    });
  },

  trackError: async ({ userId, deviceId, duration, error }) => {
    await trackCvGenerationFromJobTitle({
      userId,
      deviceId: deviceId || null,
      sourceType: 'job-title',
      sourceCount: 1,
      duration,
      status: 'error',
      error,
    });
  },
});

export { scheduleGenerateCvFromJobTitleJob, runGenerateCvFromJobTitleJob };
