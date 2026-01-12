/**
 * POST /api/background-tasks/generate-cv-v2
 *
 * Version 2 de la génération de CV utilisant le nouveau pipeline.
 * Accepte des URLs d'offres d'emploi et démarre le pipeline async.
 *
 * L'extraction des offres d'emploi est maintenant faite en async
 * dans le pipeline (Phase 0) pour permettre le suivi de progression.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { CommonErrors, apiError } from '@/lib/api/apiErrors';
import { canStartTaskType, registerTaskTypeStart, enqueueJob } from '@/lib/backgroundTasks/jobQueue';
import { startCvGenerationV2 } from '@/lib/cv-pipeline-v2';
import { incrementFeatureCounter, refundFeatureUsage } from '@/lib/subscription/featureUsage';
import { verifyRecaptcha } from '@/lib/recaptcha/verifyRecaptcha';

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

export async function POST(request) {
  // 1. Vérifier l'authentification
  const session = await auth();
  if (!session?.user?.id) {
    return CommonErrors.notAuthenticated();
  }

  const userId = session.user.id;

  // 2. Vérifier la concurrence
  const taskType = 'cv_generation';
  const concurrencyCheck = canStartTaskType(userId, taskType);

  if (!concurrencyCheck.allowed) {
    console.log(`[generate-cv-v2] Concurrence refusée pour user ${userId}: ${concurrencyCheck.reason}`);
    return apiError(`errors.api.generateV2.${concurrencyCheck.reason}`, {
      status: 409,
      params: { taskType },
    });
  }

  try {
    // 3. Parser le FormData
    const formData = await request.formData();
    const rawLinks = formData.get('links');
    const rawBaseFile = formData.get('baseFile');
    const deviceId = formData.get('deviceId') || 'unknown-device';
    const recaptchaToken = formData.get('recaptchaToken');

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

    if (!links.length) {
      return apiError('errors.api.generateV2.noLinksProvided', { status: 400 });
    }

    // Valider le format des URLs
    const invalidUrls = links.filter(url => !isValidUrl(url));
    if (invalidUrls.length > 0) {
      return apiError('errors.api.generateV2.invalidUrlFormat', {
        status: 400,
        params: { urls: invalidUrls },
      });
    }

    // 4. Valider le CV de base
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

    const totalOffers = links.length;

    // 5. Vérifier et débiter les crédits/limites pour chaque offre
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

    // 6. Créer la CvGenerationTask
    const task = await prisma.cvGenerationTask.create({
      data: {
        userId,
        sourceCvFileId: cvFile.id,
        mode: 'adapt',
        status: 'pending',
        totalOffers,
        completedOffers: 0,
        creditsDebited: usageResults.filter(r => r.usedCredit).length,
        creditsRefunded: 0,
      },
    });

    console.log(`[generate-cv-v2] Task created: ${task.id} with ${totalOffers} URL(s)`);

    // Enregistrer le type de tâche comme actif
    registerTaskTypeStart(userId, taskType);

    // Créer une BackgroundTask pour l'affichage
    await prisma.backgroundTask.create({
      data: {
        id: task.id,
        userId,
        type: 'cv_generation_v2',
        title: totalOffers > 1
          ? `Génération de ${totalOffers} CV (v2)`
          : 'Génération de CV (v2)',
        status: 'queued',
        createdAt: BigInt(Date.now()),
        shouldUpdateCvList: true,
        deviceId,
        payload: JSON.stringify({
          taskId: task.id,
          sourceCvFile: baseFile,
          totalOffers,
          mode: 'adapt',
          urls: links,
        }),
      },
    });

    // 7. Créer une CvGenerationOffer par URL (sans jobOfferId, sera rempli après extraction)
    await Promise.all(
      links.map((url, index) =>
        prisma.cvGenerationOffer.create({
          data: {
            taskId: task.id,
            sourceUrl: url,
            jobOfferId: null, // Sera rempli après extraction async
            offerIndex: index,
            status: 'pending',
          },
        })
      )
    );

    console.log(`[generate-cv-v2] ${totalOffers} offer(s) created for task ${task.id}`);

    // 8. Démarrer l'orchestrateur v2 en arrière-plan
    enqueueJob(() => startCvGenerationV2(task.id));

    // 9. Retourner le succès immédiatement
    return NextResponse.json({
      success: true,
      queued: true,
      taskId: task.id,
      tasksCount: totalOffers,
      urls: links,
    }, { status: 202 });

  } catch (error) {
    console.error('[generate-cv-v2] Error:', error);
    return apiError('errors.api.common.serverError', { status: 500 });
  }
}
