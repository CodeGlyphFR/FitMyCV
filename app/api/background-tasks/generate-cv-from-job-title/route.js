import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { ensureUserCvDir } from "@/lib/cv/storage";
import { scheduleGenerateCvFromJobTitleJob } from "@/lib/backgroundTasks/generateCvFromJobTitleJob";

const ANALYSIS_MODEL_MAP = Object.freeze({
  rapid: "gpt-5-nano-2025-08-07",
  medium: "gpt-5-mini-2025-08-07",
  deep: "gpt-5-2025-08-07",
});

const DEFAULT_ANALYSIS_LEVEL = "medium";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const jobTitle = formData.get("jobTitle");
    const rawAnalysisLevel = formData.get("analysisLevel");
    const rawModel = formData.get("model");
    const deviceId = formData.get("deviceId") || "unknown-device";

    if (!jobTitle || typeof jobTitle !== "string" || !jobTitle.trim()) {
      return NextResponse.json({ error: "Titre de poste manquant." }, { status: 400 });
    }

    const trimmedJobTitle = jobTitle.trim();

    const requestedAnalysisLevel = typeof rawAnalysisLevel === "string" ? rawAnalysisLevel.trim().toLowerCase() : "";
    const requestedModel = typeof rawModel === "string" ? rawModel.trim() : "";

    const levelKey = ANALYSIS_MODEL_MAP[requestedAnalysisLevel]
      ? requestedAnalysisLevel
      : (Object.entries(ANALYSIS_MODEL_MAP).find(([, value]) => value === requestedModel)?.[0]
        || DEFAULT_ANALYSIS_LEVEL);

    const userId = session.user.id;
    await ensureUserCvDir(userId);

    const now = Date.now();
    const taskId = `task_job_title_${now}_${Math.random().toString(36).substr(2, 9)}`;

    const title = `Génération de CV pour "${trimmedJobTitle}"`;
    const successMessage = `CV pour "${trimmedJobTitle}" créé avec succès`;

    const taskPayload = {
      jobTitle: trimmedJobTitle,
      analysisLevel: levelKey,
      model: requestedModel,
    };

    await prisma.backgroundTask.create({
      data: {
        id: taskId,
        userId,
        createdAt: BigInt(now),
        title,
        successMessage,
        type: 'job-title-generation',
        status: 'queued',
        shouldUpdateCvList: true,
        error: null,
        result: null,
        deviceId,
        payload: JSON.stringify(taskPayload),
      },
    });

    scheduleGenerateCvFromJobTitleJob({
      taskId,
      user: { id: userId, name: session.user?.name || "" },
      payload: taskPayload,
      deviceId,
    });

    return NextResponse.json({
      success: true,
      queued: true,
      taskId,
    }, { status: 202 });
  } catch (error) {
    console.error('Erreur lors de la mise en file de la génération de CV depuis titre:', error);
    return NextResponse.json({ error: "Erreur lors de la mise en file de la génération." }, { status: 500 });
  }
}
