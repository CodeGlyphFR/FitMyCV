import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

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
        completionTokens: true,
        totalTokens: true,
        estimatedCost: true,
        callsCount: true,
      },
    });

    // Get breakdown by feature
    const byFeature = await prisma.openAIUsage.groupBy({
      by: ['featureName'],
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
          },
        });

        return {
          featureName: feature.featureName,
          lastCost: lastCall?.estimatedCost || 0,
        };
      })
    );

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
        completionTokens: totalStats._sum.completionTokens || 0,
        totalTokens: totalStats._sum.totalTokens || 0,
        calls: totalStats._sum.callsCount || 0,
      },
      byFeature: byFeature.map(f => {
        const lastCostData = lastCostByFeature.find(lc => lc.featureName === f.featureName);
        return {
          feature: f.featureName,
          cost: f._sum.estimatedCost || 0,
          tokens: f._sum.totalTokens || 0,
          calls: f._sum.callsCount || 0,
          lastCost: lastCostData?.lastCost || 0,
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
