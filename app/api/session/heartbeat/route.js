import { heartbeat } from '@/lib/session/sessionManager';

export async function POST(request) {
  const { sessionId } = await request.json();
  if (!sessionId) {
    return Response.json({ error: 'sessionId requis' }, { status: 400 });
  }

  const found = heartbeat(sessionId);
  if (!found) {
    return Response.json({ error: 'Session introuvable' }, { status: 404 });
  }
  return Response.json({ ok: true });
}
