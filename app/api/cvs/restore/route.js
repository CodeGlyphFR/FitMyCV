import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { restoreCvVersion } from '@/lib/cv-core/versioning';
import { trackEvent, EventTypes } from '@/lib/telemetry/server';
import { CommonErrors } from '@/lib/api/apiErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/cvs/restore
 * Body: { filename: string, version: number }
 *
 * Restaure une version antérieure d'un CV.
 * Crée automatiquement une version de sauvegarde du contenu actuel.
 */
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    const body = await request.json();
    const { filename, version } = body;

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json(
        { error: 'errors.api.cv.missingFilename' },
        { status: 400 }
      );
    }

    if (!version || typeof version !== 'number' || version < 1) {
      return NextResponse.json(
        { error: 'errors.api.cv.invalidVersion' },
        { status: 400 }
      );
    }

    // Restaurer la version
    const restoredContent = await restoreCvVersion(session.user.id, filename, version);

    // Tracking télémétrie
    try {
      await trackEvent({
        type: EventTypes.CV_RESTORED,
        userId: session.user.id,
        metadata: {
          filename,
          restoredVersion: version,
        },
        status: 'success',
      });
    } catch (trackError) {
      console.error('[restore] Erreur tracking télémétrie:', trackError);
    }

    return NextResponse.json({
      success: true,
      filename,
      restoredVersion: version,
      content: restoredContent,
    });
  } catch (error) {
    console.error('[restore] Error:', error);

    if (error.message?.includes('not found')) {
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
