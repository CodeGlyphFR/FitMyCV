import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { getUsdToEurRate } from '@/lib/utils/exchangeRate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Parse a currency value that may contain symbols ($, €, etc.)
 * Handles formats like "$0.2492", "9.99 €", or raw numbers
 * @param {string|number} value - Value to parse
 * @returns {number} Parsed numeric value
 */
function parseCurrencyValue(value) {
  if (value === null || value === undefined) return 0;
  // Convert to string and remove currency symbols, spaces, replace comma with dot
  const cleaned = String(value).replace(/[$€£\s]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

/**
 * GET /api/admin/plan-costs
 * Returns API cost estimates and margin calculations per subscription plan
 *
 * Response structure:
 * {
 *   success: boolean,
 *   data: {
 *     costs: [
 *       {
 *         plan: string,
 *         priceMonthlyEur: number,
 *         costMinUsd: number,
 *         costAvgUsd: number,
 *         costMaxUsd: number,
 *         costMaxEur: number,
 *         grossMarginEur: number,
 *         marginPercent: number,
 *       }
 *     ],
 *     exchangeRate: {
 *       usdToEur: number,
 *       cached: boolean,
 *       error?: string,
 *     },
 *     timestamp: string,
 *   }
 * }
 */
export async function GET(request) {
  try {
    // Admin-only access check
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Query the PostgreSQL view for API costs per plan
    // View columns: plan, prix_mensuel, cout_min_api, cout_moyen_api, cout_max_api
    let viewData = [];
    try {
      viewData = await prisma.$queryRaw`
        SELECT
          plan,
          prix_mensuel,
          cout_min_api,
          cout_moyen_api,
          cout_max_api
        FROM v_cout_api_par_plan
        ORDER BY prix_mensuel ASC
      `;
    } catch (dbError) {
      // La vue v_cout_api_par_plan est optionnelle - retourne des données vides si elle n'existe pas
      // Pour créer la vue, voir docs/database-views.md
      viewData = [];
    }

    // Fetch exchange rate (cached)
    const exchangeResult = await getUsdToEurRate();
    const { rate: usdToEur, cached, error: exchangeError } = exchangeResult;

    // Calculate margins for each plan
    const costs = viewData.map((row) => {
      // Use parseCurrencyValue to handle formatted values like "$0.2492" or "9.99 €"
      const priceMonthlyEur = parseCurrencyValue(row.prix_mensuel);
      const costMinUsd = parseCurrencyValue(row.cout_min_api);
      const costAvgUsd = parseCurrencyValue(row.cout_moyen_api);
      const costMaxUsd = parseCurrencyValue(row.cout_max_api);

      // Convert max cost to EUR for margin calculation
      const costMaxEur = costMaxUsd * usdToEur;

      // Calculate gross margin (price - max cost)
      const grossMarginEur = priceMonthlyEur - costMaxEur;

      // Calculate margin percentage
      const marginPercent =
        priceMonthlyEur > 0 ? (grossMarginEur / priceMonthlyEur) * 100 : 0;

      return {
        plan: row.plan,
        priceMonthlyEur: Math.round(priceMonthlyEur * 100) / 100,
        costMinUsd: Math.round(costMinUsd * 100) / 100,
        costAvgUsd: Math.round(costAvgUsd * 100) / 100,
        costMaxUsd: Math.round(costMaxUsd * 100) / 100,
        costMaxEur: Math.round(costMaxEur * 100) / 100,
        grossMarginEur: Math.round(grossMarginEur * 100) / 100,
        marginPercent: Math.round(marginPercent * 10) / 10, // 1 decimal place
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        costs,
        exchangeRate: {
          usdToEur: Math.round(usdToEur * 10000) / 10000, // 4 decimal places
          cached,
          ...(exchangeError && { error: exchangeError }),
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API /admin/plan-costs] Error:', error);
    console.error('[API /admin/plan-costs] Stack:', error.stack);
    return NextResponse.json(
      {
        error: 'Erreur lors du calcul des couts API',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
