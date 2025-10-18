import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * GET /api/analytics/feedbacks
 * Retrieve user feedback statistics for analytics dashboard (admin only)
 *
 * Query params:
 * - period: '24h', '7d', '30d', 'all' (default: '30d')
 * - status: 'new', 'reviewed', 'resolved', 'all' (default: 'all')
 * - isBugReport: 'true', 'false', 'all' (default: 'all')
 * - userId: filter by specific user (optional)
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
    const status = searchParams.get('status') || 'all';
    const isBugReport = searchParams.get('isBugReport') || 'all';
    const userId = searchParams.get('userId');

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
      createdAt: {
        gte: startDate,
      },
    };

    if (userId) {
      whereClause.userId = userId;
    }

    if (status !== 'all') {
      whereClause.status = status;
    }

    if (isBugReport !== 'all') {
      whereClause.isBugReport = isBugReport === 'true';
    }

    // Get total count and stats
    const totalCount = await prisma.feedback.count({
      where: whereClause,
    });

    // Get average rating
    const ratingStats = await prisma.feedback.aggregate({
      where: whereClause,
      _avg: {
        rating: true,
      },
    });

    // Get counts by status
    const byStatus = await prisma.feedback.groupBy({
      by: ['status'],
      where: whereClause,
      _count: {
        id: true,
      },
    });

    // Get counts by rating
    const byRating = await prisma.feedback.groupBy({
      by: ['rating'],
      where: whereClause,
      _count: {
        id: true,
      },
      orderBy: {
        rating: 'asc',
      },
    });

    // Get bug reports count
    const bugReportsCount = await prisma.feedback.count({
      where: {
        ...whereClause,
        isBugReport: true,
      },
    });

    // Get feedbacks with user info (paginated)
    const feedbacks = await prisma.feedback.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Limit to last 100 feedbacks
    });

    // Get timeline data (daily aggregation)
    const timelineData = await prisma.feedback.groupBy({
      by: ['createdAt'],
      where: whereClause,
      _count: {
        id: true,
      },
      _avg: {
        rating: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group timeline by day
    const dailyTimeline = {};
    timelineData.forEach(item => {
      const day = new Date(item.createdAt).toISOString().split('T')[0];
      if (!dailyTimeline[day]) {
        dailyTimeline[day] = {
          date: day,
          count: 0,
          totalRating: 0,
          ratingCount: 0,
        };
      }
      dailyTimeline[day].count += item._count.id;
      dailyTimeline[day].totalRating += (item._avg.rating || 0) * item._count.id;
      dailyTimeline[day].ratingCount += item._count.id;
    });

    const timeline = Object.values(dailyTimeline).map(day => ({
      date: day.date,
      count: day.count,
      avgRating: day.ratingCount > 0 ? day.totalRating / day.ratingCount : 0,
    }));

    // Get top users by feedback count
    let topUsers = [];
    if (!userId) {
      const userStats = await prisma.feedback.groupBy({
        by: ['userId'],
        where: whereClause,
        _count: {
          id: true,
        },
        _avg: {
          rating: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
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
          feedbackCount: stat._count.id,
          avgRating: stat._avg.rating || 0,
        };
      });
    }

    // Format response
    const response = {
      period,
      startDate,
      endDate: now,
      total: {
        count: totalCount,
        avgRating: ratingStats._avg.rating || 0,
        bugReports: bugReportsCount,
      },
      byStatus: byStatus.map(s => ({
        status: s.status,
        count: s._count.id,
      })),
      byRating: byRating.map(r => ({
        rating: r.rating,
        count: r._count.id,
      })),
      timeline,
      topUsers,
      feedbacks: feedbacks.map(f => ({
        id: f.id,
        userId: f.userId,
        user: {
          email: f.user?.email || 'Unknown',
          name: f.user?.name,
        },
        rating: f.rating,
        comment: f.comment,
        isBugReport: f.isBugReport,
        currentCvFile: f.currentCvFile,
        userAgent: f.userAgent,
        pageUrl: f.pageUrl,
        createdAt: f.createdAt,
        status: f.status,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API /analytics/feedbacks] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/analytics/feedbacks
 * Update feedback status (admin only)
 *
 * Body:
 * {
 *   feedbackId: string,
 *   status: 'new' | 'reviewed' | 'resolved'
 * }
 */
export async function PATCH(request) {
  try {
    // Check authentication and admin role
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const body = await request.json();
    const { feedbackId, status } = body;

    // Validate
    if (!feedbackId || !status) {
      return NextResponse.json(
        { error: 'Missing feedbackId or status' },
        { status: 400 }
      );
    }

    const validStatuses = ['new', 'reviewed', 'resolved'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Update feedback
    const updated = await prisma.feedback.update({
      where: { id: feedbackId },
      data: { status },
    });

    return NextResponse.json({ success: true, feedback: updated });
  } catch (error) {
    console.error('[API /analytics/feedbacks PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
