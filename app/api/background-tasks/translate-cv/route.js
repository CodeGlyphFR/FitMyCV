import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { scheduleTranslateCvJob } from "@/lib/backgroundTasks/translateCvJob";
import { incrementFeatureCounter } from "@/lib/subscription/featureUsage";
import { verifyRecaptcha } from "@/lib/recaptcha/verifyRecaptcha";
import { CommonErrors, AuthErrors, BackgroundErrors } from "@/lib/api/apiErrors";

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
    const { sourceFile, targetLanguage, taskId, deviceId, recaptchaToken } = body;

    // Vérification reCAPTCHA (optionnelle pour compatibilité, mais recommandée)
    if (recaptchaToken) {
      const recaptchaResult = await verifyRecaptcha(recaptchaToken, {
        callerName: 'translate-cv',
        scoreThreshold: 0.5,
      });

      if (!recaptchaResult.success) {
        return AuthErrors.recaptchaFailed();
      }
    }

    if (!sourceFile) {
      return BackgroundErrors.cvFileMissing();
    }

    if (!targetLanguage || !['fr', 'en', 'es', 'de'].includes(targetLanguage)) {
      return BackgroundErrors.invalidTargetLanguage();
    }

    const userId = session.user.id;

    // Vérifier les limites ET incrémenter le compteur/débiter le crédit
    const usageResult = await incrementFeatureCounter(userId, 'translate_cv', {});

    if (!usageResult.success) {
      return NextResponse.json({
        error: usageResult.error,
        actionRequired: usageResult.actionRequired,
        redirectUrl: usageResult.redirectUrl
      }, { status: 403 });
    }

    const taskIdentifier = typeof taskId === "string" && taskId.trim()
      ? taskId.trim()
      : `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const existingTask = await prisma.backgroundTask.findUnique({ where: { id: taskIdentifier } });

    const languageNames = {
      fr: 'français',
      en: 'anglais',
      es: 'español',
      de: 'deutsch'
    };

    const payload = {
      sourceFile,
      targetLanguage,
    };

    const taskData = {
      title: `Traduction en cours...`,
      successMessage: `CV traduit en ${languageNames[targetLanguage]} avec succès`,
      type: 'translate-cv',
      status: 'queued',
      shouldUpdateCvList: true,
      error: null,
      result: null,
      deviceId: deviceId || "unknown-device",
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

    scheduleTranslateCvJob({
      taskId: taskIdentifier,
      user: { id: userId, name: session.user?.name || "" },
      sourceFile,
      targetLanguage,
      deviceId: deviceId || "unknown-device",
    });

    return NextResponse.json({
      success: true,
      queued: true,
      taskId: taskIdentifier,
    }, { status: 202 });
  } catch (error) {
    console.error('Erreur lors de la mise en file de la traduction:', error);
    return BackgroundErrors.queueError();
  }
}
