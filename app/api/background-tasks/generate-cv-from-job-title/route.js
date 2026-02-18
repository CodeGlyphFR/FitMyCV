import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { ensureUserCvDir } from "@/lib/cv-core/storage";
import { scheduleGenerateCvFromJobTitleJob } from "@/lib/features/job-title-generation/job";
import { incrementFeatureCounter } from "@/lib/subscription/featureUsage";
import { verifyRecaptcha } from "@/lib/recaptcha/verifyRecaptcha";
import { CommonErrors, AuthErrors, BackgroundErrors } from "@/lib/api/apiErrors";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return CommonErrors.notAuthenticated();
  }

  try {
    const formData = await request.formData();
    const jobTitle = formData.get("jobTitle");
    const language = formData.get("language") || "français";
    const rawModel = formData.get("model");
    const deviceId = formData.get("deviceId") || "unknown-device";
    const recaptchaToken = formData.get("recaptchaToken");

    // Vérification reCAPTCHA (obligatoire en production)
    if (process.env.NODE_ENV === 'production' && process.env.BYPASS_RECAPTCHA !== 'true') {
      if (!recaptchaToken) {
        return AuthErrors.recaptchaFailed();
      }
    }
    if (recaptchaToken) {
      const recaptchaResult = await verifyRecaptcha(recaptchaToken, {
        callerName: 'generate-cv-from-job-title',
        scoreThreshold: 0.5,
      });

      if (!recaptchaResult.success) {
        return AuthErrors.recaptchaFailed();
      }
    }

    if (!jobTitle || typeof jobTitle !== "string" || !jobTitle.trim()) {
      return BackgroundErrors.noJobTitleProvided();
    }

    const trimmedJobTitle = jobTitle.trim();
    const requestedModel = typeof rawModel === "string" ? rawModel.trim() : "";

    const userId = session.user.id;

    await ensureUserCvDir(userId);

    // Générer le taskId AVANT le débit pour pouvoir le lier à la transaction
    const timestamp = Date.now();
    const taskId = `task_job_title_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    // Vérifier les limites ET incrémenter le compteur/débiter le crédit
    const usageResult = await incrementFeatureCounter(userId, 'generate_from_job_title', { taskId });

    if (!usageResult.success) {
      return NextResponse.json({
        error: usageResult.error,
        actionRequired: usageResult.actionRequired,
        redirectUrl: usageResult.redirectUrl
      }, { status: 403 });
    }

    const title = `Génération de CV pour "${trimmedJobTitle}"`;
    const successMessage = JSON.stringify({ key: 'taskQueue.messages.jobTitleCreationCompleted', params: { title: trimmedJobTitle } });

    const taskPayload = {
      jobTitle: trimmedJobTitle,
      language: language,
      model: requestedModel,
    };

    await prisma.backgroundTask.create({
      data: {
        id: taskId,
        userId,
        createdAt: BigInt(timestamp),
        title,
        successMessage,
        type: 'job-title-generation',
        status: 'queued',
        shouldUpdateCvList: true,
        error: null,
        result: null,
        deviceId,
        payload: JSON.stringify(taskPayload),
        creditUsed: usageResult.usedCredit,
        creditTransactionId: usageResult.transactionId || null,
        featureName: usageResult.featureName || null,
        featureCounterPeriodStart: usageResult.periodStart || null,
      },
    });

    scheduleGenerateCvFromJobTitleJob({
      taskId,
      user: { id: userId, name: session.user?.name || "" },
      payload: taskPayload,
      deviceId,
    });

    console.log(`[generate-cv-from-job-title] ✅ Génération lancée pour l'utilisateur ${userId}`);

    return NextResponse.json({
      success: true,
      queued: true,
      taskId,
    }, { status: 202 });
  } catch (error) {
    console.error('Erreur lors de la mise en file de la génération de CV depuis titre:', error);
    return BackgroundErrors.queueError();
  }
}
