import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { getConsentHistory } from '@/lib/cookies/consentLogger';

/**
 * GET /api/consent/history
 * Récupère l'historique des consentements de l'utilisateur connecté
 *
 * Query params:
 *   - limit (optionnel): nombre maximum de logs à retourner (défaut: 50)
 */
export async function GET(request) {
  try {
    // Vérifier l'authentification
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // Récupérer le paramètre limit
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Limiter le nombre max de résultats
    const safeLimit = Math.min(Math.max(1, limit), 100);

    // Récupérer l'historique
    const history = await getConsentHistory(session.user.id, safeLimit);

    return NextResponse.json({
      success: true,
      history,
      count: history.length,
    });
  } catch (error) {
    console.error('[API /consent/history] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
