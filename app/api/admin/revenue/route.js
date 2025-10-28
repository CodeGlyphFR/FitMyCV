import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { calculateRevenueKPIs, getMRRHistory } from '@/lib/admin/revenueMetrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/revenue
 * Récupère toutes les métriques de revenus pour le dashboard admin
 */
export async function GET(request) {
  try {
    // Vérifier que l'utilisateur est admin
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 403 }
      );
    }

    // Calculer toutes les KPI
    const kpis = await calculateRevenueKPIs();

    // Récupérer l'historique MRR (12 derniers mois par défaut)
    const mrrHistory = await getMRRHistory(12);

    return NextResponse.json({
      success: true,
      data: {
        ...kpis,
        mrrHistory,
      },
    });
  } catch (error) {
    console.error('[API /admin/revenue] Erreur:', error);
    console.error('[API /admin/revenue] Stack:', error.stack);
    return NextResponse.json(
      {
        error: 'Erreur lors du calcul des métriques',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
