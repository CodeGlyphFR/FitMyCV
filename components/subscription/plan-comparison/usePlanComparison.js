import { useState, useEffect, useRef, useCallback } from 'react';
import { isFreePlan, getPlanTier } from '@/lib/subscription/planUtils';

/**
 * Hook pour gérer la logique de comparaison et changement de plans
 */
export function usePlanComparison({ currentPlan, subscription, scheduledDowngrade, onUpgradeSuccess, highlightPlanId, t, language }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Refs et state pour l'animation de mise en avant
  const highlightedCardRef = useRef(null);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [processingPlanId, setProcessingPlanId] = useState(null);

  // États des modals
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [showDowngradeToFreeModal, setShowDowngradeToFreeModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // États downgrade
  const [isDowngrading, setIsDowngrading] = useState(false);
  const [downgradePlanId, setDowngradePlanId] = useState(null);
  const [downgradeBillingPeriod, setDowngradeBillingPeriod] = useState(null);
  const [acceptedDowngradeTerms, setAcceptedDowngradeTerms] = useState(false);

  // États upgrade
  const [upgradePlanId, setUpgradePlanId] = useState(null);
  const [upgradeBillingPeriod, setUpgradeBillingPeriod] = useState(null);
  const [upgradePreview, setUpgradePreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Autres états
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [cancelingDowngrade, setCancelingDowngrade] = useState(false);

  // Charger les plans disponibles
  useEffect(() => {
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

  // Scroll vers le plan mis en avant et déclencher l'animation pulse glow
  useEffect(() => {
    if (highlightPlanId && !loading && plans.length > 0) {
      const timeoutId = setTimeout(() => {
        if (highlightedCardRef.current) {
          highlightedCardRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
          setTimeout(() => {
            setIsHighlighting(true);
          }, 500);
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [highlightPlanId, loading, plans.length]);

  const handlePlanChange = useCallback(async (planId, billingPeriod) => {
    try {
      const selectedPlan = plans.find(p => p.id === planId);

      if (!selectedPlan) {
        console.error('Plan introuvable');
        return;
      }

      // Si c'est un downgrade vers Gratuit
      if (isFreePlan(selectedPlan)) {
        setDowngradePlanId(planId);
        setShowDowngradeToFreeModal(true);
        return;
      }

      const selectedTier = getPlanTier(selectedPlan);
      const currentTier = getPlanTier(currentPlan);
      const currentBillingPeriod = subscription?.billingPeriod || 'monthly';
      const hasActiveStripeSubscription = subscription?.stripeSubscriptionId && subscription?.status === 'active';

      const isUpgrade = hasActiveStripeSubscription && (
        selectedTier > currentTier ||
        (selectedTier === currentTier && currentBillingPeriod === 'monthly' && billingPeriod === 'yearly')
      );

      const isDowngrade = hasActiveStripeSubscription && (
        selectedTier < currentTier ||
        (selectedTier === currentTier && currentBillingPeriod === 'yearly' && billingPeriod === 'monthly')
      );

      // Si c'est un upgrade
      if (isUpgrade) {
        setUpgradePlanId(planId);
        setUpgradeBillingPeriod(billingPeriod);
        setLoadingPreview(true);
        setAcceptedTerms(false);
        setShowUpgradeModal(true);

        try {
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

      // Si c'est un downgrade
      if (isDowngrade) {
        setDowngradePlanId(planId);
        setDowngradeBillingPeriod(billingPeriod);
        setAcceptedDowngradeTerms(false);
        setShowDowngradeModal(true);
        return;
      }

      // Sinon, procéder directement (nouvel abonnement)
      setProcessingPlanId(planId);

      const res = await fetch('/api/checkout/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingPeriod, locale: language }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || t('subscription.comparison.errors.checkoutError'));
        setProcessingPlanId(null);
        return;
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error changing plan:', error);
      alert(t('subscription.comparison.errors.changePlanError'));
      setProcessingPlanId(null);
    }
  }, [plans, currentPlan, subscription, t]);

  const handleConfirmDowngradeToFree = useCallback(async () => {
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
      window.location.reload();
    } catch (error) {
      console.error('Erreur downgrade:', error);
      alert(error.message);
    } finally {
      setIsDowngrading(false);
    }
  }, [t]);

  const handleConfirmDowngrade = useCallback(async () => {
    if (!acceptedDowngradeTerms) {
      alert(t('subscription.comparison.downgradeModal.termsRequired', 'Vous devez accepter les CGV'));
      return;
    }

    setIsDowngrading(true);
    setShowDowngradeModal(false);

    try {
      const res = await fetch('/api/checkout/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: downgradePlanId,
          billingPeriod: downgradeBillingPeriod,
          isDowngrade: true,
          locale: language
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || t('subscription.comparison.errors.checkoutError'));
        setIsDowngrading(false);
        return;
      }

      const data = await res.json();

      if (data.success || data.scheduled) {
        window.location.href = '/account/subscriptions?success=true&updated=true';
      } else {
        alert(t('subscription.comparison.errors.changePlanError'));
        setIsDowngrading(false);
      }
    } catch (error) {
      console.error('Error downgrading:', error);
      alert(t('subscription.comparison.errors.changePlanError'));
      setIsDowngrading(false);
    }
  }, [acceptedDowngradeTerms, downgradePlanId, downgradeBillingPeriod, t]);

  const handleConfirmUpgrade = useCallback(async () => {
    if (!acceptedTerms) {
      alert(t('subscription.comparison.upgradeModal.termsRequired', 'Vous devez accepter les CGV'));
      return;
    }

    setProcessingPlanId(upgradePlanId);
    setShowUpgradeModal(false);

    try {
      const res = await fetch('/api/checkout/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: upgradePlanId, billingPeriod: upgradeBillingPeriod, locale: language }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || t('subscription.comparison.errors.checkoutError'));
        setProcessingPlanId(null);
        return;
      }

      const data = await res.json();

      if (data.success || data.upgraded) {
        window.location.href = '/account/subscriptions?success=true&updated=true';
      } else {
        alert(t('subscription.comparison.errors.changePlanError'));
        setProcessingPlanId(null);
      }
    } catch (error) {
      console.error('Error upgrading:', error);
      alert(t('subscription.comparison.errors.changePlanError'));
      setProcessingPlanId(null);
    }
  }, [acceptedTerms, upgradePlanId, upgradeBillingPeriod, t]);

  const handleCancelDowngrade = useCallback(async () => {
    setCancelingDowngrade(true);
    try {
      const res = await fetch('/api/subscription/cancel-downgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || t('subscription.packs.errors.cancelDowngradeError'));
        setCancelingDowngrade(false);
        return;
      }

      if (onUpgradeSuccess) {
        onUpgradeSuccess();
      }
    } catch (error) {
      console.error('Error canceling downgrade:', error);
      alert(t('subscription.packs.errors.cancelDowngradeError'));
      setCancelingDowngrade(false);
    }
  }, [onUpgradeSuccess, t]);

  return {
    // Data
    plans,
    loading,
    highlightedCardRef,
    isHighlighting,
    processingPlanId,

    // Downgrade modal state
    showDowngradeModal,
    setShowDowngradeModal,
    showDowngradeToFreeModal,
    setShowDowngradeToFreeModal,
    isDowngrading,
    downgradePlanId,
    acceptedDowngradeTerms,
    setAcceptedDowngradeTerms,

    // Upgrade modal state
    showUpgradeModal,
    setShowUpgradeModal,
    upgradePlanId,
    upgradeBillingPeriod,
    upgradePreview,
    loadingPreview,
    acceptedTerms,
    setAcceptedTerms,

    // Other state
    expandedPlan,
    setExpandedPlan,
    cancelingDowngrade,

    // Handlers
    handlePlanChange,
    handleConfirmDowngradeToFree,
    handleConfirmDowngrade,
    handleConfirmUpgrade,
    handleCancelDowngrade
  };
}
