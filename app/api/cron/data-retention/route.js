/**
 * Endpoint cron pour la rétention des données (RGPD)
 * Exécute les jobs de nettoyage périodiques
 *
 * Sécurisé par CRON_SECRET dans le header Authorization
 *
 * Usage:
 * curl -X POST https://fitmycv.io/api/cron/data-retention \
 *   -H "Authorization: Bearer $CRON_SECRET"
 */

import { runAllDataRetentionJobs } from '@/lib/background-jobs/dataRetention';

export async function POST(request) {
  // Vérifier l'authentification
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[cron/data-retention] CRON_SECRET non configuré');
    return Response.json(
      { error: 'Cron not configured' },
      { status: 500 }
    );
  }

  // Comparaison constant-time pour éviter les attaques par timing
  const crypto = await import('crypto');
  const expectedAuth = `Bearer ${cronSecret}`;
  const expectedBuf = Buffer.from(expectedAuth);
  const receivedBuf = Buffer.from(authHeader || '');
  if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
    console.warn('[cron/data-retention] Tentative non autorisée');
    return Response.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('[cron/data-retention] Démarrage des jobs de rétention...');
    const results = await runAllDataRetentionJobs();

    return Response.json({
      success: true,
      message: 'Data retention jobs completed',
      ...results,
    });
  } catch (error) {
    console.error('[cron/data-retention] Erreur:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Désactiver le cache pour cet endpoint
export const dynamic = 'force-dynamic';
