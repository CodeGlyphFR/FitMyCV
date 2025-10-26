"use client";

import React from "react";
import { Check, Crown, Zap, Target, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import Modal from "@/components/ui/Modal";
import {
  isFreePlan,
  getPlanTier,
  getPlanColorClass,
  isPopularPlan,
  getYearlyDiscount
} from "@/lib/subscription/planUtils";
import { SkeletonPlanCard } from "@/components/ui/SkeletonLoader";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { translatePlanName } from "@/lib/subscription/planTranslations";

export default function PlanComparisonCards({ currentPlan, subscription, onUpgradeSuccess }) {
  const { t, language } = useLanguage();
  const [plans, setPlans] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [processingPlanId, setProcessingPlanId] = React.useState(null);
  const [showDowngradeModal, setShowDowngradeModal] = React.useState(false);
  const [isDowngrading, setIsDowngrading] = React.useState(false);
  const [downgradePlanId, setDowngradePlanId] = React.useState(null);
  const [expandedPlan, setExpandedPlan] = React.useState(null);

  // Charger les plans disponibles
  React.useEffect(() => {
    async function fetchPlans() {
      try {
        const res = await fetch('/api/subscription/plans');
        if (res.ok) {
          const data = await res.json();
          setPlans(data.plans || []);
        }
      } catch (error) {
        console.error('Error fetching plans:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, []);

  const getFeatureLabel = (featureName) => {
    return t(`subscription.features.labels.${featureName}`,
      featureName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    );
  };

  const handlePlanChange = async (planId, billingPeriod) => {
    try {
      // Trouver le plan sélectionné pour vérifier s'il est gratuit
      const selectedPlan = plans.find(p => p.id === planId);

      // Si c'est un downgrade vers Gratuit, ouvrir le modal de confirmation
      if (selectedPlan && isFreePlan(selectedPlan)) {
        setDowngradePlanId(planId);
        setShowDowngradeModal(true);
        return;
      }

      setProcessingPlanId(planId);

      // Sinon, upgrade via Stripe Checkout
      const res = await fetch('/api/checkout/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingPeriod }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || t('subscription.comparison.errors.checkoutError'));
        setProcessingPlanId(null);
        return;
      }

      const { url, updated } = await res.json();

      // Si l'abonnement a été mis à jour directement (pas de checkout Stripe)
      // La DB est déjà mise à jour, pas besoin d'attendre

      // Rediriger vers la page appropriée (Stripe Checkout OU page de succès)
      window.location.href = url;
    } catch (error) {
      console.error('Error changing plan:', error);
      alert(t('subscription.comparison.errors.changePlanError'));
      setProcessingPlanId(null);
    }
  };

  const handleConfirmDowngrade = async () => {
    setIsDowngrading(true);
    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ immediate: false }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('subscription.comparison.errors.cancelError'));
      }

      setShowDowngradeModal(false);

      // Rafraîchir la page pour afficher les nouvelles données
      window.location.reload();
    } catch (error) {
      console.error('Erreur downgrade:', error);
      alert(error.message);
    } finally {
      setIsDowngrading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-white mb-4 drop-shadow-lg">
          {t('subscription.comparison.title')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SkeletonPlanCard />
          <SkeletonPlanCard />
          <SkeletonPlanCard />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-3 drop-shadow-lg">
        {t('subscription.comparison.title')}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          // Utiliser les fonctions utilitaires
          const planTier = getPlanTier(plan);
          const currentTier = getPlanTier(currentPlan);
          const colorClass = getPlanColorClass(plan);
          const isFreeplan = isFreePlan(plan);

          // Déterminer l'icône en fonction du tier
          const Icon = planTier === 2 ? Crown : planTier === 1 ? Zap : Target;

          const isCurrentPlan = currentPlan?.id === plan.id;
          const isDowngrade = currentTier > planTier;
          const isUpgrade = currentTier < planTier;

          // Bloquer le downgrade vers Gratuit si l'annulation est déjà programmée
          const isDowngradeToFree = isFreeplan && isDowngrade;
          const isAlreadyCanceled = subscription?.cancelAtPeriodEnd;
          const shouldBlockDowngrade = isDowngradeToFree && isAlreadyCanceled;

          return (
            <div
              key={plan.id}
              className={`
                backdrop-blur-md bg-gradient-to-br ${colorClass}
                border rounded-xl p-4 shadow-lg transition-all relative
                ${isCurrentPlan ? 'ring-2 ring-white/50' : ''}
                ${isPopularPlan(plan) && !isCurrentPlan ? 'ring-2 ring-yellow-500/50 shadow-xl shadow-yellow-500/10 md:scale-105' : ''}
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
                  <div>
                    <div className="text-3xl font-bold text-white">{plan.priceMonthly}€</div>
                    <div className="text-xs text-white/60 mt-0.5">{t('subscription.comparison.pricing.perMonth')}</div>
                    {plan.priceYearly && getYearlyDiscount(plan) > 0 && (
                      <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/40 rounded-full">
                        <span className="text-green-300 text-xs font-semibold">
                          {t('subscription.comparison.pricing.saveYearly', { percent: getYearlyDiscount(plan) })}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="space-y-2 mb-4">
                {(() => {
                  const isExpanded = expandedPlan === plan.id;
                  const includedFeatures = plan.featureLimits?.filter(f => f.usageLimit !== 0) || [];
                  const excludedFeatures = plan.featureLimits?.filter(f => f.usageLimit === 0) || [];
                  const visibleIncludedFeatures = isExpanded ? includedFeatures : includedFeatures.slice(0, 4);

                  return (
                    <>
                      {/* Features incluses */}
                      {visibleIncludedFeatures.map((feature, idx) => {
                        const featureLabel = getFeatureLabel(feature.featureName);

                        return (
                          <div key={idx} className="flex items-start text-xs text-white">
                            <span>
                              {featureLabel}
                              {feature.usageLimit === -1
                                ? ` ${t('subscription.comparison.features.unlimited')}`
                                : ` x${feature.usageLimit}`}
                            </span>
                          </div>
                        );
                      })}

                      {/* Bouton voir plus/moins */}
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

                      {/* Features non accessibles */}
                      {excludedFeatures.length > 0 && (
                        <>
                          <div className="text-xs text-white/60 font-medium mt-2">
                            {t('subscription.comparison.features.notAccessible')}
                          </div>
                          {excludedFeatures.map((feature, idx) => {
                            const featureLabel = getFeatureLabel(feature.featureName);

                            return (
                              <div key={`excluded-${idx}`} className="text-xs text-white/60">
                                - {featureLabel}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </>
                  );
                })()}
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
              ) : (
                <div className="space-y-1.5">
                  <button
                    onClick={() => handlePlanChange(plan.id, 'monthly')}
                    disabled={processingPlanId === plan.id}
                    className={`
                      w-full py-2 px-3 rounded-lg text-xs font-medium transition-colors
                      disabled:opacity-50 disabled:cursor-not-allowed
                      flex items-center justify-center gap-1.5
                      ${isUpgrade
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/20'
                        : isDowngrade
                          ? 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-lg shadow-orange-500/20'
                          : 'bg-white hover:bg-white/90 text-gray-900'
                      }
                    `}
                  >
                    {processingPlanId === plan.id ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        {isFreeplan ? t('subscription.comparison.buttons.scheduling') : t('subscription.comparison.buttons.redirecting')}
                      </>
                    ) : (
                      <>
                        {isUpgrade && <TrendingUp size={14} />}
                        {isDowngrade && <TrendingDown size={14} />}
                        {isUpgrade
                          ? t('subscription.comparison.buttons.upgradeTo', { planName: translatePlanName(plan.name, language) })
                          : isDowngrade
                            ? t('subscription.comparison.buttons.downgradeTo', { planName: translatePlanName(plan.name, language) })
                            : `${translatePlanName(plan.name, language)} ${!isFreeplan ? t('subscription.comparison.buttons.monthly') : ''}`}
                      </>
                    )}
                  </button>
                  {plan.priceYearly && (
                    <button
                      onClick={() => handlePlanChange(plan.id, 'yearly')}
                      disabled={processingPlanId === plan.id}
                      className="w-full py-1.5 px-3 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      <span>{t('subscription.comparison.buttons.orYearly')}</span>
                      {getYearlyDiscount(plan) > 0 && (
                        <span className="inline-flex items-center px-1 py-0.5 bg-green-500/30 rounded text-green-200 text-xs font-semibold">
                          -{getYearlyDiscount(plan)}%
                        </span>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-xs text-white/60 text-center">
        {t('subscription.comparison.securePayment')}
      </div>

      {/* Modal de confirmation de downgrade vers Gratuit */}
      <Modal
        open={showDowngradeModal}
        onClose={() => setShowDowngradeModal(false)}
        title={t('subscription.comparison.downgradeModal.title')}
      >
        <div className="space-y-4">
          <p className="text-white/90">
            {t('subscription.comparison.downgradeModal.description')}
          </p>
          <ul className="space-y-2 text-white/80">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span dangerouslySetInnerHTML={{
                __html: t('subscription.comparison.downgradeModal.keepAccessUntil', {
                  date: new Date(subscription?.currentPeriodEnd).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                })
              }} />
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span dangerouslySetInnerHTML={{
                __html: t('subscription.comparison.downgradeModal.switchToFree')
              }} />
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>{t('subscription.comparison.downgradeModal.canUpgrade')}</span>
            </li>
          </ul>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowDowngradeModal(false)}
              disabled={isDowngrading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors disabled:opacity-50 font-medium"
            >
              {t('subscription.comparison.downgradeModal.cancel')}
            </button>
            <button
              onClick={handleConfirmDowngrade}
              disabled={isDowngrading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors disabled:opacity-50 font-medium"
            >
              {isDowngrading ? t('subscription.comparison.downgradeModal.scheduling') : t('subscription.comparison.downgradeModal.confirm')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
