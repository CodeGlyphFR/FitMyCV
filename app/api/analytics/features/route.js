import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { CommonErrors } from '@/lib/api/apiErrors';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/features
 * Get feature usage statistics
 * Query params:
 *   - period: 24h|7d|30d|all (default: 30d)
 *   - userId: Filter by user ID (optional)
 */
export async function GET(request) {
  try {
    // Vérifier l'authentification
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    // Only admin can access analytics
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
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
      'CV_GENERATED_URL': 'generate_cv_url',
      'CV_GENERATED_PDF': 'generate_cv_pdf',
      'CV_TEMPLATE_CREATED_URL': 'create_template_cv_url',
      'CV_TEMPLATE_CREATED_PDF': 'create_template_cv_pdf',
      'CV_GENERATED_FROM_JOB_TITLE': 'generate_from_job_title',
      'CV_CREATED_MANUAL': 'create_cv_manual',
      'CV_IMPORTED': 'import_cv',
      'CV_FIRST_IMPORTED': 'first_import_pdf',
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

    // DEBUG: Log event types found (dev only)
    if (process.env.NODE_ENV !== 'production') {
      const eventTypeCounts = events.reduce((acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      }, {});
    }

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
    }));

    // Add CV generation stats from BackgroundTask (cv_generation_v2)
    // Note: createdAt/updatedAt are BigInt (Unix timestamp in ms) in BackgroundTask
    const taskWhereClause = {
      type: 'cv_generation_v2',
      status: 'completed',
      ...(startDate ? { createdAt: { gte: BigInt(startDate.getTime()) } } : {}),
      ...(userId ? { userId } : {}),
    };

    const cvGenerationTasks = await prisma.backgroundTask.findMany({
      where: taskWhereClause,
      select: {
        userId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (cvGenerationTasks.length > 0) {
      const userIds = new Set();
      let totalDuration = 0;
      let lastUsedAt = Number(cvGenerationTasks[0].createdAt);

      cvGenerationTasks.forEach(task => {
        if (task.userId) userIds.add(task.userId);
        // Calculate duration from createdAt to updatedAt (both are BigInt timestamps)
        if (task.createdAt && task.updatedAt) {
          totalDuration += Number(task.updatedAt) - Number(task.createdAt);
        }
        const taskCreatedAt = Number(task.createdAt);
        if (taskCreatedAt > lastUsedAt) {
          lastUsedAt = taskCreatedAt;
        }
      });

      features.push({
        featureName: 'gpt_cv_generation',
        totalUsage: cvGenerationTasks.length,
        totalDuration,
        avgDuration: cvGenerationTasks.length > 0 ? Math.round(totalDuration / cvGenerationTasks.length) : 0,
        userCount: userIds.size,
        lastUsedAt: new Date(lastUsedAt),
      });
    }

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
