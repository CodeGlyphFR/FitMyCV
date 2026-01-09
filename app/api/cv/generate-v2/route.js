import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { getCreditBalance, debitCredit } from '@/lib/subscription/credits';
import { getCreditCostForFeature } from '@/lib/subscription/creditCost';
import { CommonErrors, apiError } from '@/lib/api/apiErrors';
import { canStartTaskType, registerTaskTypeStart, enqueueJob } from '@/lib/backgroundTasks/jobQueue';
import { startCvGenerationV2 } from '@/lib/cv-pipeline-v2';

/**
 * POST /api/cv/generate-v2
 *
 * Lance une génération de CV Pipeline v2 pour une ou plusieurs offres d'emploi.
 *
 * Body:
 * - sourceCvFile: string (filename du CV source)
 * - jobOfferIds: string[] (1-10 IDs d'offres d'emploi)
 * - mode: 'adapt' | 'rebuild' (mode de génération, default: 'adapt')
 *
 * Returns:
 * - { success: true, taskId, totalOffers }
 * - 401 si non authentifié
 * - 403 si crédits insuffisants
 * - 400 si payload invalide
 */
export async function POST(request) {
  // 1. Vérifier l'authentification
  const session = await auth();
  if (!session?.user?.id) {
    return CommonErrors.notAuthenticated();
  }

  const userId = session.user.id;

  // 2. Vérifier la concurrence par type de tâche
  const taskType = 'cv_generation';
  const concurrencyCheck = canStartTaskType(userId, taskType);

  if (!concurrencyCheck.allowed) {
    console.log(`[generate-v2] Concurrence refusée pour user ${userId}: ${concurrencyCheck.reason}`);
    return apiError(`errors.api.generateV2.${concurrencyCheck.reason}`, {
      status: 409, // Conflict
      params: { taskType },
    });
  }

  try {
    // 3. Parser et valider le body
    const body = await request.json();
    const { sourceCvFile, jobOfferIds, mode = 'adapt' } = body;

    // Validation: sourceCvFile requis
    if (!sourceCvFile || typeof sourceCvFile !== 'string') {
      return apiError('errors.api.cv.missingFilename', { status: 400 });
    }

    // Validation: jobOfferIds requis et entre 1-10 offres
    if (!jobOfferIds || !Array.isArray(jobOfferIds) || jobOfferIds.length === 0) {
      return apiError('errors.api.generateV2.noOffersProvided', { status: 400 });
    }

    if (jobOfferIds.length > 10) {
      return apiError('errors.api.generateV2.maxOffersExceeded', {
        params: { max: 10, provided: jobOfferIds.length },
        status: 400,
      });
    }

    // Vérifier que tous les IDs sont des strings non vides
    const invalidIds = jobOfferIds.filter(id => typeof id !== 'string' || !id.trim());
    if (invalidIds.length > 0) {
      return apiError('errors.api.generateV2.invalidOfferIds', { status: 400 });
    }

    // Validation: mode valide
    if (!['adapt', 'rebuild'].includes(mode)) {
      return apiError('errors.api.generateV2.invalidMode', { status: 400 });
    }

    // 3. Vérifier que le CV source existe
    const cvFile = await prisma.cvFile.findUnique({
      where: {
        userId_filename: {
          userId,
          filename: sourceCvFile,
        },
      },
      select: { id: true, filename: true },
    });

    if (!cvFile) {
      return apiError('errors.api.cv.notFound', { status: 404 });
    }

    // 4. Vérifier que toutes les offres d'emploi existent et appartiennent à l'utilisateur
    const jobOffers = await prisma.jobOffer.findMany({
      where: {
        id: { in: jobOfferIds },
        userId, // S'assurer que les offres appartiennent à l'utilisateur
      },
      select: { id: true },
    });

    if (jobOffers.length !== jobOfferIds.length) {
      // Identifier quels IDs sont invalides ou n'appartiennent pas à l'utilisateur
      const foundIds = new Set(jobOffers.map(o => o.id));
      const notFoundIds = jobOfferIds.filter(id => !foundIds.has(id));

      console.log(`[generate-v2] Job offers not found or unauthorized: ${notFoundIds.join(', ')}`);

      return apiError('errors.api.generateV2.jobOfferNotFound', {
        params: { ids: notFoundIds.join(', '), count: notFoundIds.length },
        status: 404,
      });
    }

    // 5. Calculer le coût total en crédits
    const totalOffers = jobOfferIds.length;
    const creditCostInfo = await getCreditCostForFeature('gpt_cv_generation');
    const totalCost = creditCostInfo.cost * totalOffers;

    console.log(
      `[generate-v2] User ${userId}: ${totalOffers} offre(s) × ${creditCostInfo.cost} crédit(s) = ${totalCost} crédits`
    );

    // 6. Vérifier que l'utilisateur a assez de crédits
    const creditBalance = await getCreditBalance(userId);

    if (creditBalance.balance < totalCost) {
      console.log(
        `[generate-v2] Crédits insuffisants: ${creditBalance.balance} < ${totalCost}`
      );
      return apiError('errors.api.credits.insufficient', {
        params: {
          required: totalCost,
          available: creditBalance.balance,
          costPerOffer: creditCostInfo.cost,
        },
        status: 403,
        actionRequired: true,
        redirectUrl: '/account/subscriptions?tab=credits',
      });
    }

    // 7. Débiter les crédits
    const debitResult = await debitCredit(userId, totalCost, 'usage', {
      featureName: 'gpt_cv_generation',
      extra: {
        pipeline: 'v2',
        totalOffers,
        costPerOffer: creditCostInfo.cost,
      },
    });

    if (!debitResult.success) {
      console.error(`[generate-v2] Échec du débit: ${debitResult.error}`);
      return apiError('errors.api.cv.debitError', { status: 500 });
    }

    // 8. Créer la CvGenerationTask
    const task = await prisma.cvGenerationTask.create({
      data: {
        userId,
        sourceCvFileId: cvFile.id,
        mode,
        status: 'pending',
        totalOffers,
        completedOffers: 0,
        creditsDebited: totalCost,
        creditsRefunded: 0,
      },
    });

    console.log(`[generate-v2] Task créée: ${task.id}`);

    // Enregistrer le type de tâche comme actif pour cet utilisateur
    registerTaskTypeStart(userId, taskType);

    // Créer une entrée BackgroundTask pour l'affichage dans TaskQueueModal
    await prisma.backgroundTask.create({
      data: {
        id: task.id, // Utiliser le même ID que CvGenerationTask
        userId,
        type: 'cv_generation_v2',
        title: totalOffers > 1
          ? `Génération de ${totalOffers} CV`
          : 'Génération de CV',
        status: 'queued',
        createdAt: BigInt(Date.now()),
        shouldUpdateCvList: true,
        payload: JSON.stringify({
          taskId: task.id,
          sourceCvFile,
          totalOffers,
          mode,
          jobOfferIds,
        }),
      },
    });

    // 9. Créer une CvGenerationOffer par offre d'emploi
    const offerRecords = await Promise.all(
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

    console.log(
      `[generate-v2] ${offerRecords.length} offre(s) créée(s) pour task ${task.id}`
    );

    // 10. Démarrer l'orchestrateur en arrière-plan
    enqueueJob(() => startCvGenerationV2(task.id));

    // 11. Retourner le succès
    return NextResponse.json(
      {
        success: true,
        taskId: task.id,
        totalOffers,
        creditsDebited: totalCost,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[generate-v2] Erreur:', error);
    return apiError('errors.api.common.serverError', { status: 500 });
  }
}
