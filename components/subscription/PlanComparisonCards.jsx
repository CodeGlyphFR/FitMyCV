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
  const [showDowngradeToFreeModal, setShowDowngradeToFreeModal] = React.useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);
  const [isDowngrading, setIsDowngrading] = React.useState(false);
  const [downgradePlanId, setDowngradePlanId] = React.useState(null);
  const [downgradeBillingPeriod, setDowngradeBillingPeriod] = React.useState(null);
  const [upgradePlanId, setUpgradePlanId] = React.useState(null);
  const [upgradeBillingPeriod, setUpgradeBillingPeriod] = React.useState(null);
  const [upgradePreview, setUpgradePreview] = React.useState(null);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const [acceptedDowngradeTerms, setAcceptedDowngradeTerms] = React.useState(false);
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

  // Helper pour déterminer les couleurs des boutons selon période et type d'action
  const getButtonStyles = (billingPeriod, isUpgrade, isDowngrade, isFreeplan) => {
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

    // Création (ni upgrade ni downgrade)
    if (isFreeplan) return 'bg-white hover:bg-white/90 text-gray-900';

    return isMensuel
      ? 'bg-blue-500 hover:bg-blue-600 text-white'
      : 'bg-purple-500 hover:bg-purple-600 text-white';
  };

  const handlePlanChange = async (planId, billingPeriod) => {
    try {
      // Trouver le plan sélectionné
      const selectedPlan = plans.find(p => p.id === planId);

      if (!selectedPlan) {
        console.error('Plan introuvable');
        return;
      }

      // Si c'est un downgrade vers Gratuit, ouvrir le modal de confirmation
      if (isFreePlan(selectedPlan)) {
        setDowngradePlanId(planId);
        setShowDowngradeToFreeModal(true);
        return;
      }

      // Vérifier si c'est un upgrade ou un downgrade
      const selectedTier = getPlanTier(selectedPlan);
      const currentTier = getPlanTier(currentPlan);
      const currentBillingPeriod = subscription?.billingPeriod || 'monthly';

      // Un upgrade/downgrade est uniquement possible si l'utilisateur a déjà un abonnement Stripe actif
      // Sinon, c'est une création d'abonnement (nouvel utilisateur ou plan Gratuit)
      const hasActiveStripeSubscription = subscription?.stripeSubscriptionId && subscription?.status === 'active';

      // UPGRADE si : tier supérieur (peu importe période) OU (même tier ET mensuel → annuel)
      const isUpgrade = hasActiveStripeSubscription && (
        selectedTier > currentTier ||
        (selectedTier === currentTier && currentBillingPeriod === 'monthly' && billingPeriod === 'yearly')
      );

      // DOWNGRADE si : tier inférieur (peu importe période) OU (même tier ET annuel → mensuel)
      const isDowngrade = hasActiveStripeSubscription && (
        selectedTier < currentTier ||
        (selectedTier === currentTier && currentBillingPeriod === 'yearly' && billingPeriod === 'monthly')
      );

      // Si c'est un upgrade (modification d'abonnement existant), calculer le prorata et afficher le modal
      if (isUpgrade) {
        setUpgradePlanId(planId);
        setUpgradeBillingPeriod(billingPeriod);
        setLoadingPreview(true);
        setAcceptedTerms(false); // Reset checkbox
        setShowUpgradeModal(true);

        try {
          // Appeler l'API pour calculer le prorata
          const previewRes = await fetch('/api/subscription/preview-upgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId, billingPeriod }),
          });

          if (previewRes.ok) {
            const previewData = await previewRes.json();
            setUpgradePreview(previewData);
          } else {
            const error = await previewRes.json();
            alert(error.error || t('subscription.comparison.errors.previewError', 'Erreur lors du calcul du prorata'));
            setShowUpgradeModal(false);
          }
        } catch (error) {
          console.error('Error fetching upgrade preview:', error);
          alert(t('subscription.comparison.errors.previewError', 'Erreur lors du calcul du prorata'));
          setShowUpgradeModal(false);
        } finally {
          setLoadingPreview(false);
        }
        return;
      }

      // Si c'est un downgrade (modification d'abonnement existant), afficher le modal de downgrade
      if (isDowngrade) {
        setDowngradePlanId(planId);
        setDowngradeBillingPeriod(billingPeriod);
        setAcceptedDowngradeTerms(false); // Reset checkbox
        setShowDowngradeModal(true);
        return;
      }

      // Sinon, procéder directement (nouvel abonnement)
      setProcessingPlanId(planId);

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

      const { url } = await res.json();

      // Rediriger vers la page appropriée
      window.location.href = url;
    } catch (error) {
      console.error('Error changing plan:', error);
      alert(t('subscription.comparison.errors.changePlanError'));
      setProcessingPlanId(null);
    }
  };

  const handleConfirmDowngradeToFree = async () => {
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

      setShowDowngradeToFreeModal(false);

      // Rafraîchir la page pour afficher les nouvelles données
      window.location.reload();
    } catch (error) {
      console.error('Erreur downgrade:', error);
      alert(error.message);
    } finally {
      setIsDowngrading(false);
    }
  };

  const handleConfirmDowngrade = async () => {
    // Vérifier que les CGV sont acceptées
    if (!acceptedDowngradeTerms) {
      alert(t('subscription.comparison.downgradeModal.termsRequired', 'Vous devez accepter les CGV'));
      return;
    }

    setIsDowngrading(true);
    setShowDowngradeModal(false);

    try {
      // Appeler l'API backend pour modifier l'abonnement avec flag isDowngrade
      const res = await fetch('/api/checkout/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: downgradePlanId,
          billingPeriod: downgradeBillingPeriod,
          isDowngrade: true
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || t('subscription.comparison.errors.checkoutError'));
        setIsDowngrading(false);
        return;
      }

      const data = await res.json();

      // Downgrade programmé avec succès
      if (data.success || data.scheduled) {
        // Recharger les données
        if (onUpgradeSuccess) {
          onUpgradeSuccess();
        }
      } else {
        alert(t('subscription.comparison.errors.changePlanError'));
        setIsDowngrading(false);
      }
    } catch (error) {
      console.error('Error downgrading:', error);
      alert(t('subscription.comparison.errors.changePlanError'));
      setIsDowngrading(false);
    }
  };

  const handleConfirmUpgrade = async () => {
    // Vérifier que les CGV sont acceptées
    if (!acceptedTerms) {
      alert(t('subscription.comparison.upgradeModal.termsRequired', 'Vous devez accepter les CGV'));
      return;
    }

    setProcessingPlanId(upgradePlanId);
    setShowUpgradeModal(false);

    try {
      // Appeler l'API backend pour modifier l'abonnement (pas de Checkout)
      const res = await fetch('/api/checkout/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: upgradePlanId, billingPeriod: upgradeBillingPeriod }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || t('subscription.comparison.errors.checkoutError'));
        setProcessingPlanId(null);
        return;
      }

      const data = await res.json();

      // Upgrade réussi
      if (data.success || data.upgraded) {
        // Recharger les données
        if (onUpgradeSuccess) {
          onUpgradeSuccess();
        }
        // Pas de redirection, l'upgrade est fait immédiatement
      } else {
        alert(t('subscription.comparison.errors.changePlanError'));
        setProcessingPlanId(null);
      }
    } catch (error) {
      console.error('Error upgrading:', error);
      alert(t('subscription.comparison.errors.changePlanError'));
      setProcessingPlanId(null);
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
          const currentBillingPeriod = subscription?.billingPeriod || 'monthly';

          // Déterminer l'icône en fonction du tier
          const Icon = planTier === 2 ? Crown : planTier === 1 ? Zap : Target;

          const isCurrentPlan = currentPlan?.id === plan.id;

          // Vérifier si l'utilisateur a un abonnement Stripe actif
          const hasActiveStripeSubscription = subscription?.stripeSubscriptionId && subscription?.status === 'active';

          // Calculer isUpgrade/isDowngrade séparément pour mensuel et annuel
          // UPGRADE si : tier supérieur (peu importe période) OU (même tier ET mensuel → annuel)
          const isUpgradeMonthly = hasActiveStripeSubscription && (
            planTier > currentTier ||
            (planTier === currentTier && currentBillingPeriod === 'monthly' && 'monthly' === 'yearly')
          );
          const isUpgradeYearly = hasActiveStripeSubscription && (
            planTier > currentTier ||
            (planTier === currentTier && currentBillingPeriod === 'monthly' && 'yearly' === 'yearly')
          );

          // DOWNGRADE si : tier inférieur (peu importe période) OU (même tier ET annuel → mensuel)
          const isDowngradeMonthly = hasActiveStripeSubscription && (
            planTier < currentTier ||
            (planTier === currentTier && currentBillingPeriod === 'yearly' && 'monthly' === 'monthly')
          );
          const isDowngradeYearly = hasActiveStripeSubscription && (
            planTier < currentTier ||
            (planTier === currentTier && currentBillingPeriod === 'yearly' && 'yearly' === 'monthly')
          );

          // Pour compatibilité avec code existant (bloquer downgrade vers Gratuit)
          const isDowngrade = planTier < currentTier;

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
                  <div className="space-y-2">
                    {/* Prix mensuel */}
                    <div>
                      <div className="text-3xl font-bold text-white">{plan.priceMonthly}€</div>
                      <div className="text-xs text-white/60">{t('subscription.comparison.pricing.perMonth')}</div>
                    </div>

                    {/* Prix annuel (si existe) */}
                    {plan.priceYearly && (
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
                {(() => {
                  const isExpanded = expandedPlan === plan.id;

                  // Trier les features par ordre alphabétique (sans émojis)
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
                  {/* Bouton mensuel */}
                  <button
                    onClick={() => handlePlanChange(plan.id, 'monthly')}
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
                  {plan.priceYearly && (
                    <button
                      onClick={() => handlePlanChange(plan.id, 'yearly')}
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
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-green-500/40 border border-green-400/50 rounded text-white text-xs font-bold shadow-sm">
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
        })}
      </div>

      <div className="mt-4 text-xs text-white/60 text-center">
        {t('subscription.comparison.securePayment')}
      </div>

      {/* Modal de confirmation de downgrade entre plans payants */}
      <Modal
        open={showDowngradeModal}
        onClose={() => setShowDowngradeModal(false)}
        title={t('subscription.comparison.downgradePaidModal.title', 'Confirmer le downgrade')}
      >
        <div className="space-y-4">
          {(() => {
            const selectedPlan = plans.find(p => p.id === downgradePlanId);
            if (!selectedPlan) return null;

            return (
              <>
                {/* Informations sur le changement */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <p className="text-white/90 mb-2">
                    {t('subscription.comparison.downgradePaidModal.description',
                      'Votre abonnement sera modifié à la fin de votre période en cours.')}
                  </p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                    <span className="text-white/70">{t('subscription.comparison.downgradePaidModal.effectiveDate', 'Date d\'effet')}</span>
                    <span className="font-semibold text-emerald-400">
                      {new Date(subscription?.currentPeriodEnd).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>

                {/* Détails */}
                <ul className="space-y-2 text-white/80">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>
                      Vous conservez votre plan actuel jusqu'au <strong className="text-white">{new Date(subscription?.currentPeriodEnd).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>{t('subscription.comparison.downgradePaidModal.noRefund',
                      'Aucun remboursement ne sera effectué')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>{t('subscription.comparison.downgradePaidModal.newInvoice',
                      'Une nouvelle facture sera émise à la date d\'effet')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>
                      Vous pouvez annuler ce changement jusqu'au <strong className="text-white">{new Date(subscription?.currentPeriodEnd).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}</strong>
                    </span>
                  </li>
                </ul>

                {/* Checkbox CGV */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={acceptedDowngradeTerms}
                      onChange={(e) => setAcceptedDowngradeTerms(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded-sm border-2 border-white/30 bg-white/5 appearance-none cursor-pointer transition-all checked:bg-gradient-to-br checked:from-emerald-500/40 checked:to-emerald-600/40 checked:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-0 relative checked:after:content-['✓'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-white checked:after:text-xs checked:after:font-bold"
                    />
                    <span className="text-sm text-white/80 group-hover:text-white transition-colors">
                      {t('subscription.comparison.downgradePaidModal.termsLabel', 'J\'accepte les')}{' '}
                      <a
                        href="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t('subscription.comparison.downgradePaidModal.termsLink', 'Conditions Générales de Vente')}
                      </a>
                    </span>
                  </label>
                </div>

                {/* Boutons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowDowngradeModal(false)}
                    disabled={isDowngrading}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors disabled:opacity-50 font-medium"
                  >
                    {t('subscription.comparison.downgradePaidModal.cancel', 'Annuler')}
                  </button>
                  <button
                    onClick={handleConfirmDowngrade}
                    disabled={isDowngrading || !acceptedDowngradeTerms}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white transition-colors disabled:opacity-50 font-medium shadow-lg shadow-emerald-500/20"
                  >
                    {isDowngrading ? t('subscription.comparison.downgradePaidModal.scheduling', 'Programmation...') : t('subscription.comparison.downgradePaidModal.confirm', 'Confirmer')}
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      </Modal>

      {/* Modal de confirmation de downgrade vers Gratuit */}
      <Modal
        open={showDowngradeToFreeModal}
        onClose={() => setShowDowngradeToFreeModal(false)}
        title={t('subscription.comparison.downgradeToFreeModal.title', 'Passer au plan Gratuit')}
      >
        <div className="space-y-4">
          <p className="text-white/90">
            {t('subscription.comparison.downgradeToFreeModal.description', 'Vous êtes sur le point d\'annuler votre abonnement.')}
          </p>
          <ul className="space-y-2 text-white/80">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span dangerouslySetInnerHTML={{
                __html: t('subscription.comparison.downgradeToFreeModal.keepAccessUntil', {
                  date: new Date(subscription?.currentPeriodEnd).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })
                })
              }} />
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span dangerouslySetInnerHTML={{
                __html: t('subscription.comparison.downgradeToFreeModal.switchToFree', 'Vous passerez au plan <strong>Gratuit</strong> après cette date')
              }} />
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>{t('subscription.comparison.downgradeToFreeModal.canUpgrade', 'Vous pourrez upgrader à nouveau à tout moment')}</span>
            </li>
          </ul>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowDowngradeToFreeModal(false)}
              disabled={isDowngrading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors disabled:opacity-50 font-medium"
            >
              {t('subscription.comparison.downgradeToFreeModal.cancel', 'Annuler')}
            </button>
            <button
              onClick={handleConfirmDowngradeToFree}
              disabled={isDowngrading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white transition-colors disabled:opacity-50 font-medium shadow-lg shadow-emerald-500/20"
            >
              {isDowngrading ? t('subscription.comparison.downgradeToFreeModal.scheduling', 'Programmation...') : t('subscription.comparison.downgradeToFreeModal.confirm', 'Confirmer')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmation d'upgrade */}
      <Modal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title={t('subscription.comparison.upgradeModal.title', 'Confirmer l\'upgrade')}
      >
        <div className="space-y-4">
          {loadingPreview ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="ml-2 text-white/80">{t('subscription.comparison.upgradeModal.calculatingProrata', 'Calcul du prorata...')}</span>
            </div>
          ) : upgradePreview ? (
            <>
              {/* Montant du prorata avec détail du solde créditeur */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
                {/* Si customer balance existe, afficher le détail */}
                {upgradePreview.customerBalance && upgradePreview.customerBalance < 0 ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/70">Montant du prorata</span>
                      <span className="text-white">
                        {upgradePreview.prorataAmountBeforeBalance.toFixed(2)} {upgradePreview.currency}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-emerald-400">Solde créditeur</span>
                      <span className="text-emerald-400">
                        {upgradePreview.customerBalance.toFixed(2)} {upgradePreview.currency}
                      </span>
                    </div>
                    <div className="border-t border-white/10 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-white/70 font-medium">{t('subscription.comparison.upgradeModal.prorataAmount', 'Montant à payer')}</span>
                        <span className="text-2xl font-bold text-emerald-400">
                          {upgradePreview.prorataAmount.toFixed(2)} {upgradePreview.currency}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-white/70">{t('subscription.comparison.upgradeModal.prorataAmount', 'Montant à payer')}</span>
                      <span className="text-2xl font-bold text-emerald-400">
                        {upgradePreview.prorataAmount.toFixed(2)} {upgradePreview.currency}
                      </span>
                    </div>
                  </>
                )}
                <p className="text-sm text-white/50">
                  {t('subscription.comparison.upgradeModal.prorataInfo', 'Montant calculé pour la période restante (prorata automatique)')}
                </p>
              </div>

              {/* Informations */}
              <ul className="space-y-2 text-white/80">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">•</span>
                  <span>{t('subscription.comparison.upgradeModal.immediate', 'Votre nouveau plan sera activé immédiatement')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">•</span>
                  <span>{t('subscription.comparison.upgradeModal.invoiceInfo', 'La facture sera disponible dans l\'onglet Historique')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">•</span>
                  <span>{t('subscription.comparison.upgradeModal.secure', 'Paiement 100% sécurisé via Stripe')}</span>
                </li>
              </ul>

              {/* Avertissement engagement annuel (si mensuel → annuel) */}
              {subscription?.billingPeriod === 'monthly' && upgradeBillingPeriod === 'yearly' && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                  <p className="text-sm text-orange-300 flex items-start gap-2">
                    <span>⚠️</span>
                    <span>{t('subscription.comparison.upgradeModal.yearlyWarning', 'Une fois passé en facturation annuelle, vous ne pourrez plus revenir au paiement mensuel')}</span>
                  </p>
                </div>
              )}

              {/* Avertissement maintien annuel (si annuel → annuel) */}
              {subscription?.billingPeriod === 'yearly' && upgradeBillingPeriod === 'yearly' && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-sm text-blue-300 flex items-start gap-2">
                    <span>ℹ️</span>
                    <span dangerouslySetInnerHTML={{
                      __html: t('subscription.comparison.upgradeModal.stayYearly', {
                        date: new Date(subscription?.currentPeriodEnd).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })
                      })
                    }} />
                  </p>
                </div>
              )}

              {/* Crédit appliqué (si upgrade tier avec annuel → mensuel) */}
              {subscription?.billingPeriod === 'yearly' && upgradeBillingPeriod === 'monthly' && upgradePreview?.monthsOffered > 0 && (() => {
                const nextBillingDate = new Date();
                nextBillingDate.setMonth(nextBillingDate.getMonth() + upgradePreview.monthsOffered);
                const formattedDate = nextBillingDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                });

                return (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 space-y-1">
                    <p className="text-sm text-emerald-300 flex items-start gap-2">
                      <span>✨</span>
                      <span>
                        {t('subscription.comparison.upgradeModal.creditApplied', {
                          months: upgradePreview.monthsOffered
                        })}
                      </span>
                    </p>
                    <p className="text-sm text-emerald-300/80 ml-6">
                      {language === 'fr' ? `Prochaine facturation : ${formattedDate}` : `Next billing date: ${formattedDate}`}
                    </p>
                  </div>
                );
              })()}

              {/* Checkbox CGV */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded-sm border-2 border-white/30 bg-white/5 appearance-none cursor-pointer transition-all checked:bg-gradient-to-br checked:from-emerald-500/40 checked:to-emerald-600/40 checked:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-0 relative checked:after:content-['✓'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-white checked:after:text-xs checked:after:font-bold"
                  />
                  <span className="text-sm text-white/80 group-hover:text-white transition-colors">
                    {t('subscription.comparison.upgradeModal.termsLabel', 'J\'accepte les')}{' '}
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t('subscription.comparison.upgradeModal.termsLink', 'Conditions Générales de Vente')}
                    </a>
                  </span>
                </label>
              </div>

              {/* Boutons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  disabled={processingPlanId !== null}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors disabled:opacity-50 font-medium"
                >
                  {t('subscription.comparison.upgradeModal.cancel', 'Annuler')}
                </button>
                <button
                  onClick={handleConfirmUpgrade}
                  disabled={processingPlanId !== null || !acceptedTerms}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white transition-colors disabled:opacity-50 font-medium shadow-lg shadow-green-500/20"
                >
                  {processingPlanId !== null ? t('subscription.comparison.upgradeModal.processing', 'Traitement...') : t('subscription.comparison.upgradeModal.confirm', 'Confirmer')}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
