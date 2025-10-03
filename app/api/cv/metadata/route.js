import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";

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

    // Récupérer les métadonnées enrichies du CV
    const cvRecord = await prisma.cvFile.findUnique({
      where: {
        userId_filename: {
          userId,
          filename: cvFile,
        },
      },
      select: {
        filename: true,
        sourceType: true,
        sourceValue: true,
        createdBy: true,
        analysisLevel: true,
        matchScore: true,
        matchScoreUpdatedAt: true,
        scoreBreakdown: true,
        improvementSuggestions: true,
        missingSkills: true,
        matchingSkills: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    return NextResponse.json(cvRecord, { status: 200 });
  } catch (error) {
    console.error("Error fetching CV metadata:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}