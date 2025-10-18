import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * GET /api/analytics/summary
 * Get overview KPIs and statistics
 * Query params: ?period=24h|7d|30d|all (default: 30d)
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
    const period = searchParams.get('period') || '30d';

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

    const whereClause = startDate ? { timestamp: { gte: startDate } } : {};

    // Run all queries in parallel
    const [
      totalUsers,
      activeUsers,
      totalEvents,
      cvGenerated,
      cvExported,
      totalSessions,
      avgSessionDuration,
      errorCount,
      topFeatures,
    ] = await Promise.all([
      // Total users
      prisma.user.count(),

      // Active users in period
      startDate
        ? prisma.telemetryEvent.groupBy({
            by: ['userId'],
            where: { ...whereClause, userId: { not: null } },
          }).then(r => r.length)
        : prisma.user.count(),

      // Total events
      prisma.telemetryEvent.count({ where: whereClause }),

      // CVs generated
      prisma.telemetryEvent.count({
        where: {
          ...whereClause,
          type: 'CV_GENERATED',
          status: 'success',
        },
      }),

      // CVs exported
      prisma.telemetryEvent.count({
        where: {
          ...whereClause,
          type: 'CV_EXPORTED',
          status: 'success',
        },
      }),

      // Total sessions
      startDate
        ? prisma.userSession.count({ where: { startedAt: { gte: startDate } } })
        : prisma.userSession.count(),

      // Average session duration
      prisma.userSession.findMany({
        where: startDate ? { startedAt: { gte: startDate }, endedAt: { not: null } } : { endedAt: { not: null } },
        select: { startedAt: true, endedAt: true },
      }).then(sessions => {
        if (sessions.length === 0) return 0;
        const durations = sessions.map(s => s.endedAt - s.startedAt);
        return durations.reduce((a, b) => a + b, 0) / durations.length;
      }),

      // Error count
      prisma.telemetryEvent.count({
        where: {
          ...whereClause,
          status: 'error',
        },
      }),

      // Top features
      prisma.featureUsage.findMany({
        orderBy: { usageCount: 'desc' },
        take: 5,
        select: {
          featureName: true,
          usageCount: true,
        },
      }),
    ]);

    // Calculate conversion rate (users who generated → exported)
    const usersWhoGenerated = startDate
      ? await prisma.telemetryEvent.groupBy({
          by: ['userId'],
          where: {
            ...whereClause,
            type: 'CV_GENERATED',
            status: 'success',
            userId: { not: null },
          },
        }).then(r => r.length)
      : 0;

    const usersWhoExported = startDate
      ? await prisma.telemetryEvent.groupBy({
          by: ['userId'],
          where: {
            ...whereClause,
            type: 'CV_EXPORTED',
            status: 'success',
            userId: { not: null },
          },
        }).then(r => r.length)
      : 0;

    const conversionRate = usersWhoGenerated > 0
      ? ((usersWhoExported / usersWhoGenerated) * 100).toFixed(2)
      : 0;

    return NextResponse.json({
      period,
      kpis: {
        totalUsers,
        activeUsers,
        totalEvents,
        cvGenerated,
        cvExported,
        totalSessions,
        avgSessionDuration: Math.round(avgSessionDuration / 1000), // Convert to seconds
        errorCount,
        conversionRate: parseFloat(conversionRate),
      },
      topFeatures,
    });

  } catch (error) {
    console.error('[Analytics API] Error getting summary:', error);
    return NextResponse.json(
      { error: 'Failed to get analytics summary' },
      { status: 500 }
    );
  }
}
