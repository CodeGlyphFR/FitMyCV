import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { readUserCvFile } from "@/lib/cv-core/storage";
import { calculateMatchScoreWithAnalysis } from "@/lib/scoring/service";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { cvFile, isAutomatic = false } = await request.json();

    if (!cvFile) {
      return NextResponse.json({ error: "CV file missing" }, { status: 400 });
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
        sourceValue: true,
      },
    });

    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Vérifier que le CV a une offre d'emploi associée (live ou snapshot)
    if (!cvRecord.jobOffer && !cvRecord.jobOfferSnapshot) {
      console.log("[match-score] CV non éligible - pas de jobOffer ni jobOfferSnapshot");
      return NextResponse.json({ error: "CV does not have a job offer analysis" }, { status: 400 });
    }

    const jobOfferIdentifier = cvRecord.sourceValue; // URL ou nom de fichier PDF
    if (!jobOfferIdentifier) {
      return NextResponse.json({ error: "Job offer source not found" }, { status: 400 });
    }

    // Lire et décrypter le contenu du CV
    console.log("[match-score] Lecture du CV:", cvFile);

    let cvContent;
    try {
      cvContent = await readUserCvFile(userId, cvFile);
      console.log("[match-score] CV lu et décrypté avec succès");
    } catch (error) {
      console.error("[match-score] Error reading CV file:", error);
      return NextResponse.json({ error: "Failed to read CV file" }, { status: 500 });
    }

    // Calculer le score de match avec GPT (sans worker, en direct)
    console.log("[match-score] Calcul du score de match pour", cvFile);
    console.log("[match-score] Source de l'offre:", jobOfferIdentifier);
    console.log("[match-score] Taille du CV:", cvContent.length, "caractères");

    let result;
    try {
      result = await calculateMatchScoreWithAnalysis({
        cvContent,
        jobOfferUrl: jobOfferIdentifier,
        cvFile: cvRecord, // Passer le record DB pour accéder à jobOffer.content
        signal: null,
        userId,
      });
      console.log("[match-score] Score calculé:", result.matchScore);
    } catch (error) {
      console.error("[match-score] Erreur lors du calcul du score:", error);
      console.error("[match-score] Stack trace:", error.stack);
      // IMPORTANT: En cas d'erreur, on retourne SANS incrémenter le compteur
      return NextResponse.json({
        error: "Failed to calculate match score",
      }, { status: 500 });
    }

    // ✅ Le score a été calculé avec succès, on peut maintenant sauvegarder

    // Sauvegarder le score et l'analyse dans le CV
    await prisma.cvFile.update({
      where: {
        userId_filename: {
          userId,
          filename: cvFile,
        },
      },
      data: {
        matchScore: result.matchScore,
        matchScoreUpdatedAt: new Date(),
        scoreBreakdown: JSON.stringify(result.scoreBreakdown),
        improvementSuggestions: JSON.stringify(result.suggestions),
        missingSkills: JSON.stringify(result.missingSkills),
        matchingSkills: JSON.stringify(result.matchingSkills),
        // Réinitialiser scoreBefore car ce n'est pas une optimisation
        // (scoreBefore ne doit être affiché qu'après une optimisation IA)
        scoreBefore: null,
      },
    });

    console.log(`[match-score] Score calculé et sauvegardé : ${result.matchScore}/100`);

    return NextResponse.json({
      success: true,
      score: result.matchScore,
      scoreBreakdown: result.scoreBreakdown,
      suggestions: result.suggestions,
      missingSkills: result.missingSkills,
      matchingSkills: result.matchingSkills,
    }, { status: 200 });
  } catch (error) {
    console.error("Error calculating match score:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET endpoint pour récupérer le score existant
export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const cvFile = searchParams.get("file");
    const versionParam = searchParams.get("version");

    if (!cvFile) {
      return NextResponse.json({ error: "CV file missing" }, { status: 400 });
    }

    const userId = session.user.id;

    // Si on demande une version spécifique (pas 'latest')
    if (versionParam && versionParam !== 'latest') {
      const versionNumber = parseInt(versionParam, 10);
      if (isNaN(versionNumber)) {
        return NextResponse.json({ error: "Invalid version number" }, { status: 400 });
      }

      // Récupérer le score depuis CvVersion
      const cvFileRecord = await prisma.cvFile.findUnique({
        where: { userId_filename: { userId, filename: cvFile } },
        select: {
          jobOfferId: true,
          jobOfferSnapshot: true, // Snapshot pour fallback si offre supprimée
          sourceValue: true,
          versions: {
            where: { version: versionNumber },
            select: {
              matchScore: true,
              scoreBreakdown: true,
              improvementSuggestions: true,
              missingSkills: true,
              matchingSkills: true,
            },
          },
        },
      });

      if (!cvFileRecord) {
        return NextResponse.json({ error: "CV not found" }, { status: 404 });
      }

      const versionRecord = cvFileRecord.versions?.[0];
      if (!versionRecord) {
        return NextResponse.json({ error: "Version not found" }, { status: 404 });
      }

      // Parser les JSON strings
      let scoreBreakdown = null;
      let improvementSuggestions = null;
      let missingSkills = null;
      let matchingSkills = null;

      try {
        if (versionRecord.scoreBreakdown) scoreBreakdown = JSON.parse(versionRecord.scoreBreakdown);
        if (versionRecord.improvementSuggestions) improvementSuggestions = JSON.parse(versionRecord.improvementSuggestions);
        if (versionRecord.missingSkills) missingSkills = JSON.parse(versionRecord.missingSkills);
        if (versionRecord.matchingSkills) matchingSkills = JSON.parse(versionRecord.matchingSkills);
      } catch (e) {
        console.error("[match-score] Erreur parsing JSON (version):", e);
      }

      return NextResponse.json({
        score: versionRecord.matchScore,
        scoreBefore: null, // Pas de scoreBefore pour les anciennes versions
        updatedAt: null,
        status: 'idle',
        scoreBreakdown,
        improvementSuggestions,
        missingSkills,
        matchingSkills,
        optimiseStatus: 'idle',
        hasJobOffer: !!cvFileRecord.jobOfferId || !!cvFileRecord.jobOfferSnapshot,
        hasScoreBreakdown: !!versionRecord.scoreBreakdown,
        sourceValue: cvFileRecord.sourceValue,
        isHistoricalVersion: true, // Flag pour le frontend (mode lecture seule)
      }, { status: 200 });
    }

    // Comportement par défaut: score du CvFile actuel
    const cvRecord = await prisma.cvFile.findUnique({
      where: {
        userId_filename: {
          userId,
          filename: cvFile,
        },
      },
      select: {
        matchScore: true,
        scoreBefore: true, // Score avant optimisation
        matchScoreUpdatedAt: true,
        matchScoreStatus: true,
        scoreBreakdown: true,
        improvementSuggestions: true,
        missingSkills: true,
        matchingSkills: true,
        optimiseStatus: true,
        jobOfferId: true, // Vérifier si un JobOffer est associé
        jobOfferSnapshot: true, // Snapshot pour fallback si offre supprimée
        sourceValue: true,
      },
    });

    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Parser les JSON strings
    let scoreBreakdown = null;
    let improvementSuggestions = null;
    let missingSkills = null;
    let matchingSkills = null;

    try {
      if (cvRecord.scoreBreakdown) scoreBreakdown = JSON.parse(cvRecord.scoreBreakdown);
      if (cvRecord.improvementSuggestions) improvementSuggestions = JSON.parse(cvRecord.improvementSuggestions);
      if (cvRecord.missingSkills) missingSkills = JSON.parse(cvRecord.missingSkills);
      if (cvRecord.matchingSkills) matchingSkills = JSON.parse(cvRecord.matchingSkills);
    } catch (e) {
      console.error("[match-score] Erreur parsing JSON:", e);
    }

    return NextResponse.json({
      score: cvRecord.matchScore,
      scoreBefore: cvRecord.scoreBefore, // Score avant optimisation (null si pas d'optimisation)
      updatedAt: cvRecord.matchScoreUpdatedAt,
      status: cvRecord.matchScoreStatus || 'idle', // Status du calcul: 'idle', 'inprogress', 'failed'
      scoreBreakdown,
      improvementSuggestions,
      missingSkills,
      matchingSkills,
      optimiseStatus: cvRecord.optimiseStatus || 'idle',
      hasJobOffer: !!cvRecord.jobOfferId || !!cvRecord.jobOfferSnapshot, // Boolean pour savoir si on peut calculer le score
      hasScoreBreakdown: !!cvRecord.scoreBreakdown, // Boolean pour savoir si on peut optimiser
      sourceValue: cvRecord.sourceValue,
      isHistoricalVersion: false, // Version courante
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching match score:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
