"use client";

import React from "react";
import { SkeletonPlanCard } from "@/components/ui/SkeletonLoader";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  usePlanComparison,
  PlanCard,
  DowngradePaidModal,
  DowngradeToFreeModal,
  UpgradeModal
} from "./plan-comparison";

export default function PlanComparisonCards({ currentPlan, subscription, scheduledDowngrade, onUpgradeSuccess, highlightPlanId }) {
  const { t, language } = useLanguage();

  const {
    plans,
    loading,
    highlightedCardRef,
    isHighlighting,
    processingPlanId,
    showDowngradeModal,
    setShowDowngradeModal,
    showDowngradeToFreeModal,
    setShowDowngradeToFreeModal,
    isDowngrading,
    downgradePlanId,
    acceptedDowngradeTerms,
    setAcceptedDowngradeTerms,
    showUpgradeModal,
    setShowUpgradeModal,
    upgradePlanId,
    upgradeBillingPeriod,
    upgradePreview,
    loadingPreview,
    acceptedTerms,
    setAcceptedTerms,
    expandedPlan,
    setExpandedPlan,
    cancelingDowngrade,
    handlePlanChange,
    handleConfirmDowngradeToFree,
    handleConfirmDowngrade,
    handleConfirmUpgrade,
    handleCancelDowngrade
  } = usePlanComparison({
    currentPlan,
    subscription,
    scheduledDowngrade,
    onUpgradeSuccess,
    highlightPlanId,
    t,
    language
  });

  const getFeatureLabel = (featureName) => {
    return t(`subscription.features.labels.${featureName}`,
      featureName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    );
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
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            currentPlan={currentPlan}
            subscription={subscription}
            scheduledDowngrade={scheduledDowngrade}
            highlightPlanId={highlightPlanId}
            isHighlighting={isHighlighting}
            highlightedCardRef={highlightedCardRef}
            processingPlanId={processingPlanId}
            expandedPlan={expandedPlan}
            setExpandedPlan={setExpandedPlan}
            cancelingDowngrade={cancelingDowngrade}
            onPlanChange={handlePlanChange}
            onCancelDowngrade={handleCancelDowngrade}
            getFeatureLabel={getFeatureLabel}
            t={t}
            language={language}
          />
        ))}
      </div>

      <div className="mt-4 text-xs text-white/60 text-center">
        {t('subscription.comparison.securePayment')}
      </div>

      {/* Modals */}
      <DowngradePaidModal
        open={showDowngradeModal}
        onClose={() => setShowDowngradeModal(false)}
        plans={plans}
        downgradePlanId={downgradePlanId}
        subscription={subscription}
        isDowngrading={isDowngrading}
        acceptedDowngradeTerms={acceptedDowngradeTerms}
        setAcceptedDowngradeTerms={setAcceptedDowngradeTerms}
        onConfirm={handleConfirmDowngrade}
        t={t}
        language={language}
      />

      <DowngradeToFreeModal
        open={showDowngradeToFreeModal}
        onClose={() => setShowDowngradeToFreeModal(false)}
        plans={plans}
        subscription={subscription}
        scheduledDowngrade={scheduledDowngrade}
        isDowngrading={isDowngrading}
        onConfirm={handleConfirmDowngradeToFree}
        t={t}
        language={language}
      />

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        subscription={subscription}
        upgradeBillingPeriod={upgradeBillingPeriod}
        upgradePreview={upgradePreview}
        loadingPreview={loadingPreview}
        processingPlanId={processingPlanId}
        acceptedTerms={acceptedTerms}
        setAcceptedTerms={setAcceptedTerms}
        onConfirm={handleConfirmUpgrade}
        t={t}
        language={language}
      />
    </div>
  );
}
