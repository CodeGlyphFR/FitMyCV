import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    console.log("[cv/source] Non authentifié");
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const cvCookie = (cookies().get("cvFile") || {}).value;
    console.log("[cv/source] userId:", session.user.id, "cvFile cookie:", cvCookie);

    if (!cvCookie) {
      console.log("[cv/source] Pas de cookie cvFile");
      return NextResponse.json({ sourceType: null, sourceValue: null });
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
      },
    });

    console.log("[cv/source] Résultat DB:", cvFile);

    if (!cvFile) {
      console.log("[cv/source] CV non trouvé en DB");
      return NextResponse.json({ sourceType: null, sourceValue: null });
    }

    return NextResponse.json({
      sourceType: cvFile.sourceType,
      sourceValue: cvFile.sourceValue,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération de la source du CV:", error);
    return NextResponse.json(
      { error: "Impossible de récupérer la source du CV" },
      { status: 500 }
    );
  }
}
