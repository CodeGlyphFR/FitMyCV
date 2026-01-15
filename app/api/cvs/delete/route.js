import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { listUserCvFiles, deleteUserCvFile, cvFileExists } from '@/lib/cv/storage';
import { trackEvent, EventTypes } from '@/lib/telemetry/server';
import { CommonErrors, CvErrors } from '@/lib/api/apiErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isJsonFileSafe(name) {
  if (typeof name !== 'string') return false;
  if (name.includes('/') || name.includes('\\')) return false;
  return name.toLowerCase().endsWith('.json');
}

/**
 * Sélectionne le prochain fichier CV après suppression
 * Utilise les données DB pour le tri (createdAt)
 */
async function pickNextFile(userId) {
  // Récupérer le CV le plus récent (par createdAt DB)
  const nextCv = await prisma.cvFile.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { filename: true },
  });

  return nextCv?.filename || null;
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    const body = await req.json();
    const file = (body && body.file) || '';
    if (!isJsonFileSafe(file)) {
      return CvErrors.invalidFilename();
    }

    // Vérifier que le fichier existe dans la DB
    const exists = await cvFileExists(session.user.id, file);
    if (!exists) {
      return CvErrors.notFound();
    }

    // Supprimer le CV de la DB
    await deleteUserCvFile(session.user.id, file);

    // Track CV deletion
    try {
      await trackEvent({
        type: EventTypes.CV_DELETED,
        userId: session.user.id,
        metadata: { filename: file },
        status: 'success',
      });
    } catch (trackError) {
      console.error('[delete-cv] Erreur tracking télémétrie:', trackError);
    }

    // Choisir le prochain fichier à afficher
    const nextFile = await pickNextFile(session.user.id);

    return NextResponse.json({ ok: true, nextFile: nextFile || null });
  } catch (e) {
    console.error('[delete-cv] Error:', e);
    return CvErrors.deleteError();
  }
}
