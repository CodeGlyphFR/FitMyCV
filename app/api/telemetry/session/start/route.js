import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { findOrCreateSession, cleanupInactiveSessions } from '@/lib/telemetry/server';

// In-memory cache to limit cleanup frequency (max 1x per minute)
let lastCleanupTime = 0;
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute

/**
 * POST /api/telemetry/session/start
 * Find an active session or start a new user session
 * Reuses sessions that are still active (< 10 minutes inactive)
 * Also triggers periodic cleanup of inactive sessions
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

    // Periodic cleanup of inactive sessions (max 1x per minute)
    const now = Date.now();
    if (now - lastCleanupTime > CLEANUP_INTERVAL) {
      lastCleanupTime = now;
      // Run cleanup in background (don't wait for it)
      cleanupInactiveSessions().catch(err => {
        console.error('[Telemetry] Background cleanup failed:', err);
      });
    }

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
