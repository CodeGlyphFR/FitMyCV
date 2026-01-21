"use client";

import React from "react";
import { Check, Crown, Zap, Target, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import {
  isFreePlan,
  getPlanTier,
  getPlanColorClass,
  isPopularPlan,
  getYearlyDiscount
} from "@/lib/subscription/planUtils";
import { translatePlanName } from "@/lib/subscription/planTranslations";

/**
 * Helper pour déterminer les couleurs des boutons selon période et type d'action
 */
function getButtonStyles(billingPeriod, isUpgrade, isDowngrade, isFreeplan) {
  const isMensuel = billingPeriod === 'monthly';

  if (isUpgrade) {
    return isMensuel
      ? 'bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/20'
      : 'bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white shadow-lg shadow-purple-500/20';
  }

  if (isDowngrade) {
    return isMensuel
      ? 'bg-gradient-to-r from-blue-400 to-indigo-500 hover:from-blue-500 hover:to-indigo-600 text-white shadow-lg shadow-blue-400/20'
      : 'bg-gradient-to-r from-purple-400 to-pink-500 hover:from-purple-500 hover:to-pink-600 text-white shadow-lg shadow-purple-400/20';
  }

  if (isFreeplan) return 'bg-white hover:bg-white/90 text-gray-900';

  return isMensuel
    ? 'bg-blue-500 hover:bg-blue-600 text-white'
    : 'bg-purple-500 hover:bg-purple-600 text-white';
}

/**
 * Composant carte d'un plan d'abonnement
 */
export default function PlanCard({
  plan,
  currentPlan,
  subscription,
  scheduledDowngrade,
  highlightPlanId,
  isHighlighting,
  highlightedCardRef,
  processingPlanId,
  expandedPlan,
  setExpandedPlan,
  cancelingDowngrade,
  onPlanChange,
  onCancelDowngrade,
  getFeatureLabel,
  t,
  language
}) {
  const planTier = getPlanTier(plan);
  const currentTier = getPlanTier(currentPlan);
  const colorClass = getPlanColorClass(plan);
  const isFreeplan = isFreePlan(plan);
  const currentBillingPeriod = subscription?.billingPeriod || 'monthly';

  const Icon = planTier === 2 ? Crown : planTier === 1 ? Zap : Target;
  const isCurrentPlan = currentPlan?.id === plan.id;
  const hasActiveStripeSubscription = subscription?.stripeSubscriptionId && subscription?.status === 'active';

  // Calcul upgrade/downgrade pour mensuel et annuel
  const isUpgradeMonthly = hasActiveStripeSubscription && (
    planTier > currentTier ||
    (planTier === currentTier && currentBillingPeriod === 'monthly' && 'monthly' === 'yearly')
  );
  const isUpgradeYearly = hasActiveStripeSubscription && (
    planTier > currentTier ||
    (planTier === currentTier && currentBillingPeriod === 'monthly' && 'yearly' === 'yearly')
  );

  const isDowngradeMonthly = hasActiveStripeSubscription && (
    planTier < currentTier ||
    (planTier === currentTier && currentBillingPeriod === 'yearly' && 'monthly' === 'monthly')
  );
  const isDowngradeYearly = hasActiveStripeSubscription && (
    planTier < currentTier ||
    (planTier === currentTier && currentBillingPeriod === 'yearly' && 'yearly' === 'monthly')
  );

  const isDowngrade = planTier < currentTier;
  const isDowngradeToFree = isFreeplan && isDowngrade;
  const isAlreadyCanceled = subscription?.cancelAtPeriodEnd;
  const shouldBlockDowngrade = isDowngradeToFree && isAlreadyCanceled;

  const isScheduledDowngradePlan = scheduledDowngrade?.targetPlanId === plan.id;
  const scheduledDate = scheduledDowngrade?.effectiveDate ? new Date(scheduledDowngrade.effectiveDate) : null;

  const isExpanded = expandedPlan === plan.id;

  // Features triées
  const includedFeatures = (plan.featureLimits?.filter(f => f.usageLimit !== 0) || [])
    .sort((a, b) => {
      const labelA = getFeatureLabel(a.featureName).replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
      const labelB = getFeatureLabel(b.featureName).replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
      return labelA.localeCompare(labelB, language, { sensitivity: 'base' });
    });

  const excludedFeatures = (plan.featureLimits?.filter(f => f.usageLimit === 0) || [])
    .sort((a, b) => {
      const labelA = getFeatureLabel(a.featureName).replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
      const labelB = getFeatureLabel(b.featureName).replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
      return labelA.localeCompare(labelB, language, { sensitivity: 'base' });
    });

  const visibleIncludedFeatures = isExpanded ? includedFeatures : includedFeatures.slice(0, 4);

  return (
    <div
      ref={plan.id === highlightPlanId ? highlightedCardRef : null}
      className={`
        backdrop-blur-md bg-gradient-to-br ${colorClass}
        border rounded-xl p-4 shadow-lg transition-all relative
        ${isCurrentPlan ? 'ring-2 ring-white/50' : ''}
        ${isPopularPlan(plan) && !isCurrentPlan ? 'ring-2 ring-yellow-500/50 shadow-xl shadow-yellow-500/10 md:scale-105' : ''}
        ${plan.id === highlightPlanId && isHighlighting ? 'ring-2 ring-emerald-400 animate-pulse-glow' : ''}
      `}
    >
      {/* Header */}
      <div className="text-center mb-3">
        <Icon className="mx-auto mb-2 text-white" size={28} />
        <h3 className="text-xl font-bold text-white mb-1.5">{translatePlanName(plan.name, language)}</h3>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {isCurrentPlan && (
            <span className="inline-block px-2 py-0.5 bg-white/20 rounded-full text-xs text-white font-medium">
              {t('subscription.comparison.badges.current')}
            </span>
          )}
          {isPopularPlan(plan) && (
            <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border border-yellow-500/50 rounded-full text-xs text-yellow-200 font-medium">
              {t('subscription.comparison.badges.recommended')}
            </span>
          )}
        </div>
      </div>

      {/* Pricing */}
      <div className="text-center mb-3">
        {isFreeplan ? (
          <div>
            <div className="text-3xl font-bold text-white">{t('subscription.comparison.pricing.free')}</div>
            <div className="text-xs text-white/60 mt-0.5">{t('subscription.comparison.pricing.forever')}</div>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <div className="text-3xl font-bold text-white">{plan.priceMonthly}€</div>
              <div className="text-xs text-white/60">{t('subscription.comparison.pricing.perMonth')}</div>
            </div>

            {(plan.priceYearly > 0) && !isFreeplan && (
              <div className="pt-2 border-t border-white/10">
                <div className="text-xl font-semibold text-white/90">{plan.priceYearly}€</div>
                <div className="text-xs text-white/60">{t('subscription.comparison.pricing.perYear')}</div>
                {getYearlyDiscount(plan) > 0 && (
                  <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/30 border border-green-400/60 rounded-full shadow-lg shadow-green-500/30">
                    <span className="text-white text-xs font-bold drop-shadow-md">
                      -{getYearlyDiscount(plan)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Features */}
      <div className="space-y-2 mb-4">
        {visibleIncludedFeatures.map((feature, idx) => (
          <div key={idx} className="flex items-start text-xs text-white">
            <span>
              {getFeatureLabel(feature.featureName)}
              {feature.usageLimit === -1
                ? ` ${t('subscription.comparison.features.unlimited')}`
                : ` x${feature.usageLimit}`}
            </span>
          </div>
        ))}

        {includedFeatures.length > 4 && (
          <button
            onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
            className="text-xs text-white/80 hover:text-white pl-0 underline cursor-pointer transition-colors"
          >
            {isExpanded
              ? t('subscription.comparison.features.showLess')
              : t('subscription.comparison.features.showMore', { count: includedFeatures.length - 4 })}
          </button>
        )}

        {excludedFeatures.length > 0 && (
          <>
            <div className="text-xs text-white/60 font-medium mt-2">
              {t('subscription.comparison.features.notAccessible')}
            </div>
            {excludedFeatures.map((feature, idx) => (
              <div key={`excluded-${idx}`} className="text-xs text-white/60">
                - {getFeatureLabel(feature.featureName)}
              </div>
            ))}
          </>
        )}
      </div>

      {/* CTA Button */}
      {isCurrentPlan ? (
        <button
          disabled
          className="w-full py-2 px-3 rounded-lg bg-white/10 border border-white/30 text-white text-xs font-medium cursor-not-allowed"
        >
          {t('subscription.comparison.buttons.currentPlan')}
        </button>
      ) : shouldBlockDowngrade ? (
        <button
          disabled
          className="w-full py-2 px-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-300 font-medium cursor-not-allowed text-xs"
        >
          {t('subscription.comparison.buttons.downgradeScheduled')}
        </button>
      ) : isScheduledDowngradePlan ? (
        <div className="space-y-2">
          <div className="w-full py-2.5 px-3 rounded-lg bg-orange-500/20 border border-orange-500/50 text-orange-300 text-xs text-center font-medium">
            {t('subscription.comparison.buttons.downgradeScheduledOn', {
              date: scheduledDate?.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
                day: '2-digit', month: '2-digit', year: 'numeric'
              })
            })}
          </div>
          <button
            onClick={onCancelDowngrade}
            disabled={cancelingDowngrade}
            className="w-full py-2 px-3 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 hover:border-red-500/70 text-red-300 hover:text-red-200 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {cancelingDowngrade ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                <span>{t('subscription.comparison.buttons.cancelingDowngrade')}</span>
              </>
            ) : (
              <span>{t('subscription.comparison.buttons.cancelDowngrade')}</span>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Bouton mensuel */}
          <button
            onClick={() => onPlanChange(plan.id, 'monthly')}
            disabled={processingPlanId === plan.id}
            className={`
              w-full py-2 px-3 rounded-lg text-xs font-medium transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-1.5
              ${getButtonStyles('monthly', isUpgradeMonthly, isDowngradeMonthly, isFreeplan)}
            `}
          >
            {processingPlanId === plan.id ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                <span>{isFreeplan ? t('subscription.comparison.buttons.scheduling') : t('subscription.comparison.buttons.redirecting')}</span>
              </>
            ) : (
              <>
                {isUpgradeMonthly && <TrendingUp size={14} />}
                {isDowngradeMonthly && <TrendingDown size={14} />}
                <span>
                  {isUpgradeMonthly
                    ? `${t('subscription.comparison.buttons.upgrade', 'Upgrade')} - ${t('subscription.comparison.buttons.monthly', 'Mensuel')}`
                    : isDowngradeMonthly
                      ? `${t('subscription.comparison.buttons.downgrade', 'Downgrade')} - ${t('subscription.comparison.buttons.monthly', 'Mensuel')}`
                      : t('subscription.comparison.buttons.monthly', 'Mensuel')}
                </span>
              </>
            )}
          </button>

          {/* Bouton annuel */}
          {(plan.priceYearly > 0) && !isFreeplan && (
            <button
              onClick={() => onPlanChange(plan.id, 'yearly')}
              disabled={processingPlanId === plan.id}
              className={`
                w-full py-2 px-3 rounded-lg text-xs font-medium transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-1.5
                ${getButtonStyles('yearly', isUpgradeYearly, isDowngradeYearly, isFreeplan)}
              `}
            >
              {processingPlanId === plan.id ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  <span>{isFreeplan ? t('subscription.comparison.buttons.scheduling') : t('subscription.comparison.buttons.redirecting')}</span>
                </>
              ) : (
                <>
                  {isUpgradeYearly && <TrendingUp size={14} />}
                  {isDowngradeYearly && <TrendingDown size={14} />}
                  <span>
                    {isUpgradeYearly
                      ? `${t('subscription.comparison.buttons.upgrade', 'Upgrade')} - ${t('subscription.comparison.buttons.yearly', 'Annuel')}`
                      : isDowngradeYearly
                        ? `${t('subscription.comparison.buttons.downgrade', 'Downgrade')} - ${t('subscription.comparison.buttons.yearly', 'Annuel')}`
                        : t('subscription.comparison.buttons.yearly', 'Annuel')}
                  </span>
                  {getYearlyDiscount(plan) > 0 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 bg-green-500/40 border border-green-400/50 rounded-sm text-white text-xs font-bold shadow-xs">
                      -{getYearlyDiscount(plan)}%
                    </span>
                  )}
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
