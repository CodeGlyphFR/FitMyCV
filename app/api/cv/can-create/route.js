/**
 * GET /api/cv/can-create
 * Vérifie si l'utilisateur peut créer un nouveau CV
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { canCreateNewCv } from '@/lib/subscription/cvLimits';
import { CommonErrors, CvErrors } from '@/lib/api/apiErrors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    const userId = session.user.id;
    const result = await canCreateNewCv(userId);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[CV Can Create] Erreur:', error);
    return CvErrors.verifyError();
  }
}
