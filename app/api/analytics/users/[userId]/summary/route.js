import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * GET /api/analytics/users/[userId]/summary
 * Get detailed statistics for a specific user
 */
export async function GET(request, { params }) {
  try {
    const session = await auth();

    // Only admin can access analytics
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { userId } = params;

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            cvs: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user statistics
    const [
      featureUsage,
      eventCounts,
      sessions,
      lastActivity,
    ] = await Promise.all([
      // Feature usage
      prisma.featureUsage.findMany({
        where: { userId },
        select: {
          featureName: true,
          usageCount: true,
          lastUsedAt: true,
          totalDuration: true,
          metadata: true,
        },
      }),

      // Event counts by type
      prisma.telemetryEvent.groupBy({
        by: ['type'],
        where: { userId },
        _count: true,
      }),

      // Session stats
      prisma.userSession.findMany({
        where: { userId },
        select: {
          startedAt: true,
          endedAt: true,
          eventsCount: true,
          pagesViewed: true,
        },
        orderBy: { startedAt: 'desc' },
        take: 10,
      }),

      // Last activity
      prisma.telemetryEvent.findFirst({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        select: {
          type: true,
          timestamp: true,
        },
      }),
    ]);

    // Calculate session statistics
    const completedSessions = sessions.filter(s => s.endedAt);
    const totalSessionTime = completedSessions.reduce((sum, s) => {
      return sum + (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime());
    }, 0);

    const avgSessionDuration = completedSessions.length > 0
      ? totalSessionTime / completedSessions.length
      : 0;

    // Parse feature metadata
    const featuresWithParsedMetadata = featureUsage.map(f => ({
      ...f,
      metadata: f.metadata ? JSON.parse(f.metadata) : null,
    }));

    // Count CVs generated, imported, exported
    const cvGenerated = eventCounts.find(e => e.type === 'CV_GENERATED')?._count || 0;
    const cvImported = eventCounts.find(e => e.type === 'CV_IMPORTED')?._count || 0;
    const cvExported = eventCounts.find(e => e.type === 'CV_EXPORTED')?._count || 0;
    const cvEdited = eventCounts.find(e => e.type === 'CV_EDITED')?._count || 0;
    const matchScoreCalculated = eventCounts.find(e => e.type === 'MATCH_SCORE_CALCULATED')?._count || 0;
    const cvOptimized = eventCounts.find(e => e.type === 'CV_OPTIMIZED')?._count || 0;

    return NextResponse.json({
      user,
      statistics: {
        totalCvs: user._count.cvs,
        cvGenerated,
        cvImported,
        cvExported,
        cvEdited,
        matchScoreCalculated,
        cvOptimized,
        totalSessions: sessions.length,
        completedSessions: completedSessions.length,
        totalSessionTime: Math.round(totalSessionTime / 1000), // seconds
        avgSessionDuration: Math.round(avgSessionDuration / 1000), // seconds
        lastActivity: lastActivity?.timestamp || null,
        lastFeature: lastActivity?.type || null,
      },
      featureUsage: featuresWithParsedMetadata,
      recentSessions: sessions,
      eventCounts: eventCounts.map(e => ({
        type: e.type,
        count: e._count,
      })),
    });

  } catch (error) {
    console.error('[Analytics API] Error getting user summary:', error);
    return NextResponse.json(
      { error: 'Failed to get user summary' },
      { status: 500 }
    );
  }
}
