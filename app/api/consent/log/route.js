import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { logConsent } from '@/lib/cookies/consentLogger';

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
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // Parser le body
    const body = await request.json();
    const { action, preferences } = body;

    // Validation
    if (!action || !preferences) {
      return NextResponse.json(
        { error: 'action et preferences requis' },
        { status: 400 }
      );
    }

    if (!['created', 'updated', 'revoked'].includes(action)) {
      return NextResponse.json(
        { error: 'action invalide (created, updated, ou revoked)' },
        { status: 400 }
      );
    }

    // Logger le consentement
    const log = await logConsent(session.user.id, action, preferences, request);

    if (!log) {
      return NextResponse.json(
        { error: 'Erreur lors de l\'enregistrement' },
        { status: 500 }
      );
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
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
