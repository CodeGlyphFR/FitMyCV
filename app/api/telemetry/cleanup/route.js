import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { cleanupInactiveSessions } from '@/lib/telemetry/server';

/**
 * POST /api/telemetry/cleanup
 * Cleanup inactive sessions (> 10 minutes inactive)
 * Admin only
 */
export async function POST(request) {
  try {
    const session = await auth();

    // Only admin can trigger cleanup
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const result = await cleanupInactiveSessions();

    return NextResponse.json({
      success: true,
      ...result,
      message: `Closed ${result.closed} inactive session(s)`,
    });

  } catch (error) {
    console.error('[Telemetry API] Error during cleanup:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup sessions' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/telemetry/cleanup
 * Get cleanup statistics (doesn't actually cleanup)
 * Admin only
 */
export async function GET(request) {
  try {
    const session = await auth();

    // Only admin can view statistics
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      // Count inactive sessions without closing them
      const inactiveSessions = await prisma.userSession.count({
        where: {
          endedAt: null,
          lastActivityAt: { lt: tenMinutesAgo },
        },
      });

      const activeSessions = await prisma.userSession.count({
        where: {
          endedAt: null,
          lastActivityAt: { gte: tenMinutesAgo },
        },
      });

      const totalSessions = await prisma.userSession.count({
        where: {
          endedAt: null,
        },
      });

      return NextResponse.json({
        inactive: inactiveSessions,
        active: activeSessions,
        total: totalSessions,
        threshold: '10 minutes',
      });
    } finally {
      await prisma.$disconnect();
    }

  } catch (error) {
    console.error('[Telemetry API] Error getting cleanup stats:', error);
    return NextResponse.json(
      { error: 'Failed to get cleanup statistics' },
      { status: 500 }
    );
  }
}
