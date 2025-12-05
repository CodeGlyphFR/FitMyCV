import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { getCvVersions, getCvVersionContent } from '@/lib/cv/versioning';
import { CommonErrors, CvErrors } from '@/lib/api/apiErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cvs/versions?file=xxx.json
 * Liste les versions d'un CV
 *
 * GET /api/cvs/versions?file=xxx.json&version=2
 * Récupère le contenu d'une version spécifique
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

    if (!filename) {
      return NextResponse.json(
        { error: 'errors.api.cv.missingFilename' },
        { status: 400 }
      );
    }

    // Si une version spécifique est demandée, retourner son contenu
    if (versionParam) {
      const version = parseInt(versionParam, 10);
      if (isNaN(version) || version < 1) {
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

    // Sinon, retourner la liste des versions
    const versions = await getCvVersions(session.user.id, filename);

    return NextResponse.json({
      filename,
      versions: versions.map((v) => ({
        version: v.version,
        changelog: v.changelog,
        createdAt: v.createdAt.toISOString(),
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
