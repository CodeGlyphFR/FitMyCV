import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const cvCookie = (cookies().get("cvFile") || {}).value;

    if (!cvCookie) {
      return NextResponse.json({
        sourceType: null,
        sourceValue: null,
        hasExtractedJobOffer: false,
      });
    }

    const cvFile = await prisma.cvFile.findUnique({
      where: {
        userId_filename: {
          userId: session.user.id,
          filename: cvCookie,
        },
      },
      select: {
        sourceType: true,
        sourceValue: true,
        extractedJobOffer: true,
      },
    });

    if (!cvFile) {
      return NextResponse.json({
        sourceType: null,
        sourceValue: null,
        hasExtractedJobOffer: false,
      });
    }

    return NextResponse.json({
      sourceType: cvFile.sourceType,
      sourceValue: cvFile.sourceValue,
      hasExtractedJobOffer: !!cvFile.extractedJobOffer,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération de la source du CV:", error);
    return NextResponse.json(
      { error: "Impossible de récupérer la source du CV" },
      { status: 500 }
    );
  }
}
