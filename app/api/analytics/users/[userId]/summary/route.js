import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { CommonErrors } from '@/lib/api/apiErrors';
import prisma from '@/lib/prisma';

/**
 * GET /api/analytics/users/[userId]/summary
 * Get detailed statistics for a specific user
 */
export async function GET(request, { params }) {
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

    // Next.js 16: params est maintenant async
    const { userId } = await params;

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
        lastActivity: lastActivity?.timestamp || null,
        lastFeature: lastActivity?.type || null,
      },
      featureUsage: featuresWithParsedMetadata,
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
