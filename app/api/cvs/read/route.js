import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { readUserCvFile } from "@/lib/cv/storage";

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
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le nom du fichier depuis les query params
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('file');

    if (!filename) {
      return NextResponse.json({ error: "Nom de fichier manquant" }, { status: 400 });
    }

    // Lire le CV
    const cvContent = await readUserCvFile(session.user.id, filename);
    const cv = JSON.parse(cvContent);

    return NextResponse.json({ cv });
  } catch (error) {
    console.error('[API /cvs/read] Erreur:', error);
    return NextResponse.json(
      { error: "Erreur lors de la lecture du CV" },
      { status: 500 }
    );
  }
}
