import { NextResponse } from 'next/server';
import { endSession } from '@/lib/telemetry/server';

/**
 * POST /api/telemetry/session/end
 * End a user session
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    await endSession(sessionId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Telemetry API] Error ending session:', error);
    return NextResponse.json(
      { error: 'Failed to end session' },
      { status: 500 }
    );
  }
}
