import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { readUserCvFile } from "@/lib/cv/storage";
import { CommonErrors, CvErrors } from "@/lib/api/apiErrors";

export const dynamic = 'force-dynamic';

/**
 * GET /api/cvs/read?file=filename.json
 * Retourne le contenu d'un CV spécifique
 */
export async function GET(request) {
  try {
    // Vérifier l'authentification
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    // Récupérer le nom du fichier depuis les query params
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('file');

    if (!filename) {
      return CvErrors.missingFilename();
    }

    // Lire le CV
    const cvContent = await readUserCvFile(session.user.id, filename);
    const cv = JSON.parse(cvContent);

    return NextResponse.json({ cv });
  } catch (error) {
    console.error('[API /cvs/read] Erreur:', error);
    return CvErrors.readError();
  }
}
