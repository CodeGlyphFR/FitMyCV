"use client";

import React from "react";
import { Activity, TrendingUp } from "lucide-react";

const FEATURE_LABELS = {
  gpt_cv_generation: "🤖 Génération CV IA",
  import_pdf: "📄 Import PDF",
  translate_cv: "🌍 Traduction",
  calculate_match_score: "🎯 Score de match",
  improve_cv: "✨ Optimisation",
  generate_from_job_title: "💼 Génération depuis titre",
  export_pdf: "📥 Export PDF",
  edit_cv: "✏️ Édition",
  create_manual_cv: "📝 Création manuelle",
};

export default function FeatureCountersCard({ featureCounters, plan }) {
  if (!plan || !plan.featureLimits) {
    return null;
  }

  const getUsageForFeature = (featureName) => {
    const counter = featureCounters?.find((c) => c.featureName === featureName);
    return counter?.count || 0;
  };

  const getLimitForFeature = (featureName) => {
    const limit = plan.featureLimits.find((f) => f.featureName === featureName);
    return limit?.usageLimit || 0;
  };

  const getProgressColor = (usage, limit) => {
    if (limit === -1) return "bg-green-500";
    const percentage = (usage / limit) * 100;
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-orange-500";
    return "bg-blue-500";
  };

  const formatLimit = (limit) => {
    if (limit === -1) return "∞";
    return limit;
  };

  return (
    <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="text-white" size={24} />
        <h2 className="text-xl font-semibold text-white">Utilisation mensuelle</h2>
      </div>

      <div className="space-y-4">
        {plan.featureLimits.map((featureLimit) => {
          const usage = getUsageForFeature(featureLimit.featureName);
          const limit = featureLimit.usageLimit;
          const percentage = limit === -1 ? 0 : Math.min((usage / limit) * 100, 100);
          const progressColor = getProgressColor(usage, limit);
          const featureLabel = FEATURE_LABELS[featureLimit.featureName] || featureLimit.featureName;

          return (
            <div key={featureLimit.featureName}>
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm text-white font-medium">{featureLabel}</div>
                <div className="text-xs text-white/60">
                  {usage} / {formatLimit(limit)}
                </div>
              </div>

              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full ${progressColor} transition-all duration-300`}
                  style={{ width: limit === -1 ? '0%' : `${percentage}%` }}
                ></div>
              </div>

              {limit !== -1 && percentage >= 90 && (
                <div className="text-xs text-orange-300 mt-1">
                  ⚠️ Limite presque atteinte ({Math.round(percentage)}%)
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <TrendingUp className="text-blue-300 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-blue-200">
            <div className="font-medium mb-1">💎 Besoin de plus ?</div>
            <div>Achetez des crédits pour dépasser vos limites mensuelles sans changer de plan.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
