import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { scheduleCalculateMatchScoreJob } from "@/lib/scoring/job";
import { incrementFeatureCounter } from "@/lib/subscription/featureUsage";
import { verifyRecaptcha } from "@/lib/recaptcha/verifyRecaptcha";
import { CommonErrors, AuthErrors, BackgroundErrors, CvErrors } from "@/lib/api/apiErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return CommonErrors.notAuthenticated();
  }

  try {
    const body = await request.json();
    const { cvFile, isAutomatic = false, taskId, deviceId, recaptchaToken } = body;

    // Vérification reCAPTCHA (obligatoire en production)
    if (process.env.NODE_ENV === 'production' && process.env.BYPASS_RECAPTCHA !== 'true') {
      if (!recaptchaToken) {
        return AuthErrors.recaptchaFailed();
      }
    }
    if (recaptchaToken) {
      const recaptchaResult = await verifyRecaptcha(recaptchaToken, {
        callerName: 'calculate-match-score',
        scoreThreshold: 0.5,
      });

      if (!recaptchaResult.success) {
        return AuthErrors.recaptchaFailed();
      }
    }

    if (!cvFile) {
      return CvErrors.missingFilename();
    }

    const userId = session.user.id;

    // Récupérer les métadonnées du CV depuis la DB
    const cvRecord = await prisma.cvFile.findUnique({
      where: {
        userId_filename: {
          userId,
          filename: cvFile,
        },
      },
      select: {
        jobOfferId: true, // Vérifier si un JobOffer est associé
        sourceValue: true,
        sourceType: true,
      },
    });

    if (!cvRecord) {
      return CvErrors.notFound();
    }

    // Vérifier que le CV a une offre d'emploi associée
    if (!cvRecord.jobOfferId) {
      console.log("[calculate-match-score] CV non éligible - pas de jobOffer");
      return BackgroundErrors.noJobOfferAnalysis();
    }

    const jobOfferUrl = cvRecord.sourceValue;
    if (!jobOfferUrl) {
      return BackgroundErrors.jobOfferUrlNotFound();
    }

    // Créer un identifiant de tâche AVANT le débit pour pouvoir le lier à la transaction
    const taskIdentifier = typeof taskId === "string" && taskId.trim()
      ? taskId.trim()
      : `task_${Date.now()}_${crypto.randomUUID().slice(0, 9)}`;

    // Vérifier les limites ET incrémenter le compteur/débiter le crédit
    const usageResult = await incrementFeatureCounter(userId, 'match_score', { taskId: taskIdentifier });

    if (!usageResult.success) {
      return NextResponse.json({
        error: usageResult.error,
        actionRequired: usageResult.actionRequired,
        redirectUrl: usageResult.redirectUrl
      }, { status: 403 });
    }

    const existingTask = await prisma.backgroundTask.findUnique({ where: { id: taskIdentifier } });

    const payload = {
      cvFile,
      jobOfferUrl,
      isAutomatic,
    };

    const taskData = {
      title: `Calcul du score de match en cours...`,
      successMessage: 'taskQueue.messages.matchScoreCompleted',
      type: 'calculate-match-score',
      status: 'queued',
      shouldUpdateCvList: false, // Pas besoin de rafraîchir la liste des CVs
      error: null,
      result: null,
      deviceId: deviceId || "unknown-device",
      cvFile, // Lien direct vers le CV
      payload: JSON.stringify(payload),
      creditUsed: usageResult.usedCredit,
      creditTransactionId: usageResult.transactionId || null,
      featureName: usageResult.featureName || null,
      featureCounterPeriodStart: usageResult.periodStart || null,
    };

    if (!existingTask) {
      await prisma.backgroundTask.create({
        data: {
          id: taskIdentifier,
          userId,
          createdAt: BigInt(Date.now()),
          ...taskData,
        },
      });
    } else {
      await updateBackgroundTask(taskIdentifier, userId, taskData);
    }

    // Mettre le status du CV à "inprogress" immédiatement
    await prisma.cvFile.update({
      where: {
        userId_filename: {
          userId,
          filename: cvFile,
        },
      },
      data: {
        matchScoreStatus: 'inprogress',
      },
    }).catch(err => console.error('[calculate-match-score] Impossible de mettre à jour le status du CV:', err));

    // Lancer le job en arrière-plan
    scheduleCalculateMatchScoreJob({
      taskId: taskIdentifier,
      user: { id: userId, name: session.user?.name || "" },
      cvFile,
      jobOfferUrl,
      isAutomatic,
      deviceId: deviceId || "unknown-device",
    });

    return NextResponse.json({
      success: true,
      queued: true,
      taskId: taskIdentifier,
    }, { status: 202 });
  } catch (error) {
    console.error('Erreur lors de la mise en file du calcul de score:', error);
    return BackgroundErrors.queueError();
  }
}
