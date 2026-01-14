import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { CommonErrors } from '@/lib/api/apiErrors';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/events
 * Get telemetry events with filters
 * Query params:
 *   - userId: Filter by user ID
 *   - type: Filter by event type
 *   - category: Filter by category
 *   - status: Filter by status
 *   - startDate: Start date (ISO string)
 *   - endDate: End date (ISO string)
 *   - limit: Max results (default: 100, max: 1000)
 *   - offset: Pagination offset (default: 0)
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

    // Parse filters
    const userId = searchParams.get('userId');
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const period = searchParams.get('period');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build where clause
    const where = {};

    if (userId) where.userId = userId;
    if (type) where.type = type;
    if (category) where.category = category;
    if (status) where.status = status;

    // Handle period parameter (for exports compatibility)
    if (period && !startDate && !endDate) {
      const now = new Date();
      let periodStartDate = null;

      switch (period) {
        case '24h':
          periodStartDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          periodStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          periodStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
        default:
          periodStartDate = null;
      }

      if (periodStartDate) {
        where.timestamp = { gte: periodStartDate };
      }
    } else if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    // Get events and total count
    const [events, total] = await Promise.all([
      prisma.telemetryEvent.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),

      prisma.telemetryEvent.count({ where }),
    ]);

    // Parse metadata
    const eventsWithParsedMetadata = events.map(event => ({
      ...event,
      metadata: event.metadata ? JSON.parse(event.metadata) : null,
    }));

    return NextResponse.json({
      events: eventsWithParsedMetadata,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });

  } catch (error) {
    console.error('[Analytics API] Error getting events:', error);
    return NextResponse.json(
      { error: 'Failed to get events' },
      { status: 500 }
    );
  }
}
