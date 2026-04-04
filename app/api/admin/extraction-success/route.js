import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { CommonErrors } from '@/lib/api/apiErrors';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/extraction-success
 * Liste les extractions d'offres réussies (table JobOffer) avec KPIs.
 * Query params:
 *   - period: 24h|7d|30d|all (default: 30d)
 *   - userId: Filtrer par user ID (optional)
 *   - page: Page number (default: 0)
 *   - pageSize: Items per page (default: 20, max: 50)
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
    const period = searchParams.get('period') || '30d';
    const userId = searchParams.get('userId') || null;
    const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));

    // Calcul de la date de début
    const now = new Date();
    let startDate = null;
    switch (period) {
      case '24h': startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
      case '7d': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case '30d': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case 'all': default: startDate = null;
    }

    const dateFilter = startDate ? { extractedAt: { gte: startDate } } : {};
    const userFilter = userId ? { userId } : {};
    const whereClause = { ...dateFilter, ...userFilter };

    // KPIs agrégés en parallèle
    const [
      totalExtractions,
      urlCount,
      pdfCount,
      uniqueUsersResult,
      tokensResult,
      modelGroups,
      extractionsWithCvs,
      extractions,
    ] = await Promise.all([
      // Total extractions
      prisma.jobOffer.count({ where: whereClause }),

      // Par type de source
      prisma.jobOffer.count({ where: { ...whereClause, sourceType: 'url' } }),
      prisma.jobOffer.count({ where: { ...whereClause, sourceType: 'pdf' } }),

      // Utilisateurs uniques
      prisma.jobOffer.groupBy({
        by: ['userId'],
        where: whereClause,
      }),

      // Tokens agrégés
      prisma.jobOffer.aggregate({
        where: whereClause,
        _sum: { tokensUsed: true },
        _avg: { tokensUsed: true },
      }),

      // Distribution des modèles
      prisma.jobOffer.groupBy({
        by: ['extractionModel'],
        where: whereClause,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      // Extractions ayant généré au moins 1 CV
      prisma.jobOffer.count({
        where: {
          ...whereClause,
          cvFiles: { some: {} },
        },
      }),

      // Liste paginée
      prisma.jobOffer.findMany({
        where: whereClause,
        select: {
          id: true,
          sourceType: true,
          sourceValue: true,
          content: true,
          extractionModel: true,
          tokensUsed: true,
          extractedAt: true,
          user: {
            select: { name: true, email: true },
          },
          _count: {
            select: { cvFiles: true },
          },
        },
        orderBy: { extractedAt: 'desc' },
        skip: page * pageSize,
        take: pageSize,
      }),
    ]);

    const uniqueUsers = uniqueUsersResult.length;
    const conversionRate = totalExtractions > 0
      ? Math.round((extractionsWithCvs / totalExtractions) * 100 * 10) / 10
      : 0;

    const modelDistribution = {};
    for (const g of modelGroups) {
      modelDistribution[g.extractionModel || 'inconnu'] = g._count.id;
    }

    return NextResponse.json({
      kpis: {
        totalExtractions,
        bySourceType: { url: urlCount, pdf: pdfCount },
        uniqueUsers,
        totalTokensUsed: tokensResult._sum.tokensUsed || 0,
        avgTokensPerExtraction: Math.round(tokensResult._avg.tokensUsed || 0),
        cvsGenerated: extractionsWithCvs,
        conversionRate,
        modelDistribution,
      },
      extractions: extractions.map(e => ({
        id: e.id,
        sourceType: e.sourceType,
        sourceValue: e.sourceValue,
        content: e.content,
        extractionModel: e.extractionModel,
        tokensUsed: e.tokensUsed,
        extractedAt: e.extractedAt,
        userName: e.user?.name || null,
        userEmail: e.user?.email || null,
        cvsCount: e._count.cvFiles,
      })),
      total: totalExtractions,
      page,
      pageSize,
    });

  } catch (error) {
    console.error('[admin/extraction-success] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
