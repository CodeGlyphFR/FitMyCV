import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { filterAdminEvents, getAdminSessionIds } from '@/lib/analytics/filters';

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
      ...(startDate ? { timestamp: { gte: startDate } } : {}),
      ...(userId ? { userId } : {}),
    };

    // Run all queries in parallel
    const [
      totalUsers,
      activeUsers,
      totalEvents,
      totalCvs,
      cvGenerated,
      cvImported,
      cvTranslated,
      cvExported,
      totalSessions,
      avgSessionDuration,
      errorCount,
      featureEvents,
      sessionData,
      backgroundTasks,
      recentTelemetryEvents,
      recentSessionsForTimeline,
    ] = await Promise.all([
      // Total users (if filtering by user, return 1, otherwise total)
      userId ? Promise.resolve(1) : prisma.user.count(),

      // Active users in period (if filtering by user, return 1, otherwise count unique users)
      userId
        ? Promise.resolve(1)
        : (startDate
            ? prisma.telemetryEvent.groupBy({
                by: ['userId'],
                where: { ...whereClause, userId: { not: null } },
              }).then(r => r.length)
            : prisma.user.count()),

      // Total events
      prisma.telemetryEvent.count({ where: whereClause }),

      // Total CVs (actual count from CvFile table)
      prisma.cvFile.count({
        where: userId ? { userId } : {},
      }),

      // CVs generated (by AI)
      prisma.telemetryEvent.count({
        where: {
          ...whereClause,
          type: 'CV_GENERATED',
          status: 'success',
        },
      }),

      // CVs imported
      prisma.telemetryEvent.count({
        where: {
          ...whereClause,
          type: 'CV_IMPORTED',
          status: 'success',
        },
      }),

      // CVs translated
      prisma.telemetryEvent.count({
        where: {
          ...whereClause,
          type: 'CV_TRANSLATED',
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
      prisma.userSession.count({
        where: {
          ...(startDate ? { startedAt: { gte: startDate } } : {}),
          ...(userId ? { userId } : {}),
        },
      }),

      // Average session duration
      prisma.userSession.findMany({
        where: {
          ...(startDate ? { startedAt: { gte: startDate } } : {}),
          ...(userId ? { userId } : {}),
          endedAt: { not: null },
        },
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

      // Top features - get feature events
      prisma.telemetryEvent.findMany({
        where: {
          ...whereClause,
          type: { in: ['CV_GENERATED', 'CV_IMPORTED', 'CV_EXPORTED', 'CV_TRANSLATED', 'MATCH_SCORE_CALCULATED', 'CV_OPTIMIZED', 'CV_EDITED'] },
          status: 'success',
        },
        select: {
          type: true,
          userId: true,
        },
      }),

      // Session data for engagement metrics (pagesViewed, bounce rate)
      prisma.userSession.findMany({
        where: {
          ...(startDate ? { startedAt: { gte: startDate } } : {}),
          ...(userId ? { userId } : {}),
        },
        select: {
          id: true,
          pagesViewed: true,
        },
      }),

      // Background tasks for job success rate
      prisma.backgroundTask.findMany({
        where: {
          ...(startDate ? { createdAt: { gte: BigInt(startDate.getTime()) } } : {}),
          ...(userId ? { userId } : {}),
        },
        select: {
          status: true,
        },
      }),

      // Recent telemetry events for timeline (last 14 days)
      prisma.telemetryEvent.findMany({
        where: {
          timestamp: { gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) },
          ...(userId ? { userId } : {}),
        },
        select: {
          type: true,
          status: true,
          timestamp: true,
          userId: true,
          metadata: true,
        },
        orderBy: { timestamp: 'asc' },
      }),

      // Recent sessions for hourly distribution (last 14 days)
      prisma.userSession.findMany({
        where: {
          startedAt: { gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) },
          ...(userId ? { userId } : {}),
        },
        select: {
          id: true,
          startedAt: true,
        },
      }),
    ]);

    // Map events to features and aggregate
    const EVENT_TO_FEATURE = {
      'CV_GENERATED': 'generate_cv',
      'CV_IMPORTED': 'import_cv',
      'CV_EXPORTED': 'export_cv',
      'CV_TRANSLATED': 'translate_cv',
      'MATCH_SCORE_CALCULATED': 'match_score',
      'CV_OPTIMIZED': 'optimize_cv',
      'CV_EDITED': 'edit_cv',
    };

    const featureStats = {};
    featureEvents.forEach(event => {
      const featureName = EVENT_TO_FEATURE[event.type];
      if (featureName) {
        if (!featureStats[featureName]) {
          featureStats[featureName] = { featureName, usageCount: 0 };
        }
        featureStats[featureName].usageCount++;
      }
    });

    // Convert to array, sort, and take top 5
    const processedTopFeatures = Object.values(featureStats)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);

    // Get admin session IDs to exclude
    const adminSessionIds = await getAdminSessionIds(
      { ...(startDate ? { startedAt: { gte: startDate } } : {}) },
      prisma
    );

    // Filter out admin sessions from session data
    const filteredSessionData = sessionData.filter(s => !adminSessionIds.has(s.id));

    // Get all events to filter admin pages
    const allEvents = await prisma.telemetryEvent.findMany({
      where: whereClause,
      select: {
        type: true,
        metadata: true,
        sessionId: true,
      },
    });

    // Filter out admin page events
    const filteredEvents = filterAdminEvents(allEvents);
    const filteredTotalEvents = filteredEvents.length;

    // Filter sessions that visited admin pages
    const filteredSessionCount = totalSessions - adminSessionIds.size;

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

    // Calculate engagement metrics - using filtered sessions (excluding admin)
    const avgPagesPerSession = filteredSessionData.length > 0
      ? filteredSessionData.reduce((sum, s) => sum + (s.pagesViewed || 0), 0) / filteredSessionData.length
      : 0;

    const bouncedSessions = filteredSessionData.filter(s => (s.pagesViewed || 0) <= 1).length;
    const bounceRate = filteredSessionData.length > 0
      ? ((bouncedSessions / filteredSessionData.length) * 100).toFixed(2)
      : 0;

    // Calculate background task stats
    const totalJobs = backgroundTasks.length;
    const completedJobs = backgroundTasks.filter(t => t.status === 'completed').length;
    const failedJobs = backgroundTasks.filter(t => t.status === 'failed').length;
    const jobSuccessRate = totalJobs > 0
      ? ((completedJobs / totalJobs) * 100).toFixed(2)
      : 100;

    // Calculate health score (based on error rate) - using filtered events
    const errorRate = filteredTotalEvents > 0 ? ((errorCount / filteredTotalEvents) * 100) : 0;
    const healthScore = Math.max(0, Math.round(100 - errorRate * 10));

    // Calculate best hour (hour with most sessions) - excluding admin sessions
    const filteredSessions = recentSessionsForTimeline.filter(s => !adminSessionIds.has(s.id));
    const sessionsByHour = filteredSessions.reduce((acc, session) => {
      const hour = new Date(session.startedAt).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});
    const bestHour = Object.keys(sessionsByHour).length > 0
      ? parseInt(Object.entries(sessionsByHour).sort((a, b) => b[1] - a[1])[0][0])
      : null;

    // Calculate timeline data (CVs created, translated, deleted + active users per day, last 14 days)
    // Filter admin events from timeline
    const filteredTimelineEvents = filterAdminEvents(recentTelemetryEvents);
    const CV_CREATION_TYPES = ['CV_GENERATED', 'CV_IMPORTED', 'CV_CREATED_MANUAL'];

    const timelineByDay = filteredTimelineEvents.reduce((acc, event) => {
      const date = new Date(event.timestamp).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
      });
      if (!acc[date]) {
        acc[date] = {
          date,
          cvCreated: 0,
          cvTranslated: 0,
          cvDeleted: 0,
          activeUsers: new Set(),
        };
      }
      // Count CV creation (generated, imported, manual - NOT translated)
      if (CV_CREATION_TYPES.includes(event.type) && event.status === 'success') {
        acc[date].cvCreated++;
      }
      // Count CV translations separately
      if (event.type === 'CV_TRANSLATED' && event.status === 'success') {
        acc[date].cvTranslated++;
      }
      // Count CV deletions
      if (event.type === 'CV_DELETED' && event.status === 'success') {
        acc[date].cvDeleted++;
      }
      if (event.userId) {
        acc[date].activeUsers.add(event.userId);
      }
      return acc;
    }, {});

    const timeline = Object.values(timelineByDay)
      .map(day => ({
        date: day.date,
        cvCreated: day.cvCreated,
        cvTranslated: day.cvTranslated,
        cvDeleted: day.cvDeleted,
        activeUsers: day.activeUsers.size,
      }))
      .sort((a, b) => {
        const [dayA, monthA] = a.date.split('/');
        const [dayB, monthB] = b.date.split('/');
        return new Date(`2024-${monthA}-${dayA}`) - new Date(`2024-${monthB}-${dayB}`);
      });

    return NextResponse.json({
      period,
      kpis: {
        totalUsers,
        activeUsers,
        totalEvents: filteredTotalEvents,
        totalCvs,
        cvGenerated,
        cvImported,
        cvTranslated,
        cvExported,
        totalSessions: filteredSessionCount,
        avgSessionDuration: Math.round(avgSessionDuration / 1000), // Convert to seconds
        errorCount,
        conversionRate: parseFloat(conversionRate),
        healthScore,
        errorRate: errorRate.toFixed(2),
        avgPagesPerSession: avgPagesPerSession.toFixed(1),
        bounceRate: parseFloat(bounceRate),
        totalJobs,
        completedJobs,
        failedJobs,
        jobSuccessRate: parseFloat(jobSuccessRate),
        bestHour,
      },
      topFeatures: processedTopFeatures,
      timeline,
      engagement: {
        avgPagesPerSession: avgPagesPerSession.toFixed(1),
        bounceRate: parseFloat(bounceRate),
      },
      jobs: {
        total: totalJobs,
        completed: completedJobs,
        failed: failedJobs,
        successRate: parseFloat(jobSuccessRate),
      },
    });

  } catch (error) {
    console.error('[Analytics API] Error getting summary:', error);
    return NextResponse.json(
      { error: 'Failed to get analytics summary' },
      { status: 500 }
    );
  }
}
