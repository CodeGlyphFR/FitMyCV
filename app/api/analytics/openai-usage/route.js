import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/openai-usage
 * Retrieve OpenAI usage statistics for analytics dashboard (admin only)
 *
 * Query params:
 * - period: '24h', '7d', '30d', 'all' (default: '30d')
 * - userId: filter by specific user (optional)
 * - featureName: filter by specific feature (optional)
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
    const userId = searchParams.get('userId');
    const featureName = searchParams.get('featureName');

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
        startDate = new Date(0); // Start from epoch
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Build where clause
    const whereClause = {
      date: {
        gte: startDate,
      },
    };

    if (userId) {
      whereClause.userId = userId;
    }

    if (featureName) {
      whereClause.featureName = featureName;
    }

    // Get total aggregated stats
    const totalStats = await prisma.openAIUsage.aggregate({
      where: whereClause,
      _sum: {
        promptTokens: true,
        cachedTokens: true,
        completionTokens: true,
        totalTokens: true,
        estimatedCost: true,
        callsCount: true,
      },
    });

    // Features that support analysis levels
    const featuresWithLevels = [
      'generate_cv_url',
      'generate_cv_pdf',
      'create_template_cv_url',
      'create_template_cv_pdf',
      'generate_from_job_title',
      'import_pdf',
      'optimize_cv',
    ];

    // Get breakdown by feature
    const byFeature = await prisma.openAIUsage.groupBy({
      by: ['featureName'],
      where: whereClause,
      _sum: {
        estimatedCost: true,
        totalTokens: true,
        callsCount: true,
      },
      orderBy: [
        {
          _sum: {
            estimatedCost: 'desc',
          },
        },
        {
          featureName: 'asc', // Tri secondaire par nom pour stabilité quand coûts égaux
        },
      ],
    });

    // Get last cost for each feature (from individual call records)
    const lastCostByFeature = await Promise.all(
      byFeature.map(async (feature) => {
        const lastCall = await prisma.openAICall.findFirst({
          where: {
            featureName: feature.featureName,
            ...(userId && { userId }),
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            estimatedCost: true,
            model: true,
            promptTokens: true,
            cachedTokens: true,
            completionTokens: true,
            totalTokens: true,
            createdAt: true,
            duration: true,
          },
        });

        return {
          featureName: feature.featureName,
          lastCost: lastCall?.estimatedCost || 0,
          lastModel: lastCall?.model || null,
          lastPromptTokens: lastCall?.promptTokens || 0,
          lastCachedTokens: lastCall?.cachedTokens || 0,
          lastCompletionTokens: lastCall?.completionTokens || 0,
          lastTokens: lastCall?.totalTokens || 0,
          lastCallDate: lastCall?.createdAt || null,
          lastDuration: lastCall?.duration || null,
        };
      })
    );

    // Get breakdown by analysis level for features that support it
    const byFeatureWithLevels = await Promise.all(
      byFeature.map(async (feature) => {
        if (!featuresWithLevels.includes(feature.featureName)) {
          return null;
        }

        // Get all OpenAICall records for this feature to extract analysisLevel from metadata
        const calls = await prisma.openAICall.findMany({
          where: {
            featureName: feature.featureName,
            ...(userId && { userId }),
            createdAt: {
              gte: startDate,
            },
          },
          select: {
            metadata: true,
            estimatedCost: true,
            promptTokens: true,
            cachedTokens: true,
            completionTokens: true,
            totalTokens: true,
          },
        });

        // Group by analysisLevel
        const levelGroups = calls.reduce((acc, call) => {
          // Parse metadata JSON string
          let metadata = {};
          if (call.metadata) {
            try {
              metadata = JSON.parse(call.metadata);
            } catch (e) {
              console.warn('[OpenAI Usage API] Failed to parse metadata:', e);
            }
          }
          const level = metadata.analysisLevel || 'unknown';

          if (!acc[level]) {
            acc[level] = {
              cost: 0,
              promptTokens: 0,
              cachedTokens: 0,
              completionTokens: 0,
              tokens: 0,
              calls: 0,
            };
          }

          acc[level].cost += call.estimatedCost || 0;
          acc[level].promptTokens += call.promptTokens || 0;
          acc[level].cachedTokens += call.cachedTokens || 0;
          acc[level].completionTokens += call.completionTokens || 0;
          acc[level].tokens += call.totalTokens || 0;
          acc[level].calls += 1;

          return acc;
        }, {});

        const levels = Object.entries(levelGroups).map(([level, data]) => ({
          level,
          cost: data.cost,
          promptTokens: data.promptTokens,
          cachedTokens: data.cachedTokens,
          completionTokens: data.completionTokens,
          tokens: data.tokens,
          calls: data.calls,
        })).sort((a, b) => b.cost - a.cost); // Sort by cost descending

        // Only return level breakdown if there are real levels (not just "unknown")
        // This filters out features with old records (no metadata) or features without level support
        const hasRealLevels = levels.length > 1 || (levels.length === 1 && levels[0].level !== 'unknown');

        if (!hasRealLevels) {
          return null; // No level breakdown for this feature
        }

        return {
          featureName: feature.featureName,
          levels,
        };
      })
    );

    // Filter out nulls and create a map for easy lookup
    const levelBreakdownMap = byFeatureWithLevels
      .filter(item => item !== null)
      .reduce((acc, item) => {
        acc[item.featureName] = item.levels;
        return acc;
      }, {});

    // Get breakdown by model
    const byModel = await prisma.openAIUsage.groupBy({
      by: ['model'],
      where: whereClause,
      _sum: {
        estimatedCost: true,
        totalTokens: true,
      },
      orderBy: {
        _sum: {
          estimatedCost: 'desc',
        },
      },
    });

    // Get timeline data (daily aggregation)
    const timeline = await prisma.openAIUsage.groupBy({
      by: ['date'],
      where: whereClause,
      _sum: {
        estimatedCost: true,
        totalTokens: true,
        callsCount: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Get top users by cost (if not filtering by user)
    let topUsers = [];
    if (!userId) {
      const userStats = await prisma.openAIUsage.groupBy({
        by: ['userId'],
        where: whereClause,
        _sum: {
          estimatedCost: true,
          totalTokens: true,
          callsCount: true,
        },
        orderBy: {
          _sum: {
            estimatedCost: 'desc',
          },
        },
        take: 10,
      });

      // Fetch user details
      const userIds = userStats.map(stat => stat.userId);
      const users = await prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      // Map user details to stats
      topUsers = userStats.map(stat => {
        const user = users.find(u => u.id === stat.userId);
        return {
          userId: stat.userId,
          email: user?.email || 'Unknown',
          name: user?.name || null,
          totalCost: stat._sum.estimatedCost || 0,
          totalTokens: stat._sum.totalTokens || 0,
          totalCalls: stat._sum.callsCount || 0,
        };
      });
    }

    // Format response
    const response = {
      period,
      startDate,
      endDate: now,
      total: {
        cost: totalStats._sum.estimatedCost || 0,
        promptTokens: totalStats._sum.promptTokens || 0,
        cachedTokens: totalStats._sum.cachedTokens || 0,
        completionTokens: totalStats._sum.completionTokens || 0,
        totalTokens: totalStats._sum.totalTokens || 0,
        calls: totalStats._sum.callsCount || 0,
      },
      byFeature: byFeature.map(f => {
        const lastCostData = lastCostByFeature.find(lc => lc.featureName === f.featureName);
        const levelBreakdown = levelBreakdownMap[f.featureName] || null;

        return {
          feature: f.featureName,
          cost: f._sum.estimatedCost || 0,
          tokens: f._sum.totalTokens || 0,
          calls: f._sum.callsCount || 0,
          lastCost: lastCostData?.lastCost || 0,
          lastModel: lastCostData?.lastModel || null,
          lastPromptTokens: lastCostData?.lastPromptTokens || 0,
          lastCachedTokens: lastCostData?.lastCachedTokens || 0,
          lastCompletionTokens: lastCostData?.lastCompletionTokens || 0,
          lastTokens: lastCostData?.lastTokens || 0,
          lastCallDate: lastCostData?.lastCallDate || null,
          lastDuration: lastCostData?.lastDuration || null,
          levelBreakdown: levelBreakdown, // Add level breakdown if available
        };
      }),
      byModel: byModel.map(m => ({
        model: m.model,
        cost: m._sum.estimatedCost || 0,
        tokens: m._sum.totalTokens || 0,
      })),
      timeline: timeline.map(t => ({
        date: t.date,
        cost: t._sum.estimatedCost || 0,
        tokens: t._sum.totalTokens || 0,
        calls: t._sum.callsCount || 0,
      })),
      topUsers,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API /analytics/openai-usage] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
