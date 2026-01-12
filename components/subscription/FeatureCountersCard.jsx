"use client";

import React from "react";
import { Activity, TrendingUp } from "lucide-react";
import Tooltip from "@/components/ui/Tooltip";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function FeatureCountersCard({ featureCounters, plan }) {
  const { t } = useLanguage();

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
    if (limit === -1) return t('subscription.features.unlimited');
    return limit;
  };

  // Trier les features : illimitées > activées par usage DESC > désactivées, avec tri alphabétique en cas d'égalité
  const sortedFeatures = React.useMemo(() => {
    return [...plan.featureLimits].sort((a, b) => {
      const usageA = getUsageForFeature(a.featureName);
      const usageB = getUsageForFeature(b.featureName);
      const isEnabledA = a.isEnabled ?? true;
      const isEnabledB = b.isEnabled ?? true;

      // Groupe 1: Features illimitées en premier
      if (a.usageLimit === -1 && b.usageLimit !== -1) return -1;
      if (a.usageLimit !== -1 && b.usageLimit === -1) return 1;

      // Groupe 2: Features désactivées à la fin
      if (isEnabledA && !isEnabledB) return -1;
      if (!isEnabledA && isEnabledB) return 1;

      // Groupe 3: Tri par usage décroissant (plus utilisée en premier)
      if (usageA !== usageB) return usageB - usageA;

      // Groupe 4: Tri alphabétique en cas d'égalité
      return a.featureName.localeCompare(b.featureName);
    });
  }, [plan.featureLimits, featureCounters]);

  return (
    <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-4 shadow-lg h-full">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="text-white" size={20} />
        <h2 className="text-lg font-semibold text-white">{t('subscription.features.title')}</h2>
        <Tooltip content={t('subscription.features.resetInfo')} position="right" />
      </div>

      <div className="space-y-3">
        {sortedFeatures.map((featureLimit) => {
          const usage = getUsageForFeature(featureLimit.featureName);
          const limit = featureLimit.usageLimit;
          const percentage = limit === -1 ? 0 : Math.min((usage / limit) * 100, 100);
          const progressColor = getProgressColor(usage, limit);
          const featureLabel = t(`subscription.features.labels.${featureLimit.featureName}`,
            featureLimit.featureName
              .split('_')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')
          );

          const isEnabled = featureLimit.isEnabled ?? true;

          // Afficher les features désactivées sans barres
          if (!isEnabled) {
            return (
              <div key={featureLimit.featureName} className="flex items-center justify-between opacity-50">
                <span className="text-sm text-white/60">{featureLabel}</span>
                <span className="text-xs px-2 py-0.5 bg-white/10 rounded-sm text-white/40">
                  {t('subscription.features.disabled')}
                </span>
              </div>
            );
          }

          return (
            <div key={featureLimit.featureName}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm text-white font-medium">{featureLabel}</span>
                  {limit === -1 && (
                    <Tooltip content={t('subscription.features.unlimitedTooltip')} position="right" />
                  )}
                </div>
                <div className="text-xs text-white/60">
                  {usage} / {formatLimit(limit)}
                </div>
              </div>

              {/* Ne pas afficher la barre de progression si illimité */}
              {limit !== -1 && (
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${progressColor} transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              )}

              {/* Messages de quota (if/else if pour éviter les doublons) */}
              {limit !== -1 && usage >= limit ? (
                <div className="flex items-center gap-1 text-xs text-red-300 mt-1">
                  <span>🚫 {t('subscription.features.limitReached')}</span>
                </div>
              ) : limit !== -1 && percentage >= 90 ? (
                <div className="flex items-center gap-1 text-xs text-orange-300 mt-1">
                  <span>⚠️ {t('subscription.features.limitAlmost', { percentage: Math.round(percentage) })}</span>
                  <Tooltip content={t('subscription.features.limitAlmostTooltip')} position="right" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-start gap-2">
          <TrendingUp className="text-blue-300 flex-shrink-0 mt-0.5" size={18} />
          <div className="text-xs text-blue-200">
            <div className="font-medium mb-1">💎 {t('subscription.features.needMore')}</div>
            <div>{t('subscription.features.needMoreInfo')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
