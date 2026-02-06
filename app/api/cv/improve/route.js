import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { scheduleImproveCvJob } from "@/lib/features/cv-improvement/job";
import { incrementFeatureCounter } from "@/lib/subscription/featureUsage";
import { CommonErrors, CvErrors } from "@/lib/api/apiErrors";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return CommonErrors.notAuthenticated();
  }

  try {
    const {
      cvFile,
      replaceExisting = false,
      selectedSuggestionIndices = null, // [LEGACY] array d'indices, null = toutes les suggestions
      suggestionsWithContext = null,    // [NEW] array de {index, context}
      missingSkillsToAdd = [],          // [{skill: string, level: string}]
      pipelineVersion = 2               // 2 = new 4-stage pipeline (default), 1 = legacy
    } = await request.json();

    if (!cvFile) {
      return CvErrors.missingFilename();
    }

    const userId = session.user.id;

    // Récupérer les métadonnées du CV depuis la DB avec la relation JobOffer
    const cvRecord = await prisma.cvFile.findUnique({
      where: {
        userId_filename: {
          userId,
          filename: cvFile,
        },
      },
      select: {
        jobOffer: true, // Relation vers JobOffer
        jobOfferSnapshot: true, // Snapshot pour fallback si offre supprimée
        scoreBreakdown: true,
        improvementSuggestions: true,
        sourceValue: true,
        sourceType: true,
        matchScore: true,
      },
    });

    if (!cvRecord) {
      return CvErrors.notFound();
    }

    // Vérifier que le CV a un scoreBreakdown (score calculé) et des suggestions
    if (!cvRecord.scoreBreakdown || !cvRecord.improvementSuggestions) {
      return NextResponse.json({
        error: "Ce CV ne peut pas être amélioré automatiquement",
        details: "Seuls les CV avec un score calculé peuvent être optimisés"
      }, { status: 400 });
    }

    // Parser les suggestions existantes
    let allSuggestions = [];
    try {
      allSuggestions = JSON.parse(cvRecord.improvementSuggestions);
    } catch (e) {
      console.error("Erreur parsing suggestions:", e);
    }

    // Filtrer et enrichir les suggestions avec le contexte utilisateur
    let suggestions = [];
    if (suggestionsWithContext !== null && Array.isArray(suggestionsWithContext)) {
      // Nouveau format avec contexte: [{index, context}, ...]
      suggestions = suggestionsWithContext
        .filter(s => s.index >= 0 && s.index < allSuggestions.length)
        .map(s => ({
          ...allSuggestions[s.index],
          userContext: s.context || ''
        }));
    } else if (selectedSuggestionIndices !== null && Array.isArray(selectedSuggestionIndices)) {
      // Legacy format sans contexte
      suggestions = selectedSuggestionIndices
        .filter(i => i >= 0 && i < allSuggestions.length)
        .map(i => allSuggestions[i]);
    } else {
      suggestions = allSuggestions;
    }

    // Vérifier qu'il y a soit des suggestions soit des compétences à ajouter
    const hasSuggestions = suggestions && suggestions.length > 0;
    const hasSkillsToAdd = missingSkillsToAdd && missingSkillsToAdd.length > 0;

    if (!hasSuggestions && !hasSkillsToAdd) {
      return NextResponse.json({
        error: "Aucune amélioration sélectionnée",
        details: "Sélectionnez au moins une suggestion ou une compétence à ajouter"
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
          missingSkillsToAdd,
          replaceExisting
        }),
        creditUsed: usageResult.usedCredit,
        creditTransactionId: usageResult.transactionId || null,
        featureName: usageResult.featureName || null,
        featureCounterPeriodStart: usageResult.periodStart || null,
      }
    });

    // Formater le contenu de l'offre pour l'amélioration (priorité: offre live > snapshot)
    const jobOfferContent = cvRecord.jobOffer?.content
      ? JSON.stringify(cvRecord.jobOffer.content)
      : cvRecord.jobOfferSnapshot?.content
        ? JSON.stringify(cvRecord.jobOfferSnapshot.content)
        : null;

    // Lancer l'amélioration en arrière-plan via la job queue
    scheduleImproveCvJob({
      taskId,
      user: session.user,
      cvFile,
      jobOfferContent,
      jobOfferUrl: cvRecord.sourceValue, // Gardé pour les métadonnées uniquement
      currentScore: cvRecord.matchScore || 0,
      suggestions,
      missingSkillsToAdd,
      replaceExisting,
      deviceId: request.headers.get('x-device-id') || 'unknown',
      pipelineVersion // Always pass (default is 2)
    });

    return NextResponse.json({
      success: true,
      taskId,
      message: "Amélioration en cours..."
    }, { status: 200 });

  } catch (error) {
    console.error("Error improving CV:", error);
    return CvErrors.improveError();
  }
}