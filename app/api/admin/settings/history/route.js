import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/settings/history
 * Get settings modification history
 * This logs changes to settings by tracking telemetry events
 */
export async function GET(request) {
  try {
    const session = await auth();

    // Only admin can access history
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    // Get telemetry events related to settings changes
    const history = await prisma.telemetryEvent.findMany({
      where: {
        OR: [
          { type: 'SETTING_CREATED' },
          { type: 'SETTING_UPDATED' },
          { type: 'SETTING_DELETED' },
        ],
      },
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
    });

    const historyWithMetadata = history.map(h => ({
      ...h,
      metadata: h.metadata ? JSON.parse(h.metadata) : null,
    }));

    return NextResponse.json({ history: historyWithMetadata });

  } catch (error) {
    console.error('[Settings API] Error getting history:', error);
    return NextResponse.json(
      { error: 'Failed to get settings history' },
      { status: 500 }
    );
  }
}
