import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { ensureUserCvDir } from "@/lib/cv/storage";
import { scheduleGenerateCvFromJobTitleJob } from "@/lib/backgroundTasks/generateCvFromJobTitleJob";

const TOKEN_LIMIT = 5;

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const jobTitle = formData.get("jobTitle");
    const language = formData.get("language") || "français";
    const rawAnalysisLevel = formData.get("analysisLevel");
    const rawModel = formData.get("model");
    const deviceId = formData.get("deviceId") || "unknown-device";

    if (!jobTitle || typeof jobTitle !== "string" || !jobTitle.trim()) {
      return NextResponse.json({ error: "Titre de poste manquant." }, { status: 400 });
    }

    const trimmedJobTitle = jobTitle.trim();

    const requestedAnalysisLevel = typeof rawAnalysisLevel === "string" ? rawAnalysisLevel.trim().toLowerCase() : "medium";
    const requestedModel = typeof rawModel === "string" ? rawModel.trim() : "";

    const userId = session.user.id;

    // Rate limiting GLOBAL (au niveau utilisateur)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Récupérer l'utilisateur avec ses compteurs de refresh
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        matchScoreRefreshCount: true,
        matchScoreFirstRefreshAt: true,
      },
    });

    let refreshCount = user?.matchScoreRefreshCount || 0;
    let firstRefreshAt = user?.matchScoreFirstRefreshAt;

    // Reset UNIQUEMENT si tokens à 0 ET 24h écoulées
    if (refreshCount === 0 && firstRefreshAt && firstRefreshAt < oneDayAgo) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          matchScoreRefreshCount: TOKEN_LIMIT,
          matchScoreFirstRefreshAt: null,
        },
      });
      refreshCount = TOKEN_LIMIT;
      firstRefreshAt = null;
      console.log(`[generate-cv-from-job-title] ✅ Reset des tokens après 24h: ${TOKEN_LIMIT}/${TOKEN_LIMIT}`);
    }

    // Vérifier si plus de tokens disponibles (GLOBAL pour tous les CVs)
    if (refreshCount === 0) {
      const timeUntilReset = firstRefreshAt
        ? new Date(firstRefreshAt.getTime() + 24 * 60 * 60 * 1000)
        : new Date();
      const totalMinutesLeft = Math.ceil((timeUntilReset - now) / (60 * 1000));
      const hoursLeft = Math.floor(totalMinutesLeft / 60);
      const minutesLeft = totalMinutesLeft % 60;

      console.log("[generate-cv-from-job-title] Plus de tokens disponibles pour l'utilisateur", userId);
      return NextResponse.json({
        error: "No tokens available",
        details: `Vous n'avez plus de tokens disponibles. Réessayez dans ${hoursLeft}h${minutesLeft}m.`,
        hoursLeft,
        minutesLeft,
      }, { status: 429 });
    }

    await ensureUserCvDir(userId);

    const timestamp = Date.now();
    const taskId = `task_job_title_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    const title = `Génération de CV pour "${trimmedJobTitle}"`;
    const successMessage = `CV pour "${trimmedJobTitle}" créé avec succès`;

    const taskPayload = {
      jobTitle: trimmedJobTitle,
      language: language,
      analysisLevel: requestedAnalysisLevel,
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
      },
    });

    scheduleGenerateCvFromJobTitleJob({
      taskId,
      user: { id: userId, name: session.user?.name || "" },
      payload: taskPayload,
      deviceId,
    });

    // Décrémenter le compteur GLOBAL de l'utilisateur
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        matchScoreRefreshCount: true,
        matchScoreFirstRefreshAt: true,
      },
    });

    // Si c'est la première utilisation ever, initialiser firstRefreshAt
    if (!currentUser?.matchScoreFirstRefreshAt) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          matchScoreFirstRefreshAt: new Date(),
          matchScoreRefreshCount: TOKEN_LIMIT - 1,
        },
      });
      console.log(`[generate-cv-from-job-title] ✅ Génération lancée - Tokens restants: ${TOKEN_LIMIT - 1}/${TOKEN_LIMIT}`);
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: {
          matchScoreRefreshCount: currentUser.matchScoreRefreshCount - 1,
        },
      });
      console.log(`[generate-cv-from-job-title] ✅ Génération lancée - Tokens restants: ${currentUser.matchScoreRefreshCount - 1}/${TOKEN_LIMIT}`);
    }

    return NextResponse.json({
      success: true,
      queued: true,
      taskId,
      refreshCount: currentUser?.matchScoreRefreshCount ? currentUser.matchScoreRefreshCount - 1 : TOKEN_LIMIT - 1,
      refreshLimit: TOKEN_LIMIT,
    }, { status: 202 });
  } catch (error) {
    console.error('Erreur lors de la mise en file de la génération de CV depuis titre:', error);
    return NextResponse.json({ error: "Erreur lors de la mise en file de la génération." }, { status: 500 });
  }
}
