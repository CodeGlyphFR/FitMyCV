import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/session';
import './globals.css';

/**
 * Admin Analytics Layout
 * Protects the analytics dashboard - only accessible to admins
 */
export default async function AdminAnalyticsLayout({ children }) {
  const session = await auth();

  // Check if user is authenticated
  if (!session?.user) {
    redirect('/');
  }

  // Check if user has admin role
  if (session.user.role !== 'ADMIN') {
    redirect('/');
  }

  return children;
}
