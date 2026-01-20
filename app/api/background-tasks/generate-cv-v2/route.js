/**
 * POST /api/background-tasks/generate-cv-v2
 *
 * Version 2 de la génération de CV utilisant le nouveau pipeline.
 * Accepte des URLs d'offres d'emploi ET des fichiers PDF.
 *
 * Chaque URL/PDF crée une tâche indépendante dans le gestionnaire de tâches.
 * Les tâches s'exécutent en parallèle (max 3 concurrentes).
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { CommonErrors, apiError } from '@/lib/api/apiErrors';
import { registerTaskTypeStart, enqueueJob } from '@/lib/background-jobs/jobQueue';
import { startSingleOfferGeneration } from '@/lib/features/cv-adaptation';
import { incrementFeatureCounter, refundFeatureUsage } from '@/lib/subscription/featureUsage';
import { verifyRecaptcha } from '@/lib/recaptcha/verifyRecaptcha';
import { validateUploadedFile, sanitizeFilename } from '@/lib/security/fileValidation';

function sanitizeLinks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(link => (typeof link === 'string' ? link : String(link || '')))
    .map(link => link.trim())
    .filter(link => !!link);
}

/**
 * Valide le format d'une URL
 */
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extrait le domaine d'une URL pour l'affichage
 */
function extractDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    return 'offre';
  }
}

/**
 * Sauvegarde les fichiers PDF uploadés dans un répertoire temporaire
 */
async function saveUploadedFiles(files) {
  if (!files.length) {
    return { directory: null, saved: [], errors: [] };
  }

  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cv-gen-v2-uploads-'));
  const saved = [];
  const errors = [];

  for (const file of files) {
    const validation = await validateUploadedFile(file, {
      allowedTypes: ['application/pdf'],
      maxSize: 10 * 1024 * 1024, // 10 MB
    });

    if (!validation.valid) {
      console.warn(`[generate-cv-v2] Validation échouée pour ${file.name}: ${validation.error}`);
      errors.push({ file: file.name, error: validation.error });
      continue;
    }

    const originalName = file.name || `offre-${saved.length + 1}.pdf`;
    const safeName = sanitizeFilename(originalName);
    const targetPath = path.join(uploadDir, safeName || `offre-${saved.length + 1}.pdf`);
    await fs.writeFile(targetPath, validation.buffer);
    saved.push({
      path: targetPath,
      name: originalName,
      size: validation.buffer.length,
      type: file.type || 'application/pdf',
    });
  }

  return { directory: uploadDir, saved, errors };
}

export async function POST(request) {
  // 1. Vérifier l'authentification
  const session = await auth();
  if (!session?.user?.id) {
    return CommonErrors.notAuthenticated();
  }

  const userId = session.user.id;

  try {
    // 2. Parser le FormData
    const formData = await request.formData();
    const rawLinks = formData.get('links');
    const rawBaseFile = formData.get('baseFile');
    const deviceId = formData.get('deviceId') || 'unknown-device';
    const recaptchaToken = formData.get('recaptchaToken');
    const files = formData.getAll('files').filter(Boolean);

    // Vérification reCAPTCHA
    if (recaptchaToken) {
      const recaptchaResult = await verifyRecaptcha(recaptchaToken, {
        callerName: 'generate-cv-v2',
        scoreThreshold: 0.5,
      });

      if (!recaptchaResult.success) {
        return apiError('errors.auth.recaptchaFailed', { status: 403 });
      }
    }

    // Parser les liens
    let parsedLinks = [];
    if (rawLinks) {
      try {
        parsedLinks = JSON.parse(rawLinks);
      } catch {
        return apiError('errors.api.generateV2.invalidLinksFormat', { status: 400 });
      }
    }

    const links = sanitizeLinks(parsedLinks);

    // Valider le format des URLs
    const invalidUrls = links.filter(url => !isValidUrl(url));
    if (invalidUrls.length > 0) {
      return apiError('errors.api.generateV2.invalidUrlFormat', {
        status: 400,
        params: { urls: invalidUrls },
      });
    }

    // Sauvegarder les fichiers PDF uploadés
    const { saved: savedFiles, errors: uploadErrors } = await saveUploadedFiles(files);

    if (uploadErrors.length > 0) {
      console.warn(`[generate-cv-v2] ${uploadErrors.length} fichier(s) rejeté(s):`, uploadErrors);
    }

    // Vérifier qu'il y a au moins une source (URL ou fichier)
    if (!links.length && !savedFiles.length) {
      return apiError('errors.api.generateV2.noLinksProvided', { status: 400 });
    }

    // 3. Valider le CV de base
    const baseFile = (rawBaseFile || '').trim();
    if (!baseFile) {
      return apiError('errors.api.cv.missingFilename', { status: 400 });
    }

    const cvFile = await prisma.cvFile.findUnique({
      where: {
        userId_filename: { userId, filename: baseFile },
      },
      select: { id: true, filename: true },
    });

    if (!cvFile) {
      return apiError('errors.api.cv.notFound', { status: 404 });
    }

    const totalOffers = links.length + savedFiles.length;

    // 4. Vérifier et débiter les crédits/limites pour TOUTES les offres d'abord
    const usageResults = [];
    for (let i = 0; i < totalOffers; i++) {
      const usageResult = await incrementFeatureCounter(userId, 'gpt_cv_generation');

      if (!usageResult.success) {
        // Rembourser les crédits déjà débités
        for (const prev of usageResults) {
          if (prev.transactionId) {
            await refundFeatureUsage(prev.transactionId);
          }
        }

        return NextResponse.json({
          error: usageResult.error,
          actionRequired: usageResult.actionRequired,
          redirectUrl: usageResult.redirectUrl,
        }, { status: 403 });
      }

      usageResults.push(usageResult);
    }

    // 5. Créer une tâche par source (URL ou PDF)
    const createdTasks = [];
    let taskIndex = 0;

    // 5a. Créer les tâches pour les URLs
    for (let i = 0; i < links.length; i++) {
      const url = links[i];
      const usageResult = usageResults[taskIndex];
      const domain = extractDomain(url);

      const task = await prisma.cvGenerationTask.create({
        data: {
          userId,
          sourceCvFileId: cvFile.id,
          mode: 'adapt',
          status: 'pending',
          totalOffers: 1,
          completedOffers: 0,
          creditsDebited: usageResult.usedCredit ? 1 : 0,
          creditsRefunded: 0,
        },
      });

      const offer = await prisma.cvGenerationOffer.create({
        data: {
          taskId: task.id,
          sourceUrl: url,
          jobOfferId: null,
          offerIndex: 0,
          status: 'pending',
        },
      });

      // Titre initial = juste le domaine (sera mis à jour avec le titre de l'offre après extraction)
      const title = domain;

      await prisma.backgroundTask.create({
        data: {
          id: task.id,
          userId,
          type: 'cv_generation_v2',
          title,
          status: 'queued',
          createdAt: BigInt(Date.now() + taskIndex),
          shouldUpdateCvList: true,
          deviceId,
          payload: JSON.stringify({
            taskId: task.id,
            offerId: offer.id,
            sourceCvFile: baseFile,
            url,
            offerIndex: taskIndex,
            totalOffersInBatch: totalOffers,
          }),
        },
      });

      registerTaskTypeStart(userId, 'cv_generation');
      enqueueJob(() => startSingleOfferGeneration(task.id, offer.id));

      createdTasks.push({ taskId: task.id, offerId: offer.id, url });
      console.log(`[generate-cv-v2] Task ${task.id} created for URL: ${url}`);
      taskIndex++;
    }

    // 5b. Créer les tâches pour les fichiers PDF
    for (let i = 0; i < savedFiles.length; i++) {
      const pdfFile = savedFiles[i];
      const usageResult = usageResults[taskIndex];
      const displayName = pdfFile.name.replace(/\.pdf$/i, '').slice(0, 30);

      const task = await prisma.cvGenerationTask.create({
        data: {
          userId,
          sourceCvFileId: cvFile.id,
          mode: 'adapt',
          status: 'pending',
          totalOffers: 1,
          completedOffers: 0,
          creditsDebited: usageResult.usedCredit ? 1 : 0,
          creditsRefunded: 0,
        },
      });

      // Pour les PDFs, on utilise un préfixe file:// pour distinguer des URLs
      const offer = await prisma.cvGenerationOffer.create({
        data: {
          taskId: task.id,
          sourceUrl: `file://${pdfFile.path}`,
          jobOfferId: null,
          offerIndex: 0,
          status: 'pending',
        },
      });

      // Titre initial = juste le nom du PDF (sera mis à jour avec le titre de l'offre après extraction)
      const title = displayName;

      await prisma.backgroundTask.create({
        data: {
          id: task.id,
          userId,
          type: 'cv_generation_v2',
          title,
          status: 'queued',
          createdAt: BigInt(Date.now() + taskIndex),
          shouldUpdateCvList: true,
          deviceId,
          payload: JSON.stringify({
            taskId: task.id,
            offerId: offer.id,
            sourceCvFile: baseFile,
            pdfPath: pdfFile.path,
            pdfName: pdfFile.name,
            offerIndex: taskIndex,
            totalOffersInBatch: totalOffers,
          }),
        },
      });

      registerTaskTypeStart(userId, 'cv_generation');
      enqueueJob(() => startSingleOfferGeneration(task.id, offer.id));

      createdTasks.push({ taskId: task.id, offerId: offer.id, pdfName: pdfFile.name });
      console.log(`[generate-cv-v2] Task ${task.id} created for PDF: ${pdfFile.name}`);
      taskIndex++;
    }

    console.log(`[generate-cv-v2] ${createdTasks.length} task(s) created for user ${userId}`);

    // 6. Retourner le succès immédiatement
    return NextResponse.json({
      success: true,
      queued: true,
      tasks: createdTasks,
      totalTasks: createdTasks.length,
    }, { status: 202 });

  } catch (error) {
    console.error('[generate-cv-v2] Error:', error);
    return apiError('errors.api.common.serverError', { status: 500 });
  }
}
