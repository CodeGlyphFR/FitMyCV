import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { scheduleCalculateMatchScoreJob } from "@/lib/backgroundTasks/calculateMatchScoreJob";

const TOKEN_LIMIT = 5;

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
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { cvFile, isAutomatic = false, taskId, deviceId } = body;

    if (!cvFile) {
      return NextResponse.json({ error: "CV file missing" }, { status: 400 });
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
        extractedJobOffer: true,
        sourceValue: true,
        sourceType: true,
      },
    });

    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Vérifier que le CV a une analyse d'offre d'emploi en base
    if (!cvRecord.extractedJobOffer) {
      console.log("[calculate-match-score] CV non éligible - pas d'extractedJobOffer");
      return NextResponse.json({ error: "CV does not have a job offer analysis" }, { status: 400 });
    }

    // Rate limiting GLOBAL (au niveau utilisateur, pas par CV)
    if (!isAutomatic) {
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

      // Si first refresh est null OU plus vieux que 24h, on reset le compteur
      if (!firstRefreshAt || firstRefreshAt < oneDayAgo) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            matchScoreRefreshCount: TOKEN_LIMIT,
            matchScoreFirstRefreshAt: null,
          },
        });
        refreshCount = TOKEN_LIMIT;
        firstRefreshAt = null;
      }

      // Vérifier si plus de tokens disponibles (GLOBAL pour tous les CVs)
      if (refreshCount === 0) {
        const timeUntilReset = firstRefreshAt
          ? new Date(firstRefreshAt.getTime() + 24 * 60 * 60 * 1000)
          : new Date();
        const totalMinutesLeft = Math.ceil((timeUntilReset - now) / (60 * 1000));
        const hoursLeft = Math.floor(totalMinutesLeft / 60);
        const minutesLeft = totalMinutesLeft % 60;

        console.log("[calculate-match-score] Plus de tokens disponibles pour l'utilisateur", userId);
        return NextResponse.json({
          error: "No tokens available",
          details: `Vous n'avez plus de tokens disponibles. Réessayez dans ${hoursLeft}h${minutesLeft}m.`,
          hoursLeft,
          minutesLeft,
        }, { status: 429 });
      }

      // ✅ DÉCRÉMENTER LE COMPTEUR IMMÉDIATEMENT (anti-fraude)
      // Si la tâche échoue, le job l'incrémentera pour restituer le token
      if (!firstRefreshAt || refreshCount === TOKEN_LIMIT) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            matchScoreFirstRefreshAt: now,
            matchScoreRefreshCount: TOKEN_LIMIT - 1,
          },
        });
        console.log(`[calculate-match-score] ✅ Token consommé immédiatement: ${TOKEN_LIMIT - 1}/${TOKEN_LIMIT} restants`);
      } else {
        await prisma.user.update({
          where: { id: userId },
          data: {
            matchScoreRefreshCount: refreshCount - 1,
          },
        });
        console.log(`[calculate-match-score] ✅ Token consommé immédiatement: ${refreshCount - 1}/${TOKEN_LIMIT} restants`);
      }
    }

    const jobOfferUrl = cvRecord.sourceValue;
    if (!jobOfferUrl) {
      return NextResponse.json({ error: "Job offer URL not found" }, { status: 400 });
    }

    // Créer un identifiant de tâche
    const taskIdentifier = typeof taskId === "string" && taskId.trim()
      ? taskId.trim()
      : `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const existingTask = await prisma.backgroundTask.findUnique({ where: { id: taskIdentifier } });

    const payload = {
      cvFile,
      jobOfferUrl,
      isAutomatic,
    };

    const taskData = {
      title: `Calcul du score de match en cours...`,
      successMessage: `Score de match calculé avec succès`,
      type: 'calculate-match-score',
      status: 'queued',
      shouldUpdateCvList: false, // Pas besoin de rafraîchir la liste des CVs
      error: null,
      result: null,
      deviceId: deviceId || "unknown-device",
      cvFile, // Lien direct vers le CV
      payload: JSON.stringify(payload),
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
    return NextResponse.json({ error: "Erreur lors de la mise en file du calcul de score." }, { status: 500 });
  }
}
