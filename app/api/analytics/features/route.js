import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * GET /api/analytics/features
 * Get feature usage statistics
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

    // Get all feature usage aggregated
    const features = await prisma.featureUsage.groupBy({
      by: ['featureName'],
      _sum: {
        usageCount: true,
        totalDuration: true,
      },
      _max: {
        lastUsedAt: true,
      },
    });

    // Get user count per feature
    const featureUserCounts = await Promise.all(
      features.map(async (feature) => {
        const userCount = await prisma.featureUsage.count({
          where: { featureName: feature.featureName },
        });

        // Get analysis level breakdown if available
        const usageRecords = await prisma.featureUsage.findMany({
          where: { featureName: feature.featureName },
          select: { metadata: true },
        });

        const analysisLevelBreakdown = {};
        usageRecords.forEach(record => {
          if (record.metadata) {
            try {
              const meta = JSON.parse(record.metadata);
              Object.entries(meta).forEach(([level, count]) => {
                analysisLevelBreakdown[level] = (analysisLevelBreakdown[level] || 0) + count;
              });
            } catch (e) {
              // Ignore parsing errors
            }
          }
        });

        return {
          featureName: feature.featureName,
          totalUsage: feature._sum.usageCount || 0,
          totalDuration: feature._sum.totalDuration || 0,
          avgDuration: feature._sum.usageCount > 0
            ? Math.round((feature._sum.totalDuration || 0) / feature._sum.usageCount)
            : 0,
          userCount,
          lastUsedAt: feature._max.lastUsedAt,
          analysisLevelBreakdown: Object.keys(analysisLevelBreakdown).length > 0
            ? analysisLevelBreakdown
            : null,
        };
      })
    );

    // Sort by total usage
    featureUserCounts.sort((a, b) => b.totalUsage - a.totalUsage);

    return NextResponse.json({
      features: featureUserCounts,
    });

  } catch (error) {
    console.error('[Analytics API] Error getting features:', error);
    return NextResponse.json(
      { error: 'Failed to get feature statistics' },
      { status: 500 }
    );
  }
}
