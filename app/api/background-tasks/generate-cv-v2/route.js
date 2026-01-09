/**
 * POST /api/background-tasks/generate-cv-v2
 *
 * Version 2 de la génération de CV utilisant le nouveau pipeline.
 * Accepte des URLs d'offres d'emploi, les parse, puis utilise le pipeline v2.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { CommonErrors, apiError } from '@/lib/api/apiErrors';
import { canStartTaskType, registerTaskTypeStart, enqueueJob } from '@/lib/backgroundTasks/jobQueue';
import { startCvGenerationV2 } from '@/lib/cv-pipeline-v2';
import { getOrExtractJobOfferFromUrl } from '@/lib/openai/generateCv';
import { incrementFeatureCounter, refundFeatureUsage } from '@/lib/subscription/featureUsage';
import { verifyRecaptcha } from '@/lib/recaptcha/verifyRecaptcha';

function sanitizeLinks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(link => (typeof link === 'string' ? link : String(link || '')))
    .map(link => link.trim())
    .filter(link => !!link);
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

    // Note: Pour l'instant, le pipeline v2 ne supporte pas les fichiers PDF joints
    // On se concentre sur les URLs d'offres d'emploi

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

    // 5. Extraire les offres d'emploi depuis les URLs
    console.log(`[generate-cv-v2] Extracting ${links.length} job offer(s) from URLs...`);

    const jobOfferResults = [];
    const extractionErrors = [];

    for (const url of links) {
      try {
        const result = await getOrExtractJobOfferFromUrl(userId, url);
        jobOfferResults.push({
          url,
          jobOfferId: result.jobOfferId,
          title: result.title || result.extraction?.title || 'Offre',
          fromCache: result.fromCache,
        });
        console.log(`[generate-cv-v2] Extracted: ${result.title || 'Unknown'} (cache: ${result.fromCache})`);
      } catch (error) {
        console.error(`[generate-cv-v2] Failed to extract ${url}:`, error.message);
        extractionErrors.push({ url, error: error.message });
      }
    }

    if (jobOfferResults.length === 0) {
      return apiError('errors.api.generateV2.allExtractionsFailed', {
        status: 400,
        params: { errors: extractionErrors },
      });
    }

    const jobOfferIds = jobOfferResults.map(r => r.jobOfferId);
    const totalOffers = jobOfferIds.length;

    // 6. Vérifier et débiter les crédits/limites pour chaque offre
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

    // 7. Créer la CvGenerationTask
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

    console.log(`[generate-cv-v2] Task created: ${task.id}`);

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
          jobOfferIds,
          urls: links,
        }),
      },
    });

    // 8. Créer une CvGenerationOffer par offre
    await Promise.all(
      jobOfferIds.map((jobOfferId, index) =>
        prisma.cvGenerationOffer.create({
          data: {
            taskId: task.id,
            jobOfferId,
            offerIndex: index,
            status: 'pending',
          },
        })
      )
    );

    console.log(`[generate-cv-v2] ${totalOffers} offer(s) created for task ${task.id}`);

    // 9. Démarrer l'orchestrateur v2 en arrière-plan
    enqueueJob(() => startCvGenerationV2(task.id));

    // 10. Retourner le succès
    return NextResponse.json({
      success: true,
      queued: true,
      taskId: task.id,
      tasksCount: totalOffers,
      extractedOffers: jobOfferResults.map(r => ({ url: r.url, title: r.title })),
      extractionErrors: extractionErrors.length > 0 ? extractionErrors : undefined,
    }, { status: 202 });

  } catch (error) {
    console.error('[generate-cv-v2] Error:', error);
    return apiError('errors.api.common.serverError', { status: 500 });
  }
}
