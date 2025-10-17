import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { readUserCvFile } from "@/lib/cv/storage";
import { calculateMatchScore } from "@/lib/openai/calculateMatchScore";

const TOKEN_LIMIT = 5;

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
      },
    });

    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Vérifier que le CV a une analyse d'offre d'emploi en base
    if (!cvRecord.extractedJobOffer) {
      console.log("[match-score] CV non éligible - pas d'extractedJobOffer");
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
        console.log(`[match-score] ✅ Reset des tokens après 24h: ${TOKEN_LIMIT}/${TOKEN_LIMIT}`);
      }

      // Vérifier si plus de tokens disponibles (GLOBAL pour tous les CVs)
      if (refreshCount === 0) {
        const timeUntilReset = firstRefreshAt
          ? new Date(firstRefreshAt.getTime() + 24 * 60 * 60 * 1000)
          : new Date();
        const totalMinutesLeft = Math.ceil((timeUntilReset - now) / (60 * 1000));
        const hoursLeft = Math.floor(totalMinutesLeft / 60);
        const minutesLeft = totalMinutesLeft % 60;

        console.log("[match-score] Plus de tokens disponibles pour l'utilisateur", userId);
        return NextResponse.json({
          error: "No tokens available",
          details: `Vous n'avez plus de tokens disponibles. Réessayez dans ${hoursLeft}h${minutesLeft}m.`,
          hoursLeft,
          minutesLeft,
        }, { status: 429 });
      }
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

    let score;
    try {
      score = await calculateMatchScore({
        cvContent,
        jobOfferUrl: jobOfferIdentifier, // Peut être URL ou nom fichier, mais extractedJobOffer est en cache
        signal: null,
      });
      console.log("[match-score] Score calculé:", score);
    } catch (error) {
      console.error("[match-score] Erreur lors du calcul du score:", error);
      console.error("[match-score] Stack trace:", error.stack);
      // IMPORTANT: En cas d'erreur, on retourne SANS incrémenter le compteur
      return NextResponse.json({
        error: "Failed to calculate match score",
        details: error.message
      }, { status: 500 });
    }

    // ✅ Le score a été calculé avec succès, on peut maintenant sauvegarder et incrémenter le compteur

    // Sauvegarder le score dans le CV
    await prisma.cvFile.update({
      where: {
        userId_filename: {
          userId,
          filename: cvFile,
        },
      },
      data: {
        matchScore: score,
        matchScoreUpdatedAt: new Date(),
      },
    });

    let finalRefreshCount = 0;

    // Si c'est un refresh manuel, décrémenter le compteur GLOBAL de l'utilisateur
    if (!isAutomatic) {
      const now = new Date();

      // Récupérer les infos actuelles de l'utilisateur
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          matchScoreRefreshCount: true,
          matchScoreFirstRefreshAt: true,
        },
      });

      // Si c'est la première utilisation ever, initialiser firstRefreshAt
      if (!user?.matchScoreFirstRefreshAt) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            matchScoreFirstRefreshAt: now,
            matchScoreRefreshCount: TOKEN_LIMIT - 1,
          },
        });
        finalRefreshCount = TOKEN_LIMIT - 1;
      } else {
        await prisma.user.update({
          where: { id: userId },
          data: {
            matchScoreRefreshCount: user.matchScoreRefreshCount - 1,
          },
        });
        finalRefreshCount = user.matchScoreRefreshCount - 1;
      }

      console.log(`[match-score] ✅ Calcul réussi - Tokens restants: ${finalRefreshCount}/${TOKEN_LIMIT}`);
    } else {
      console.log(`[match-score] ✅ Calcul automatique réussi (pas de compteur)`);
    }

    console.log(`[match-score] Score calculé et sauvegardé : ${score}/100`);

    return NextResponse.json({
      success: true,
      score,
      refreshCount: finalRefreshCount,
      refreshLimit: TOKEN_LIMIT,
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

    if (!cvFile) {
      return NextResponse.json({ error: "CV file missing" }, { status: 400 });
    }

    const userId = session.user.id;

    const cvRecord = await prisma.cvFile.findUnique({
      where: {
        userId_filename: {
          userId,
          filename: cvFile,
        },
      },
      select: {
        matchScore: true,
        matchScoreUpdatedAt: true,
        matchScoreStatus: true,
        scoreBreakdown: true,
        improvementSuggestions: true,
        missingSkills: true,
        matchingSkills: true,
        optimiseStatus: true,
        extractedJobOffer: true,
        sourceValue: true,
      },
    });

    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Calculer si le rate limit GLOBAL est actif (au niveau utilisateur)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Récupérer les infos de l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        matchScoreRefreshCount: true,
        matchScoreFirstRefreshAt: true,
      },
    });

    let canRefresh = true;
    let hoursUntilReset = 0;
    let minutesUntilReset = 0;
    let refreshCount = user?.matchScoreRefreshCount || 0;

    if (user?.matchScoreFirstRefreshAt && user.matchScoreFirstRefreshAt > oneDayAgo) {
      // On est dans la fenêtre de 24h
      if (refreshCount === 0) {
        canRefresh = false;
        const resetTime = new Date(user.matchScoreFirstRefreshAt.getTime() + 24 * 60 * 60 * 1000);
        const totalMinutesLeft = Math.ceil((resetTime - now) / (60 * 1000));
        hoursUntilReset = Math.floor(totalMinutesLeft / 60);
        minutesUntilReset = totalMinutesLeft % 60;
      }
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
      updatedAt: cvRecord.matchScoreUpdatedAt,
      status: cvRecord.matchScoreStatus || 'idle', // Status du calcul: 'idle', 'inprogress', 'failed'
      scoreBreakdown,
      improvementSuggestions,
      missingSkills,
      matchingSkills,
      optimiseStatus: cvRecord.optimiseStatus || 'idle',
      hasExtractedJobOffer: !!cvRecord.extractedJobOffer, // Boolean pour savoir si on peut calculer le score
      hasScoreBreakdown: !!cvRecord.scoreBreakdown, // Boolean pour savoir si on peut optimiser
      sourceValue: cvRecord.sourceValue,
      refreshCount, // Tokens restants pour l'utilisateur
      refreshLimit: TOKEN_LIMIT,
      canRefresh,
      hoursUntilReset,
      minutesUntilReset,
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching match score:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
