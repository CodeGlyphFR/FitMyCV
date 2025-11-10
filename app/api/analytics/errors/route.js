import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/errors
 * Get error analysis and failed events
 * Query params:
 *   - period: 24h|7d|30d|all (default: 7d)
 *   - limit: Max results (default: 100)
 */
export async function GET(request) {
  try {
    const session = await auth();

    // Only admin can access analytics
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const userId = searchParams.get('userId');

    // Calculate date range
    const now = new Date();
    let startDate = null;

    switch (period) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        startDate = null;
    }

    const whereClause = {
      status: 'error',
      ...(startDate ? { timestamp: { gte: startDate } } : {}),
      ...(userId ? { userId } : {}),
    };

    // Get error statistics
    const [
      errorsByType,
      recentErrors,
      totalErrors,
      errorRate,
    ] = await Promise.all([
      // Errors grouped by type
      prisma.telemetryEvent.groupBy({
        by: ['type'],
        where: whereClause,
        _count: true,
        orderBy: {
          _count: {
            type: 'desc',
          },
        },
      }),

      // Recent errors with details
      prisma.telemetryEvent.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      }),

      // Total error count
      prisma.telemetryEvent.count({ where: whereClause }),

      // Calculate error rate (errors / total events)
      Promise.all([
        prisma.telemetryEvent.count({ where: whereClause }),
        prisma.telemetryEvent.count({
          where: startDate ? { timestamp: { gte: startDate } } : {},
        }),
      ]).then(([errors, total]) => {
        return total > 0 ? ((errors / total) * 100).toFixed(2) : 0;
      }),
    ]);

    // Parse metadata and group common errors
    const errorsWithMetadata = recentErrors.map(e => ({
      ...e,
      metadata: e.metadata ? JSON.parse(e.metadata) : null,
    }));

    // Group by error message to find common issues
    const errorGroups = {};
    errorsWithMetadata.forEach(e => {
      const key = e.error || 'Unknown error';
      if (!errorGroups[key]) {
        errorGroups[key] = {
          message: key,
          count: 0,
          types: new Set(),
          lastOccurrence: e.timestamp,
        };
      }
      errorGroups[key].count++;
      errorGroups[key].types.add(e.type);
      if (new Date(e.timestamp) > new Date(errorGroups[key].lastOccurrence)) {
        errorGroups[key].lastOccurrence = e.timestamp;
      }
    });

    const commonErrors = Object.values(errorGroups)
      .map(g => ({
        ...g,
        types: Array.from(g.types),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({
      period,
      statistics: {
        totalErrors,
        errorRate: parseFloat(errorRate),
      },
      errorsByType: errorsByType.map(e => ({
        type: e.type,
        count: e._count,
      })),
      commonErrors,
      recentErrors: errorsWithMetadata,
    });

  } catch (error) {
    console.error('[Analytics API] Error getting error analysis:', error);
    return NextResponse.json(
      { error: 'Failed to get error analysis' },
      { status: 500 }
    );
  }
}
