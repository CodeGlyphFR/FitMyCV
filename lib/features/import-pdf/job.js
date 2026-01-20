import { promises as fs } from "fs";
import { DateTime } from "luxon";
import prisma from "@/lib/prisma";
import { ensureUserCvDir, writeUserCvFile } from "@/lib/cv-core/storage";
import { setCvSource } from "@/lib/cv-core/source";
import { createJobRunner } from "@/lib/background-jobs/jobRunner";
import { trackCvImport } from "@/lib/telemetry/server";

async function getImportPdfCv() {
  const module = await import("@/lib/features/import-pdf/service");
  return module.importPdfCv;
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

async function cleanupResources({ upload }) {
  try {
    if (upload?.directory) {
      await fs.rm(upload.directory, { recursive: true, force: true });
    }
  } catch (error) {
    console.error("Impossible de nettoyer le dossier temporaire (upload)", error);
  }
}

async function isFirstImport(userId) {
  try {
    const importCount = await prisma.cvFile.count({
      where: { userId, createdBy: 'import-pdf' },
    });
    return importCount === 0;
  } catch (error) {
    console.error(`Erreur lors de la vérification du premier import pour l'utilisateur ${userId}:`, error);
    return false;
  }
}

const { schedule: scheduleImportPdfJob, run: runImportPdfJob } = createJobRunner({
  name: 'importPdf',

  getService: getImportPdfCv,

  cleanup: cleanupResources,

  beforeRun: async ({ user, upload }) => {
    await ensureUserCvDir(user.id);

    const pdfFilePath = upload.saved?.path;
    if (!pdfFilePath) {
      throw new Error('Chemin du fichier PDF manquant');
    }

    try {
      await fs.access(pdfFilePath);
    } catch (error) {
      throw new Error(`Fichier PDF introuvable : ${pdfFilePath}`);
    }
  },

  prepareInput: async ({ user, upload }, signal) => {
    const userId = user.id;
    const isFirstPdfImport = await isFirstImport(userId);
    console.log(`[importPdfJob] Premier import pour l'utilisateur ${userId}: ${isFirstPdfImport}`);

    return {
      pdfFilePath: upload.saved.path,
      signal,
      userId,
      isFirstImport: isFirstPdfImport,
    };
  },

  handleResult: async ({ jobInput, result, userId }) => {
    const { upload } = jobInput;
    const { content: cvContent, language: detectedLanguage } = result;

    console.log(`[importPdfJob] Langue du PDF : ${detectedLanguage}`);

    // Validation du contenu
    if (!validateCvContent(cvContent)) {
      console.warn(`[importPdfJob] CV vide détecté, abandon de l'import`);
      throw new Error('Aucun contenu type CV détecté.');
    }

    // Générer le nom de fichier
    const filename = `${DateTime.now().toFormat('yyyyMMddHHmmssSSS')}.json`;

    // Sauvegarder le CV
    await writeUserCvFile(userId, filename, cvContent);

    // Créer/mettre à jour l'entrée en base
    await prisma.cvFile.upsert({
      where: { userId_filename: { userId, filename } },
      update: { language: detectedLanguage },
      create: { userId, filename, language: detectedLanguage },
    });

    // Enregistrer la source PDF
    const pdfFileName = upload.saved?.name || upload.name;
    if (pdfFileName) {
      try {
        await setCvSource(userId, filename, 'pdf', pdfFileName, 'import-pdf', null);
      } catch (sourceError) {
        console.error(`Impossible d'enregistrer la source pour ${filename}:`, sourceError);
      }
    }

    console.log(`[importPdfJob] CV importé avec succès : ${filename}`);

    // Calculer la taille du fichier pour le tracking
    let fileSize = 0;
    try {
      const stats = await fs.stat(upload.saved.path);
      fileSize = stats.size;
    } catch (e) {
      console.warn('[importPdfJob] Impossible de récupérer la taille du fichier');
    }

    const isFirstPdfImport = await isFirstImport(userId);

    return {
      data: { files: [filename] },
      trackingData: { fileSize, isFirstImport: isFirstPdfImport },
    };
  },

  trackSuccess: async ({ userId, deviceId, duration, fileSize, isFirstImport }) => {
    await trackCvImport({
      userId,
      deviceId: deviceId || null,
      fileSize: fileSize || 0,
      duration,
      status: 'success',
      isFirstImport: isFirstImport || false,
    });
  },

  trackError: async ({ userId, deviceId, duration, error }) => {
    await trackCvImport({
      userId,
      deviceId: deviceId || null,
      fileSize: 0,
      duration,
      status: 'error',
      error,
      isFirstImport: false,
    });
  },
});

export { scheduleImportPdfJob, runImportPdfJob };
