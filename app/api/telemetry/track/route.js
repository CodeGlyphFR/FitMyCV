import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { trackEvent } from '@/lib/telemetry/server';

/**
 * POST /api/telemetry/track
 * Receive telemetry events from frontend
 */
export async function POST(request) {
  try {
    const session = await auth();
    const userId = session?.user?.id || null;

    const body = await request.json();
    const { events } = body;

    if (!events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: 'Invalid events array' },
        { status: 400 }
      );
    }

    // Track each event
    const results = await Promise.allSettled(
      events.map(event =>
        trackEvent({
          type: event.type,
          userId,
          deviceId: event.deviceId || null,
          sessionId: event.sessionId || null,
          metadata: event.metadata || null,
          duration: event.duration || null,
          status: event.status || 'success',
          error: event.error || null,
        })
      )
    );

    // Count successes and failures
    const successes = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected').length;

    return NextResponse.json({
      success: true,
      tracked: successes,
      failed: failures,
    });

  } catch (error) {
    console.error('[Telemetry API] Error tracking events:', error);
    return NextResponse.json(
      { error: 'Failed to track events' },
      { status: 500 }
    );
  }
}
