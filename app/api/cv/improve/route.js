import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { scheduleImproveCvJob } from "@/lib/backgroundTasks/improveCvJob";
import { incrementFeatureCounter } from "@/lib/subscription/featureUsage";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { cvFile, replaceExisting = false } = await request.json();

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
        scoreBreakdown: true,
        improvementSuggestions: true,
        sourceValue: true,
        sourceType: true,
        matchScore: true,
      },
    });

    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Vérifier que le CV a un scoreBreakdown (score calculé) et des suggestions
    if (!cvRecord.scoreBreakdown || !cvRecord.improvementSuggestions) {
      return NextResponse.json({
        error: "Ce CV ne peut pas être amélioré automatiquement",
        details: "Seuls les CV avec un score calculé peuvent être optimisés"
      }, { status: 400 });
    }

    // Parser les suggestions existantes
    let suggestions = [];
    try {
      suggestions = JSON.parse(cvRecord.improvementSuggestions);
    } catch (e) {
      console.error("Erreur parsing suggestions:", e);
    }

    if (!suggestions || suggestions.length === 0) {
      return NextResponse.json({
        error: "Aucune suggestion d'amélioration disponible",
        details: "Générez d'abord un CV depuis une offre pour obtenir des suggestions"
      }, { status: 400 });
    }

    // Vérifier les limites ET incrémenter le compteur/débiter le crédit
    const usageResult = await incrementFeatureCounter(userId, 'optimize_cv', {});

    if (!usageResult.success) {
      return NextResponse.json({
        error: usageResult.error,
        actionRequired: usageResult.actionRequired,
        redirectUrl: usageResult.redirectUrl
      }, { status: 403 });
    }

    // Créer une tâche d'amélioration
    const taskId = uuidv4();

    await prisma.backgroundTask.create({
      data: {
        id: taskId,
        title: `Amélioration du CV - Score actuel: ${cvRecord.matchScore || 0}/100`,
        type: 'improve-cv',
        status: 'queued',
        createdAt: Date.now(),
        shouldUpdateCvList: true,
        deviceId: request.headers.get('x-device-id') || 'unknown',
        userId,
        cvFile, // Lien direct vers le CV
        payload: JSON.stringify({
          cvFile,
          jobOfferUrl: cvRecord.sourceValue,
          currentScore: cvRecord.matchScore || 0,
          suggestions,
          replaceExisting
        }),
        creditUsed: usageResult.usedCredit,
        creditTransactionId: usageResult.transactionId || null,
        featureName: usageResult.featureName || null,
        featureCounterPeriodStart: usageResult.periodStart || null,
      }
    });

    // Lancer l'amélioration en arrière-plan via la job queue
    scheduleImproveCvJob({
      taskId,
      user: session.user,
      cvFile,
      jobOfferContent: cvRecord.extractedJobOffer,
      jobOfferUrl: cvRecord.sourceValue, // Gardé pour les métadonnées uniquement
      currentScore: cvRecord.matchScore || 0,
      suggestions,
      replaceExisting,
      deviceId: request.headers.get('x-device-id') || 'unknown'
    });

    return NextResponse.json({
      success: true,
      taskId,
      message: "Amélioration en cours..."
    }, { status: 200 });

  } catch (error) {
    console.error("Error improving CV:", error);
    return NextResponse.json({
      error: "Internal server error",
      details: error.message
    }, { status: 500 });
  }
}