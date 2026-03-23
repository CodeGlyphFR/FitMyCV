import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { startSession, cleanupStaleSessions } from '@/lib/session/sessionManager';

export async function POST() {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) {
    return Response.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Profiter de chaque start pour nettoyer les sessions stale
  cleanupStaleSessions();

  const sessionId = startSession(authSession.user.id);
  return Response.json({ sessionId });
}
