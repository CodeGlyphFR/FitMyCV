import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { promises as fs } from "fs";
import path from "path";
import { calculateMatchScore } from "@/lib/openai/calculateMatchScore";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { cvFile } = await request.json();

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
    if (cvRecord.createdBy !== "generate-cv" || !cvRecord.sourceType || cvRecord.sourceType !== "link") {
      return NextResponse.json({ error: "CV was not created from a job offer link" }, { status: 400 });
    }

    const jobOfferUrl = cvRecord.sourceValue;
    if (!jobOfferUrl) {
      return NextResponse.json({ error: "Job offer URL not found" }, { status: 400 });
    }

    // Lire le contenu du CV depuis le fichier
    const cvDir = path.join(process.cwd(), "data", "users", userId, "cv");
    const cvPath = path.join(cvDir, cvFile);

    let cvContent;
    try {
      const fileContent = await fs.readFile(cvPath, "utf-8");
      cvContent = fileContent;
    } catch (error) {
      console.error("Error reading CV file:", error);
      return NextResponse.json({ error: "Failed to read CV file" }, { status: 500 });
    }

    // Calculer le score de match avec GPT (sans worker, en direct)
    console.log("[match-score] Calcul du score de match pour", cvFile);

    let score;
    try {
      score = await calculateMatchScore({
        cvContent,
        jobOfferUrl,
        signal: null,
      });
    } catch (error) {
      console.error("[match-score] Erreur lors du calcul du score:", error);
      return NextResponse.json({ error: "Failed to calculate match score" }, { status: 500 });
    }

    // Sauvegarder le score dans la DB (ajouter un champ matchScore)
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

    console.log(`[match-score] Score calculé et sauvegardé : ${score}/100`);

    return NextResponse.json({ success: true, score }, { status: 200 });
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
      },
    });

    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    return NextResponse.json({
      score: cvRecord.matchScore,
      updatedAt: cvRecord.matchScoreUpdatedAt,
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching match score:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
