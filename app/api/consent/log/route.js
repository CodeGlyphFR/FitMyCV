import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { logConsent } from '@/lib/cookies/consentLogger';
import { CommonErrors, OtherErrors } from '@/lib/api/apiErrors';

/**
 * POST /api/consent/log
 * Enregistre un changement de consentement en base de données
 *
 * Body: {
 *   action: "created" | "updated" | "revoked",
 *   preferences: { necessary: boolean, functional: boolean, analytics: boolean, marketing: boolean }
 * }
 */
export async function POST(request) {
  try {
    // Vérifier l'authentification
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    // Parser le body
    const body = await request.json();
    const { action, preferences } = body;

    // Validation
    if (!action || !preferences) {
      return OtherErrors.consentRequired();
    }

    if (!['created', 'updated', 'revoked'].includes(action)) {
      return OtherErrors.consentInvalidAction();
    }

    // Logger le consentement
    const log = await logConsent(session.user.id, action, preferences, request);

    if (!log) {
      return CommonErrors.serverError();
    }

    return NextResponse.json({
      success: true,
      log: {
        id: log.id,
        action: log.action,
        createdAt: log.createdAt,
      },
    });
  } catch (error) {
    console.error('[API /consent/log] Erreur:', error);
    return CommonErrors.serverError();
  }
}
