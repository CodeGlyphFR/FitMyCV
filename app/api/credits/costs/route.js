/**
 * GET /api/credits/costs
 *
 * Retourne les coûts en crédits pour chaque feature.
 * Utilisé côté client pour afficher le coût avant utilisation.
 *
 * Réponse:
 * - showCosts: boolean - true si on doit afficher les coûts (mode crédits-only)
 * - subscriptionModeEnabled: boolean - true si mode abonnement actif
 * - costs: { featureName: cost } - coûts par feature
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { CommonErrors } from '@/lib/api/apiErrors';
import { getNumericSettingValue, getBooleanSettingValue } from '@/lib/settings/settingsUtils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Features et leurs coûts par défaut
const FEATURES = [
  'create_cv_manual',
  'edit_cv',
  'export_cv',
  'match_score',
  'translate_cv',
  'gpt_cv_generation',
  'optimize_cv',
  'generate_from_job_title',
  'import_pdf',
];

const DEFAULT_COSTS = {
  create_cv_manual: 1,
  edit_cv: 1,
  export_cv: 1,
  match_score: 1,
  translate_cv: 1,
  gpt_cv_generation: 2,
  optimize_cv: 2,
  generate_from_job_title: 3,
  import_pdf: 5,
};

export async function GET() {
  try {
    // Vérifier l'authentification
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    // Récupérer le mode
    const subscriptionModeEnabled = await getBooleanSettingValue('subscription_mode_enabled', true);

    // Si mode abonnement actif, pas besoin d'afficher les coûts
    if (subscriptionModeEnabled) {
      return NextResponse.json({
        showCosts: false,
        subscriptionModeEnabled: true,
        costs: {},
      });
    }

    // Mode crédits-only: récupérer tous les coûts
    const costs = {};
    for (const feature of FEATURES) {
      const cost = await getNumericSettingValue(`credits_${feature}`, DEFAULT_COSTS[feature] ?? 1);
      costs[feature] = cost;
    }

    return NextResponse.json({
      showCosts: true,
      subscriptionModeEnabled: false,
      costs,
    });
  } catch (error) {
    console.error('[API credits/costs] Erreur:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
