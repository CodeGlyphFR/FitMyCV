import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Feature names for CV improvement v2 pipeline
 */
const CV_IMPROVEMENT_FEATURES = [
  'optimize_cv', // Legacy single call
  'classify_skills', // Stage 1 - Classification des compétences
  'cv_improvement_v2_classify_skills', // Alias classification
  'cv_improvement_v2_preprocess', // Stage 2 - Préparation
  'cv_improvement_v2_experience', // Stage 3 - Expériences
  'cv_improvement_v2_project', // Stage 3 - Projets
  'cv_improvement_v2_extras', // Stage 3 - Extras
  'cv_improvement_v2_languages', // Stage 3 - Langues
  'cv_improvement_v2_summary', // Stage 4 - Résumé
];

/**
 * GET /api/analytics/cv-improvement-costs
 * Retrieve CV improvement costs aggregated by session (admin only)
 *
 * Since cv-improvement uses the generic OpenAICall table (not dedicated task tables),
 * we group calls by (userId, timestamp window) to approximate "sessions".
 *
 * Query params:
 * - period: '24h', '7d', '30d', 'all' (default: '30d')
 * - limit: number of sessions to return (default: 50)
 */
export async function GET(request) {
  try {
    // Check authentication and admin role
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case '24h':
        startDate.setHours(now.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'all':
        startDate = new Date(0);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Get all CV improvement calls within the period
    const calls = await prisma.openAICall.findMany({
      where: {
        featureName: {
          in: CV_IMPROVEMENT_FEATURES,
        },
        createdAt: {
          gte: startDate,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // Group calls into sessions
    // A session is defined as calls from the same user within a 5-minute window
    const SESSION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
    const sessions = [];
    const processedCallIds = new Set();

    for (const call of calls) {
      if (processedCallIds.has(call.id)) continue;

      // Find all calls in this session
      const sessionCalls = calls.filter(c => {
        if (processedCallIds.has(c.id)) return false;
        if (c.userId !== call.userId) return false;
        const timeDiff = Math.abs(new Date(c.createdAt).getTime() - new Date(call.createdAt).getTime());
        return timeDiff <= SESSION_WINDOW_MS;
      });

      // Mark as processed
      sessionCalls.forEach(c => processedCallIds.add(c.id));

      // Skip if no calls (shouldn't happen)
      if (sessionCalls.length === 0) continue;

      // Calculate totals
      const totalPromptTokens = sessionCalls.reduce((sum, c) => sum + (c.promptTokens || 0), 0);
      const totalCachedTokens = sessionCalls.reduce((sum, c) => sum + (c.cachedTokens || 0), 0);
      const totalCompletionTokens = sessionCalls.reduce((sum, c) => sum + (c.completionTokens || 0), 0);
      const totalCost = sessionCalls.reduce((sum, c) => sum + (c.estimatedCost || 0), 0);
      const totalDuration = sessionCalls.reduce((sum, c) => sum + (c.duration || 0), 0);

      // Group by feature for breakdown
      const callsByFeature = {};
      for (const c of sessionCalls) {
        const feature = c.featureName;
        if (!callsByFeature[feature]) {
          callsByFeature[feature] = {
            feature,
            count: 0,
            promptTokens: 0,
            cachedTokens: 0,
            completionTokens: 0,
            estimatedCost: 0,
            durationMs: 0,
            models: new Set(),
          };
        }
        callsByFeature[feature].count++;
        callsByFeature[feature].promptTokens += c.promptTokens || 0;
        callsByFeature[feature].cachedTokens += c.cachedTokens || 0;
        callsByFeature[feature].completionTokens += c.completionTokens || 0;
        callsByFeature[feature].estimatedCost += c.estimatedCost || 0;
        callsByFeature[feature].durationMs += c.duration || 0;
        if (c.model) {
          callsByFeature[feature].models.add(c.model);
        }
      }

      // Convert Set to array for models
      const featureSummary = Object.values(callsByFeature).map(f => ({
        ...f,
        models: Array.from(f.models),
      }));

      // Sort features in pipeline order
      const featureOrder = [
        'classify_skills',
        'cv_improvement_v2_classify_skills',
        'cv_improvement_v2_preprocess',
        'cv_improvement_v2_experience',
        'cv_improvement_v2_project',
        'cv_improvement_v2_extras',
        'cv_improvement_v2_languages',
        'cv_improvement_v2_summary',
        'optimize_cv',
      ];
      featureSummary.sort((a, b) => {
        const aIndex = featureOrder.indexOf(a.feature);
        const bIndex = featureOrder.indexOf(b.feature);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });

      // Determine session timestamps
      const timestamps = sessionCalls.map(c => new Date(c.createdAt).getTime());
      const sessionStart = new Date(Math.min(...timestamps));
      const sessionEnd = new Date(Math.max(...timestamps));

      // Detect pipeline version
      const hasV2Features = sessionCalls.some(c =>
        c.featureName.startsWith('cv_improvement_v2_')
      );
      const pipelineVersion = hasV2Features ? 2 : 1;

      sessions.push({
        sessionId: `${call.userId}-${sessionStart.getTime()}`,
        userId: call.userId,
        user: call.user,
        pipelineVersion,
        startedAt: sessionStart,
        completedAt: sessionEnd,
        // Cost summary
        totals: {
          promptTokens: totalPromptTokens,
          cachedTokens: totalCachedTokens,
          completionTokens: totalCompletionTokens,
          totalTokens: totalPromptTokens + totalCompletionTokens,
          estimatedCost: totalCost,
          durationMs: totalDuration,
          callCount: sessionCalls.length,
        },
        // Breakdown by feature
        featureSummary,
        // Individual calls (for detailed view)
        calls: sessionCalls.map(c => ({
          id: c.id,
          featureName: c.featureName,
          model: c.model,
          promptTokens: c.promptTokens,
          cachedTokens: c.cachedTokens,
          completionTokens: c.completionTokens,
          estimatedCost: c.estimatedCost,
          duration: c.duration,
          createdAt: c.createdAt,
        })),
      });

      // Stop if we've reached the limit
      if (sessions.length >= limit) break;
    }

    // Calculate global aggregates
    const totalStats = {
      sessionCount: sessions.length,
      totalCost: sessions.reduce((sum, s) => sum + s.totals.estimatedCost, 0),
      totalPromptTokens: sessions.reduce((sum, s) => sum + s.totals.promptTokens, 0),
      totalCachedTokens: sessions.reduce((sum, s) => sum + s.totals.cachedTokens, 0),
      totalCompletionTokens: sessions.reduce((sum, s) => sum + s.totals.completionTokens, 0),
      totalDurationMs: sessions.reduce((sum, s) => sum + s.totals.durationMs, 0),
      totalCalls: sessions.reduce((sum, s) => sum + s.totals.callCount, 0),
      avgCostPerSession: sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.totals.estimatedCost, 0) / sessions.length
        : 0,
      avgDurationPerSession: sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.totals.durationMs, 0) / sessions.length
        : 0,
      v1Sessions: sessions.filter(s => s.pipelineVersion === 1).length,
      v2Sessions: sessions.filter(s => s.pipelineVersion === 2).length,
    };

    return NextResponse.json({
      period,
      startDate,
      endDate: now,
      totals: totalStats,
      sessions,
    });
  } catch (error) {
    console.error('[API /analytics/cv-improvement-costs] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
