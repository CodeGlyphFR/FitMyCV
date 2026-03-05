import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { CommonErrors } from '@/lib/api/apiErrors';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/users
 * Get list of users for filtering in analytics dashboard
 * Only returns users with activity (events or CVs)
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

    // Get all users with their activity stats
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        _count: {
          select: {
            cvs: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Batch query : récupérer la dernière activité de TOUS les users en une seule requête (au lieu de N+1)
    const lastEvents = await prisma.$queryRaw`
      SELECT DISTINCT ON ("userId") "userId", "timestamp"
      FROM "TelemetryEvent"
      WHERE "userId" IS NOT NULL
      ORDER BY "userId", "timestamp" DESC
    `;
    const lastEventMap = new Map(lastEvents.map(e => [e.userId, e.timestamp]));

    const usersWithActivity = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      cvCount: user._count.cvs,
      lastActivity: lastEventMap.get(user.id) || user.createdAt,
    }));

    // Filter users with at least some activity and sort by last activity
    const activeUsers = usersWithActivity
      .filter(user => user.cvCount > 0 || user.lastActivity !== user.createdAt)
      .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

    return NextResponse.json(activeUsers);

  } catch (error) {
    console.error('[Analytics API] Error getting users:', error);
    return NextResponse.json(
      { error: 'Failed to get users list' },
      { status: 500 }
    );
  }
}
