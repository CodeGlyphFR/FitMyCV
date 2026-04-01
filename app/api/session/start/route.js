import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { startSession } from '@/lib/session/sessionManager';

export async function POST() {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) {
    return Response.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const sessionId = await startSession(authSession.user.id);
  return Response.json({ sessionId });
}
