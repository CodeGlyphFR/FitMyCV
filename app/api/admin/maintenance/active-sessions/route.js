import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/maintenance/active-sessions
 * Compte les utilisateurs non-admin potentiellement actifs (activité récente)
 * Utilisé pour afficher le compteur dans la modal de confirmation du mode maintenance
 */
export async function GET() {
  try {
    const session = await auth();

    // Vérifier que l'utilisateur est admin
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Session maxAge est de 7 jours (défini dans authOptions)
    const sessionMaxAgeDays = 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - sessionMaxAgeDays);

    // Compter les utilisateurs non-admin avec une activité récente
    // On utilise updatedAt comme proxy pour l'activité
    const recentActiveUsers = await prisma.user.count({
      where: {
        role: {
          not: 'ADMIN',
        },
        updatedAt: {
          gte: cutoffDate,
        },
      },
    });

    return NextResponse.json({
      recentActiveUsers,
      sessionMaxAgeDays,
      cutoffDate: cutoffDate.toISOString(),
    });

  } catch (error) {
    console.error('[Maintenance API] Error counting active sessions:', error);
    return NextResponse.json(
      { error: 'Failed to count active sessions' },
      { status: 500 }
    );
  }
}
