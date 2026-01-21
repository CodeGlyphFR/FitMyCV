import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { getCvVersions, getCvVersionContent, getCvVersionsWithDetails, restoreCvVersionDestructive } from '@/lib/cv-core/versioning';
import { CommonErrors, CvErrors } from '@/lib/api/apiErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cvs/versions?file=xxx.json
 * Liste les versions d'un CV
 *
 * GET /api/cvs/versions?file=xxx.json&version=2
 * Récupère le contenu d'une version spécifique
 *
 * GET /api/cvs/versions?file=xxx.json&includeContent=true
 * Liste les versions avec leur contenu complet
 */
export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('file');
    const versionParam = searchParams.get('version');
    const includeContent = searchParams.get('includeContent') === 'true';

    if (!filename) {
      return NextResponse.json(
        { error: 'errors.api.cv.missingFilename' },
        { status: 400 }
      );
    }

    // Si une version spécifique est demandée, retourner son contenu
    if (versionParam) {
      const version = parseInt(versionParam, 10);
      if (isNaN(version) || version < 0) {
        return NextResponse.json(
          { error: 'errors.api.cv.invalidVersion' },
          { status: 400 }
        );
      }

      const content = await getCvVersionContent(session.user.id, filename, version);
      if (!content) {
        return NextResponse.json(
          { error: 'errors.api.cv.versionNotFound' },
          { status: 404 }
        );
      }

      return NextResponse.json({ version, content });
    }

    // Sinon, retourner la liste des versions (avec ou sans contenu)
    const versions = await getCvVersionsWithDetails(session.user.id, filename, includeContent);

    // Filtrer v0 de la liste (c'est le template initial, pas utile pour la navigation)
    // v0 reste accessible via ?version=0 pour le système de review
    const filteredVersions = versions.filter((v) => v.version > 0);

    return NextResponse.json({
      filename,
      versions: filteredVersions.map((v) => ({
        version: v.version,
        changelog: v.changelog,
        changeType: v.changeType,
        sourceFile: v.sourceFile,
        createdAt: v.createdAt.toISOString(),
        matchScore: v.matchScore, // Score de la version pour affichage dans VersionSelector
        ...(includeContent && { content: v.content }),
      })),
    });
  } catch (error) {
    console.error('[versions] Error:', error);
    return NextResponse.json(
      { error: 'errors.api.common.serverError' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cvs/versions
 * Restaurer une version antérieure (destructif: supprime la version actuelle)
 *
 * Body:
 * {
 *   filename: "xxx.json",
 *   version: 2,
 *   action: "restore"
 * }
 */
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    const body = await request.json();
    const { filename, version, action } = body;

    if (!filename) {
      return NextResponse.json(
        { error: 'errors.api.cv.missingFilename' },
        { status: 400 }
      );
    }

    if (action !== 'restore') {
      return NextResponse.json(
        { error: 'errors.api.cv.invalidAction' },
        { status: 400 }
      );
    }

    if (typeof version !== 'number' || version < 1) {
      return NextResponse.json(
        { error: 'errors.api.cv.invalidVersion' },
        { status: 400 }
      );
    }

    console.log(`[API /cvs/versions] Restoring version ${version} for ${filename}`);

    const restoredContent = await restoreCvVersionDestructive(
      session.user.id,
      filename,
      version
    );

    return NextResponse.json({
      success: true,
      message: `Version ${version} restored successfully`,
      restoredVersion: version,
    });
  } catch (error) {
    console.error('[versions] POST Error:', error);

    if (error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'errors.api.cv.versionNotFound' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'errors.api.common.serverError' },
      { status: 500 }
    );
  }
}
