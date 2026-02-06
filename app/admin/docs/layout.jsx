import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/session';

export default async function AdminDocsLayout({ children }) {
  const session = await auth();

  // Vérifier que l'utilisateur est authentifié
  if (!session?.user) {
    redirect('/');
  }

  // Vérifier que l'utilisateur est admin
  if (session.user.role !== 'ADMIN') {
    redirect('/');
  }

  return children;
}
