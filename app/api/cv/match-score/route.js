import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { readUserCvFile } from "@/lib/cv/storage";
import { calculateMatchScore } from "@/lib/openai/calculateMatchScore";

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
    });

    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Vérifier que le CV a été créé depuis un lien
    // Les CVs depuis liens peuvent avoir createdBy = "generate-cv" ou "create-template"
    const validCreatedBy = ["generate-cv", "create-template"];
    if (!validCreatedBy.includes(cvRecord.createdBy) || cvRecord.sourceType !== "link") {
      console.log("[match-score] CV non éligible - createdBy:", cvRecord.createdBy, "sourceType:", cvRecord.sourceType);
      return NextResponse.json({ error: "CV was not created from a job offer link" }, { status: 400 });
    }

    // Rate limiting (seulement pour les refresh manuels, pas pour les calculs automatiques)
    if (!isAutomatic) {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Si first refresh est null OU plus vieux qu'1h, on reset le compteur
      if (!cvRecord.matchScoreFirstRefreshAt || cvRecord.matchScoreFirstRefreshAt < oneHourAgo) {
        // Reset le compteur
        await prisma.cvFile.update({
          where: {
            userId_filename: {
              userId,
              filename: cvFile,
            },
          },
          data: {
            matchScoreRefreshCount: 0,
            matchScoreFirstRefreshAt: null,
          },
        });
        // Recharger le record
        const updatedRecord = await prisma.cvFile.findUnique({
          where: { userId_filename: { userId, filename: cvFile } },
        });
        cvRecord.matchScoreRefreshCount = updatedRecord.matchScoreRefreshCount;
        cvRecord.matchScoreFirstRefreshAt = updatedRecord.matchScoreFirstRefreshAt;
      }

      // Vérifier la limite de 5 refresh par heure
      if (cvRecord.matchScoreRefreshCount >= 5) {
        const timeUntilReset = cvRecord.matchScoreFirstRefreshAt
          ? new Date(cvRecord.matchScoreFirstRefreshAt.getTime() + 60 * 60 * 1000)
          : new Date();
        const minutesLeft = Math.ceil((timeUntilReset - now) / (60 * 1000));

        console.log("[match-score] Rate limit atteint pour", cvFile);
        return NextResponse.json({
          error: "Rate limit exceeded",
          details: `Vous avez atteint la limite de 5 rafraîchissements par heure. Réessayez dans ${minutesLeft} minute(s).`,
          minutesLeft,
        }, { status: 429 });
      }
    }

    const jobOfferUrl = cvRecord.sourceValue;
    if (!jobOfferUrl) {
      return NextResponse.json({ error: "Job offer URL not found" }, { status: 400 });
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
    console.log("[match-score] URL de l'offre:", jobOfferUrl);
    console.log("[match-score] Taille du CV:", cvContent.length, "caractères");

    let score;
    try {
      score = await calculateMatchScore({
        cvContent,
        jobOfferUrl,
        signal: null,
      });
      console.log("[match-score] Score calculé:", score);
    } catch (error) {
      console.error("[match-score] Erreur lors du calcul du score:", error);
      console.error("[match-score] Stack trace:", error.stack);
      return NextResponse.json({
        error: "Failed to calculate match score",
        details: error.message
      }, { status: 500 });
    }

    // Sauvegarder le score dans la DB et mettre à jour le compteur de refresh
    const updateData = {
      matchScore: score,
      matchScoreUpdatedAt: new Date(),
    };

    // Si c'est un refresh manuel, incrémenter le compteur
    if (!isAutomatic) {
      const now = new Date();

      // Si c'est le premier refresh de la fenêtre, initialiser firstRefreshAt
      if (!cvRecord.matchScoreFirstRefreshAt || cvRecord.matchScoreRefreshCount === 0) {
        updateData.matchScoreFirstRefreshAt = now;
        updateData.matchScoreRefreshCount = 1;
      } else {
        updateData.matchScoreRefreshCount = cvRecord.matchScoreRefreshCount + 1;
      }

      console.log(`[match-score] Refresh manuel ${updateData.matchScoreRefreshCount}/5`);
    } else {
      console.log(`[match-score] Calcul automatique (pas de compteur)`);
    }

    await prisma.cvFile.update({
      where: {
        userId_filename: {
          userId,
          filename: cvFile,
        },
      },
      data: updateData,
    });

    console.log(`[match-score] Score calculé et sauvegardé : ${score}/100`);

    return NextResponse.json({
      success: true,
      score,
      refreshCount: updateData.matchScoreRefreshCount || cvRecord.matchScoreRefreshCount || 0,
      refreshLimit: 5,
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
        matchScoreRefreshCount: true,
        matchScoreFirstRefreshAt: true,
      },
    });

    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Calculer si le rate limit est actif
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    let canRefresh = true;
    let minutesUntilReset = 0;

    if (cvRecord.matchScoreFirstRefreshAt && cvRecord.matchScoreFirstRefreshAt > oneHourAgo) {
      // On est dans la fenêtre d'1h
      if (cvRecord.matchScoreRefreshCount >= 5) {
        canRefresh = false;
        const resetTime = new Date(cvRecord.matchScoreFirstRefreshAt.getTime() + 60 * 60 * 1000);
        minutesUntilReset = Math.ceil((resetTime - now) / (60 * 1000));
      }
    }

    return NextResponse.json({
      score: cvRecord.matchScore,
      updatedAt: cvRecord.matchScoreUpdatedAt,
      refreshCount: cvRecord.matchScoreRefreshCount || 0,
      refreshLimit: 5,
      canRefresh,
      minutesUntilReset,
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching match score:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
