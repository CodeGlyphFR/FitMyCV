'use client';

import { getPlanColor } from '@/lib/admin/planColors';

/**
 * Graphique de distribution des utilisateurs par plan d'abonnement
 */
export function PlanDistributionChart({ distribution }) {
  if (!distribution || distribution.length === 0) {
    return (
      <div className="text-center py-8 text-white/60">
        Aucune donnée de distribution disponible
      </div>
    );
  }

  const maxCount = Math.max(...distribution.map(d => d.count));

  return (
    <div className="space-y-4">
      {distribution.map((plan) => {
        const color = getPlanColor(plan.tier);
        const percentage = maxCount > 0 ? (plan.count / maxCount) * 100 : 0;

        // Calculer le total des revenus de ce plan (MRR + ARR)
        const planTotal = plan.realMRR + plan.realARR;

        return (
          <div key={plan.planId} className="space-y-2">
            {/* En-tête avec nom du plan et stats */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs rounded ${color.bg} ${color.text} font-medium`}>
                  {color.icon} {plan.planName}
                </span>
                <span className="text-white/60 text-sm">
                  {plan.count} utilisateur{plan.count > 1 ? 's' : ''}
                </span>
              </div>
              <span className="text-white/60 text-sm">
                {planTotal.toFixed(2)}€
              </span>
            </div>

            {/* Barre de progression */}
            <div className="w-full bg-white/5 rounded-full h-8 overflow-hidden border border-white/10">
              <div
                className={`h-full ${color.bg.replace('/20', '/40')} flex items-center px-3 transition-all duration-500`}
                style={{ width: `${Math.max(percentage, 5)}%` }}
              >
                <span className={`text-xs ${color.text} font-medium`}>
                  {((plan.count / distribution.reduce((sum, p) => sum + p.count, 0)) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
