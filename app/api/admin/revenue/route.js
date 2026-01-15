import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import {
  calculateRevenueKPIs,
  getRevenueHistory,
  getRevenueHistoryByWeeks,
  getRevenueHistoryByDays,
  getYearsWithSubscriptions
} from '@/lib/admin/revenueMetrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/revenue
 * Récupère toutes les métriques de revenus pour le dashboard admin
 * @param {string} period - Période: '12months', '6months', 'month', 'week'
 * @param {number} year - Année (pour 12months et 6months)
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

    // Récupérer les paramètres
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '12months';
    const year = parseInt(searchParams.get('year')) || new Date().getFullYear();

    // Calculer toutes les KPI
    const kpis = await calculateRevenueKPIs();

    // Récupérer l'historique selon la période
    let revenueHistory;
    switch (period) {
      case '6months':
        revenueHistory = await getRevenueHistory(6, year);
        break;
      case 'month':
        revenueHistory = await getRevenueHistoryByWeeks();
        break;
      case 'week':
        revenueHistory = await getRevenueHistoryByDays();
        break;
      case '12months':
      default:
        revenueHistory = await getRevenueHistory(12, year);
    }

    // Récupérer les années ayant des abonnements
    const availableYears = await getYearsWithSubscriptions();

    return NextResponse.json({
      success: true,
      data: {
        ...kpis,
        revenueHistory,
        period,
        year,
        availableYears,
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
