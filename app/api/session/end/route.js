import { endSession } from '@/lib/session/sessionManager';

export async function POST(request) {
  try {
    const { sessionId } = await request.json();
    if (!sessionId) {
      return Response.json({ error: 'sessionId requis' }, { status: 400 });
    }

    await endSession(sessionId);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true });
  }
}
