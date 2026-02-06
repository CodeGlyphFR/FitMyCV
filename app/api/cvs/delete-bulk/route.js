import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { deleteUserCvFile, cvFileExists } from '@/lib/cv-core/storage';
import { trackEvent, EventTypes } from '@/lib/telemetry/server';
import { CommonErrors, CvErrors, apiError } from '@/lib/api/apiErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isJsonFileSafe(name) {
  if (typeof name !== 'string') return false;
  if (name.includes('/') || name.includes('\\')) return false;
  return name.toLowerCase().endsWith('.json');
}

/**
 * Supprime plusieurs CVs en une seule requête
 * POST /api/cvs/delete-bulk
 * Body: { files: string[] }
 */
export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    const body = await req.json();
    const files = body?.files;

    // Validation du payload
    if (!Array.isArray(files) || files.length === 0) {
      return apiError({
        error: 'No files provided',
        code: 'NO_FILES',
        status: 400,
      });
    }

    // Limite de sécurité (max 50 CVs à la fois)
    if (files.length > 50) {
      return apiError({
        error: 'Too many files (max 50)',
        code: 'TOO_MANY_FILES',
        status: 400,
      });
    }

    // Valider chaque nom de fichier
    for (const file of files) {
      if (!isJsonFileSafe(file)) {
        return CvErrors.invalidFilename();
      }
    }

    // Supprimer chaque CV
    let deletedCount = 0;
    const errors = [];

    for (const file of files) {
      try {
        const exists = await cvFileExists(session.user.id, file);
        if (exists) {
          await deleteUserCvFile(session.user.id, file);

          // Track CV deletion
          try {
            await trackEvent({
              type: EventTypes.CV_DELETED,
              userId: session.user.id,
              metadata: { filename: file, bulk: true },
              status: 'success',
            });
          } catch (trackError) {
            console.error('[delete-bulk] Erreur tracking télémétrie:', trackError);
          }

          deletedCount++;
        }
      } catch (deleteError) {
        console.error(`[delete-bulk] Erreur suppression ${file}:`, deleteError);
        errors.push(file);
      }
    }

    return NextResponse.json({
      ok: true,
      deletedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    console.error('[delete-bulk] Error:', e);
    return CvErrors.deleteError();
  }
}
