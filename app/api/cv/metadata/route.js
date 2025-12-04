import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { CommonErrors, CvErrors } from "@/lib/api/apiErrors";

export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return CommonErrors.notAuthenticated();
  }

  try {
    const { searchParams } = new URL(request.url);
    const cvFile = searchParams.get("file");

    if (!cvFile) {
      return CvErrors.missingFilename();
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
        matchScoreStatus: true,
        scoreBreakdown: true,
        improvementSuggestions: true,
        missingSkills: true,
        matchingSkills: true,
        optimiseStatus: true,
        optimiseUpdatedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!cvRecord) {
      return CvErrors.notFound();
    }

    return NextResponse.json(cvRecord, { status: 200 });
  } catch (error) {
    console.error("Error fetching CV metadata:", error);
    return CvErrors.metadataError();
  }
}