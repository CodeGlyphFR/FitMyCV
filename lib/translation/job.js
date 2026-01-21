import { DateTime } from "luxon";
import prisma from "@/lib/prisma";
import { ensureUserCvDir, readUserCvFile, writeUserCvFile } from "@/lib/cv-core/storage";
import { createJobRunner } from "@/lib/background-jobs/jobRunner";
import { trackEvent, EventTypes } from "@/lib/telemetry/server";

async function getTranslateCv() {
  const module = await import("@/lib/translation/service");
  return module.translateCv;
}

const { schedule: scheduleTranslateCvJob, run: runTranslateCvJob } = createJobRunner({
  name: 'translateCv',

  getService: getTranslateCv,

  beforeRun: async ({ user }) => {
    await ensureUserCvDir(user.id);
  },

  prepareInput: async ({ user, sourceFile, targetLanguage }, signal) => {
    const cvContent = await readUserCvFile(user.id, sourceFile);
    return {
      cvContent,
      targetLanguage,
      signal,
      userId: user.id,
    };
  },

  handleResult: async ({ jobInput, result, userId }) => {
    const { sourceFile, targetLanguage } = jobInput;

    // Générer le nom de fichier pour la traduction
    const filename = `${DateTime.now().toFormat('yyyyMMddHHmmssSSS')}.json`;

    // Récupérer les métadonnées du CV source
    let sourceCvData = null;
    try {
      sourceCvData = await prisma.cvFile.findUnique({
        where: { userId_filename: { userId, filename: sourceFile } },
        select: {
          sourceType: true,
          sourceValue: true,
          createdBy: true,
          jobOfferId: true,
        },
      });
    } catch (error) {
      console.warn(`[translateCvJob] Impossible de récupérer les métadonnées du CV source:`, error);
    }

    // Nettoyer les métadonnées d'amélioration dans le CV traduit
    let translatedContent = result;
    try {
      const cvData = JSON.parse(result);

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

      translatedContent = JSON.stringify(cvData, null, 2);
    } catch (error) {
      console.warn('[translateCvJob] Impossible de parser le CV pour nettoyer les métadonnées:', error);
    }

    // Sauvegarder le CV traduit
    await writeUserCvFile(userId, filename, translatedContent);

    // Créer/mettre à jour l'entrée dans la base de données
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
        originalCreatedBy: sourceCvData?.createdBy || null,
        isTranslated: true,
        language: targetLanguage,
        jobOfferId: sourceCvData?.jobOfferId || null,
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

    return {
      data: { files: [filename] },
      trackingData: { targetLanguage, sourceFile },
    };
  },

  trackSuccess: async ({ userId, deviceId, duration, targetLanguage, sourceFile }) => {
    await trackEvent({
      type: EventTypes.CV_TRANSLATED,
      userId,
      deviceId: deviceId || null,
      metadata: { targetLanguage, sourceFile },
      duration,
      status: 'success',
    });
  },

  trackError: async ({ userId, deviceId, duration, error, targetLanguage, sourceFile }) => {
    await trackEvent({
      type: EventTypes.CV_TRANSLATED,
      userId,
      deviceId: deviceId || null,
      metadata: { targetLanguage, sourceFile },
      duration,
      status: 'error',
      error,
    });
  },
});

export { scheduleTranslateCvJob, runTranslateCvJob };
