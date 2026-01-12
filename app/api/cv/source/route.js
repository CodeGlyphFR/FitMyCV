import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { CommonErrors, CvErrors } from "@/lib/api/apiErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return CommonErrors.notAuthenticated();
  }

  try {
    // Next.js 16: cookies() est maintenant async
    const cookieStore = await cookies();
    const cvCookie = (cookieStore.get("cvFile") || {}).value;

    if (!cvCookie) {
      return NextResponse.json({
        sourceType: null,
        sourceValue: null,
        hasJobOffer: false,
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
        jobOfferId: true, // Vérifier si un JobOffer est associé
      },
    });

    if (!cvFile) {
      return NextResponse.json({
        sourceType: null,
        sourceValue: null,
        hasJobOffer: false,
      });
    }

    return NextResponse.json({
      sourceType: cvFile.sourceType,
      sourceValue: cvFile.sourceValue,
      hasJobOffer: !!cvFile.jobOfferId,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération de la source du CV:", error);
    return CvErrors.sourceError();
  }
}
