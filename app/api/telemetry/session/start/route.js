import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { findOrCreateSession } from '@/lib/telemetry/server';

/**
 * POST /api/telemetry/session/start
 * Find an active session or start a new user session
 * Reuses sessions that are still active (< 10 minutes inactive)
 */
export async function POST(request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      // Don't track sessions for non-authenticated users
      return NextResponse.json({ success: false, reason: 'not_authenticated' });
    }

    const body = await request.json();
    const { deviceId, sessionId, userAgent } = body;

    // Get client IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || null;

    const userSession = await findOrCreateSession({
      userId,
      deviceId: deviceId || null,
      userAgent: userAgent || request.headers.get('user-agent') || null,
      ip,
    });

    return NextResponse.json({
      success: true,
      sessionId: userSession?.id || sessionId,
    });

  } catch (error) {
    console.error('[Telemetry API] Error starting session:', error);
    return NextResponse.json(
      { error: 'Failed to start session' },
      { status: 500 }
    );
  }
}
