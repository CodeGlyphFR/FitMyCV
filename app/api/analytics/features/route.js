import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * GET /api/analytics/features
 * Get feature usage statistics
 * Query params:
 *   - period: 24h|7d|30d|all (default: 30d)
 *   - userId: Filter by user ID (optional)
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

    // Event type to feature name mapping
    const EVENT_TO_FEATURE = {
      'CV_GENERATED': 'generate_cv',
      'CV_IMPORTED': 'import_cv',
      'CV_EXPORTED': 'export_cv',
      'CV_TRANSLATED': 'translate_cv',
      'MATCH_SCORE_CALCULATED': 'match_score',
      'CV_OPTIMIZED': 'optimize_cv',
      'CV_EDITED': 'edit_cv',
    };

    const featureTypes = Object.keys(EVENT_TO_FEATURE);

    const whereClause = {
      type: { in: featureTypes },
      status: 'success',
      ...(startDate ? { timestamp: { gte: startDate } } : {}),
      ...(userId ? { userId } : {}),
    };

    // Get all feature events
    const events = await prisma.telemetryEvent.findMany({
      where: whereClause,
      select: {
        type: true,
        userId: true,
        duration: true,
        metadata: true,
        timestamp: true,
      },
    });

    // Aggregate data by feature
    const featureStats = {};

    events.forEach(event => {
      const featureName = EVENT_TO_FEATURE[event.type];
      if (!featureName) return;

      if (!featureStats[featureName]) {
        featureStats[featureName] = {
          featureName,
          totalUsage: 0,
          totalDuration: 0,
          userIds: new Set(),
          lastUsedAt: event.timestamp,
          analysisLevelBreakdown: {},
        };
      }

      const stats = featureStats[featureName];
      stats.totalUsage++;
      stats.totalDuration += event.duration || 0;
      if (event.userId) {
        stats.userIds.add(event.userId);
      }
      if (new Date(event.timestamp) > new Date(stats.lastUsedAt)) {
        stats.lastUsedAt = event.timestamp;
      }

      // Parse metadata for analysis level breakdown (for generate_cv)
      if (event.metadata && featureName === 'generate_cv') {
        try {
          const meta = JSON.parse(event.metadata);
          if (meta.analysisLevel) {
            stats.analysisLevelBreakdown[meta.analysisLevel] =
              (stats.analysisLevelBreakdown[meta.analysisLevel] || 0) + 1;
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    });

    // Convert to array and calculate averages
    const features = Object.values(featureStats).map(stats => ({
      featureName: stats.featureName,
      totalUsage: stats.totalUsage,
      totalDuration: stats.totalDuration,
      avgDuration: stats.totalUsage > 0
        ? Math.round(stats.totalDuration / stats.totalUsage)
        : 0,
      userCount: stats.userIds.size,
      lastUsedAt: stats.lastUsedAt,
      analysisLevelBreakdown: Object.keys(stats.analysisLevelBreakdown).length > 0
        ? stats.analysisLevelBreakdown
        : null,
    }));

    // Sort by total usage
    features.sort((a, b) => b.totalUsage - a.totalUsage);

    return NextResponse.json({
      period,
      features,
    });

  } catch (error) {
    console.error('[Analytics API] Error getting features:', error);
    return NextResponse.json(
      { error: 'Failed to get feature statistics' },
      { status: 500 }
    );
  }
}
