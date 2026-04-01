import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { CommonErrors } from '@/lib/api/apiErrors';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/extraction-errors
 * Liste les extractions d'offres échouées avec stats par domaine.
 * Query params:
 *   - period: 24h|7d|30d|all (default: 7d)
 *   - limit: Max résultats (default: 50, max: 200)
 *   - domain: Filtrer par domaine (hostname)
 */
export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const domainFilter = searchParams.get('domain') || null;

    // Calcul de la date de début
    const now = new Date();
    let startDate = null;
    switch (period) {
      case '24h': startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
      case '7d': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case '30d': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case 'all': default: startDate = null;
    }

    const dateFilter = startDate ? { createdAt: { gte: startDate } } : {};

    // Récupérer les extractions échouées
    const failedExtractions = await prisma.cvGenerationSubtask.findMany({
      where: {
        type: 'extraction',
        status: 'failed',
        ...dateFilter,
      },
      select: {
        id: true,
        error: true,
        retryCount: true,
        createdAt: true,
        input: true,
        offer: {
          select: {
            sourceUrl: true,
            task: {
              select: {
                userId: true,
                user: {
                  select: { name: true, email: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Compter le total et les succès pour le taux d'échec
    const [totalFailed, totalExtractions] = await Promise.all([
      prisma.cvGenerationSubtask.count({
        where: { type: 'extraction', status: 'failed', ...dateFilter },
      }),
      prisma.cvGenerationSubtask.count({
        where: { type: 'extraction', status: { in: ['completed', 'failed'] }, ...dateFilter },
      }),
    ]);

    // Extraire le hostname depuis l'URL
    function extractDomain(url) {
      if (!url) return 'inconnu';
      try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'invalide'; }
    }

    // Formater les résultats
    const errors = failedExtractions.map(s => {
      const sourceUrl = s.offer?.sourceUrl || s.input?.url || null;
      return {
        id: s.id,
        sourceUrl,
        domain: extractDomain(sourceUrl),
        error: s.error,
        retryCount: s.retryCount,
        createdAt: s.createdAt,
        userName: s.offer?.task?.user?.name || null,
        userEmail: s.offer?.task?.user?.email || null,
        userId: s.offer?.task?.userId || null,
      };
    });

    // Filtrer par domaine si demandé
    const filtered = domainFilter
      ? errors.filter(e => e.domain === domainFilter)
      : errors;

    // Agrégation par domaine
    const domainMap = new Map();
    // Pour les stats par domaine, on doit compter sur tous les résultats (pas seulement le limit)
    // On utilise les résultats récupérés comme approximation
    for (const e of errors) {
      const d = e.domain;
      if (!domainMap.has(d)) {
        domainMap.set(d, { domain: d, count: 0, lastError: null, lastDate: null });
      }
      const entry = domainMap.get(d);
      entry.count++;
      if (!entry.lastDate || e.createdAt > entry.lastDate) {
        entry.lastError = e.error;
        entry.lastDate = e.createdAt;
      }
    }

    const domainStats = Array.from(domainMap.values())
      .sort((a, b) => b.count - a.count);

    const failureRate = totalExtractions > 0
      ? Math.round((totalFailed / totalExtractions) * 100 * 10) / 10
      : 0;

    return NextResponse.json({
      statistics: {
        totalFailed,
        totalExtractions,
        failureRate,
        topDomain: domainStats[0]?.domain || null,
      },
      domainStats,
      errors: filtered,
    });

  } catch (error) {
    console.error('[admin/extraction-errors] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/extraction-errors
 * Supprime les erreurs d'extraction (marquer comme traitées).
 * Query params (mutuellement exclusifs) :
 *   - id: Supprimer une seule erreur par ID de subtask
 *   - domain: Supprimer toutes les erreurs d'un domaine (nécessite de résoudre les URLs)
 *   - clearAll: Supprimer toutes les erreurs d'extraction échouées
 *   - period: Limiter la suppression à une période (24h|7d|30d|all, default: all)
 */
export async function DELETE(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const domain = searchParams.get('domain');
    const clearAll = searchParams.get('clearAll') === 'true';
    const period = searchParams.get('period') || 'all';

    // Calcul de la date de début
    const now = new Date();
    let startDate = null;
    switch (period) {
      case '24h': startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
      case '7d': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case '30d': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
    }
    const dateFilter = startDate ? { createdAt: { gte: startDate } } : {};

    // Suppression par ID unique
    if (id) {
      await prisma.cvGenerationSubtask.delete({ where: { id } });
      return NextResponse.json({ deleted: 1 });
    }

    // Suppression par domaine : on doit d'abord trouver les IDs correspondants
    if (domain) {
      const candidates = await prisma.cvGenerationSubtask.findMany({
        where: { type: 'extraction', status: 'failed', ...dateFilter },
        select: { id: true, input: true, offer: { select: { sourceUrl: true } } },
      });

      const idsToDelete = candidates.filter(s => {
        const url = s.offer?.sourceUrl || s.input?.url || '';
        try { return new URL(url).hostname.replace(/^www\./, '') === domain; } catch { return false; }
      }).map(s => s.id);

      if (idsToDelete.length > 0) {
        await prisma.cvGenerationSubtask.deleteMany({ where: { id: { in: idsToDelete } } });
      }
      return NextResponse.json({ deleted: idsToDelete.length, domain });
    }

    // Suppression totale
    if (clearAll) {
      const result = await prisma.cvGenerationSubtask.deleteMany({
        where: { type: 'extraction', status: 'failed', ...dateFilter },
      });
      return NextResponse.json({ deleted: result.count });
    }

    return NextResponse.json({ error: 'Missing parameter: id, domain, or clearAll' }, { status: 400 });

  } catch (error) {
    console.error('[admin/extraction-errors] DELETE Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
