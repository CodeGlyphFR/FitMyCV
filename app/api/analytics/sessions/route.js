import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * GET /api/analytics/sessions
 * Get session statistics
 * Query params:
 *   - period: 24h|7d|30d|all (default: 30d)
 *   - limit: Max results for recent sessions (default: 50)
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 500);

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

    const whereClause = startDate ? { startedAt: { gte: startDate } } : {};

    // Get session statistics
    const [
      totalSessions,
      completedSessions,
      recentSessions,
    ] = await Promise.all([
      prisma.userSession.count({ where: whereClause }),

      prisma.userSession.findMany({
        where: {
          ...whereClause,
          endedAt: { not: null },
        },
        select: {
          startedAt: true,
          endedAt: true,
          eventsCount: true,
          pagesViewed: true,
        },
      }),

      prisma.userSession.findMany({
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
        orderBy: { startedAt: 'desc' },
        take: limit,
      }),
    ]);

    // Calculate statistics from completed sessions
    const durations = completedSessions
      .map(s => new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime())
      .filter(d => d > 0);

    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const medianDuration = durations.length > 0
      ? durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)]
      : 0;

    const avgEventsPerSession = completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => sum + s.eventsCount, 0) / completedSessions.length
      : 0;

    const avgPagesPerSession = completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => sum + s.pagesViewed, 0) / completedSessions.length
      : 0;

    // Format recent sessions with duration
    const formattedRecentSessions = recentSessions.map(s => ({
      ...s,
      duration: s.endedAt
        ? new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()
        : null,
    }));

    return NextResponse.json({
      period,
      statistics: {
        totalSessions,
        completedSessions: completedSessions.length,
        activeSessions: totalSessions - completedSessions.length,
        avgDuration: Math.round(avgDuration / 1000), // seconds
        medianDuration: Math.round(medianDuration / 1000), // seconds
        avgEventsPerSession: Math.round(avgEventsPerSession * 10) / 10,
        avgPagesPerSession: Math.round(avgPagesPerSession * 10) / 10,
      },
      recentSessions: formattedRecentSessions,
    });

  } catch (error) {
    console.error('[Analytics API] Error getting sessions:', error);
    return NextResponse.json(
      { error: 'Failed to get session statistics' },
      { status: 500 }
    );
  }
}
