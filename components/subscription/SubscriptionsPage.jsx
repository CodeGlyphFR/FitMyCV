"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CreditCard, Zap, History, Crown, CheckCircle, XCircle, X } from "lucide-react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import CurrentPlanCard from "./CurrentPlanCard";
import PlanComparisonCards from "./PlanComparisonCards";
import FeatureCountersCard from "./FeatureCountersCard";
import CreditBalanceCard from "./CreditBalanceCard";
import CreditPacksCards from "./CreditPacksCards";
import CreditTransactionsTable from "./CreditTransactionsTable";
import InvoicesTable from "./InvoicesTable";
import { isFreePlan, getPlanIcon } from "@/lib/subscription/planUtils";
import {
  SkeletonCurrentPlanCard,
  SkeletonFeatureCounters,
  SkeletonPlanCard,
} from "@/components/ui/SkeletonLoader";

export default function SubscriptionsPage({ user }) {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = React.useState("subscription");

  // Récupérer l'ID du plan à mettre en avant (depuis redirection modal génération CV)
  const highlightPlanId = searchParams.get('highlightPlan');
  const [subscriptionData, setSubscriptionData] = React.useState(null);
  const [creditData, setCreditData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [successMessage, setSuccessMessage] = React.useState("");

  // Fonction de rafraîchissement des données
  const refreshData = React.useCallback(async () => {
    try {
      const [subRes, creditsRes] = await Promise.all([
        fetch('/api/subscription/current'),
        fetch('/api/credits/balance'),
      ]);

      if (subRes.ok && creditsRes.ok) {
        const subData = await subRes.json();
        const credData = await creditsRes.json();
        setSubscriptionData(subData);
        setCreditData(credData);
      }
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
  }, []);

  // Gérer les messages de succès après paiement Stripe
  React.useEffect(() => {
    if (searchParams.get('success') === 'true') {
      const isUpdated = searchParams.get('updated') === 'true';
      if (isUpdated) {
        setSuccessMessage(t('subscription.messages.subscriptionUpdated'));
      } else {
        setSuccessMessage(t('subscription.messages.subscriptionActivated'));
      }
      setTimeout(() => setSuccessMessage(""), 5000);
      // Rafraîchir les données après un délai pour laisser le webhook se traiter
      setTimeout(() => refreshData(), 2000);
    } else if (searchParams.get('credits_success') === 'true') {
      setSuccessMessage(t('subscription.messages.creditsPurchased'));
      setActiveTab("credits");
      setTimeout(() => setSuccessMessage(""), 5000);
      // Rafraîchir les données après un délai
      setTimeout(() => refreshData(), 2000);
    } else if (searchParams.get('canceled') === 'true') {
      setError(t('subscription.messages.paymentCanceled'));
      setTimeout(() => setError(null), 5000);
    }
  }, [searchParams, refreshData, t]);

  // Charger les données d'abonnement et crédits
  React.useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [subRes, creditsRes] = await Promise.all([
          fetch('/api/subscription/current'),
          fetch('/api/credits/balance'),
        ]);

        if (!subRes.ok || !creditsRes.ok) {
          throw new Error(t('subscription.messages.loadingError'));
        }

        const subData = await subRes.json();
        const credData = await creditsRes.json();

        setSubscriptionData(subData);
        setCreditData(credData);
      } catch (err) {
        console.error('Error fetching subscription data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Écouter les événements SSE pour rafraîchir automatiquement
  useRealtimeSync({
    onDbChange: React.useCallback((data) => {
      // Rafraîchir si changement sur CreditBalance ou FeatureUsageCounter
      if (data.entity === 'CreditBalance' || data.entity === 'FeatureUsageCounter') {
        console.log('[SubscriptionsPage] Événement SSE reçu, rafraîchissement des données:', data);
        refreshData();
      }
    }, [refreshData]),
    enabled: false,
  });

  // Fonction pour annuler l'abonnement
  const handleCancelSubscription = React.useCallback(async () => {
    try {
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ immediate: false }), // Annulation à la fin de la période
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur lors de l\'annulation');
      }

      const data = await response.json();
      setSuccessMessage(t('subscription.messages.cancelScheduled'));
      setTimeout(() => setSuccessMessage(""), 5000);

      // Rafraîchir les données pour afficher le nouveau status
      await refreshData();
    } catch (err) {
      console.error('Error canceling subscription:', err);
      setError(err.message || t('subscription.messages.cancelError'));
      setTimeout(() => setError(null), 5000);
    }
  }, [refreshData, t]);

  const tabs = [
    { id: "subscription", label: t('subscription.page.tabs.subscription'), icon: Crown },
    { id: "credits", label: t('subscription.page.tabs.credits'), icon: Zap },
    { id: "history", label: t('subscription.page.tabs.history'), icon: History },
  ];

  // Gestion navigation clavier des onglets
  const handleTabKeyDown = React.useCallback((e, tabIndex) => {
    const tabCount = tabs.length;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (tabIndex - 1 + tabCount) % tabCount;
      setActiveTab(tabs[prevIndex].id);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (tabIndex + 1) % tabCount;
      setActiveTab(tabs[nextIndex].id);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveTab(tabs[0].id);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveTab(tabs[tabCount - 1].id);
    }
  }, [tabs]);

  if (loading) {
    return (
      <main className="min-h-screen">
        <div className="max-w-5xl mx-auto px-6 pt-6 pb-12 space-y-6">
          {/* Header skeleton */}
          <div className="space-y-1">
            <div className="h-4 bg-white/20 rounded w-32 mb-4 animate-pulse"></div>
            <div className="h-8 bg-white/20 rounded w-64 mb-2 animate-pulse"></div>
            <div className="h-4 bg-white/20 rounded w-96 animate-pulse"></div>
          </div>

          {/* Tabs skeleton */}
          <div className="flex gap-2 border-b border-white/20">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-white/20 rounded-t-lg w-32 animate-pulse"></div>
            ))}
          </div>

          {/* Content skeleton */}
          <div className="space-y-6">
            {/* Skeleton layout 1/2 + 1/2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <SkeletonCurrentPlanCard />
              </div>
              <div>
                <SkeletonFeatureCounters />
              </div>
            </div>
            {/* Skeleton plan cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <SkeletonPlanCard />
              <SkeletonPlanCard />
              <SkeletonPlanCard />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 pt-6 pb-12 space-y-4">
        {/* Header */}
        <div className="space-y-1">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white mb-4 transition-colors drop-shadow"
          >
            <span>←</span>
            <span>{t('subscription.page.backToCvs')}</span>
          </Link>
          <h1 className="text-2xl font-semibold text-white drop-shadow-lg">
            {t('subscription.page.title')}
          </h1>
          <p className="text-sm text-white/70 drop-shadow">
            {t('subscription.page.description')}
          </p>
        </div>

        {/* Messages de succès/erreur */}
        {successMessage && (
          <div
            className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/50 rounded-xl p-4 text-white backdrop-blur-md shadow-lg shadow-green-500/10 animate-in fade-in slide-in-from-top-2 duration-300"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <CheckCircle className="flex-shrink-0 text-green-400 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="font-medium text-green-100">{successMessage}</p>
              </div>
              <button
                onClick={() => setSuccessMessage("")}
                className="flex-shrink-0 text-green-300 hover:text-green-100 transition-colors p-1 hover:bg-green-500/20 rounded"
                aria-label={t('subscription.page.close')}
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}
        {error && (
          <div
            className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/50 rounded-xl p-4 text-white backdrop-blur-md shadow-lg shadow-red-500/10 animate-in fade-in slide-in-from-top-2 duration-300"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <XCircle className="flex-shrink-0 text-red-400 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="font-medium text-red-100">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="flex-shrink-0 text-red-300 hover:text-red-100 transition-colors p-1 hover:bg-red-500/20 rounded"
                aria-label={t('subscription.page.close')}
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Onglets */}
        <div
          role="tablist"
          aria-label={t('subscription.page.tabsAriaLabel')}
          className="flex gap-2 border-b border-white/20 overflow-x-auto"
        >
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
                className={`
                  flex items-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-t-lg
                  ${isActive
                    ? 'text-white border-b-2 border-white'
                    : 'text-white/60 hover:text-white/80'
                  }
                `}
              >
                <Icon size={18} aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Contenu des onglets */}
        <div className="space-y-6">
          {activeTab === "subscription" && subscriptionData && (
            <div
              role="tabpanel"
              id="tabpanel-subscription"
              aria-labelledby="tab-subscription"
              className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300"
            >
              {/* Layout conditionnel selon le type de plan */}
              {isFreePlan(subscriptionData.subscription?.plan) ? (
                // Plan Gratuit : ligne minimaliste + usage pleine largeur
                <>
                  {/* Ligne minimaliste Plan Gratuit */}
                  <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl px-4 py-3 shadow-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{getPlanIcon(subscriptionData.subscription?.plan)}</span>
                      <span className="text-white font-medium">{t('subscription.currentPlan.freePlan')}</span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/20 border border-green-500/50 text-green-200 text-xs">
                      <CheckCircle size={14} />
                      {t('subscription.currentPlan.status.active')}
                    </span>
                  </div>

                  {/* Usage mensuel - pleine largeur */}
                  <FeatureCountersCard
                    featureCounters={subscriptionData.featureCounters}
                    plan={subscriptionData.subscription?.plan}
                  />
                </>
              ) : (
                // Plan payant : layout 1/2 + 1/2
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Current Plan - 1/2 */}
                  <div className="h-full">
                    <CurrentPlanCard
                      subscription={subscriptionData.subscription}
                      plan={subscriptionData.subscription?.plan}
                      cvStats={subscriptionData.cvStats}
                      onCancelSubscription={handleCancelSubscription}
                    />
                  </div>

                  {/* Monthly Usage - 1/2 */}
                  <div className="h-full">
                    <FeatureCountersCard
                      featureCounters={subscriptionData.featureCounters}
                      plan={subscriptionData.subscription?.plan}
                    />
                  </div>
                </div>
              )}

              {/* Plan Comparison Cards - full width */}
              <PlanComparisonCards
                currentPlan={subscriptionData.subscription?.plan}
                subscription={subscriptionData.subscription}
                scheduledDowngrade={subscriptionData.scheduledDowngrade}
                onUpgradeSuccess={refreshData}
                highlightPlanId={highlightPlanId ? parseInt(highlightPlanId, 10) : null}
              />
            </div>
          )}

          {activeTab === "credits" && creditData && (
            <div
              role="tabpanel"
              id="tabpanel-credits"
              aria-labelledby="tab-credits"
              className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300"
            >
              <CreditBalanceCard balance={creditData} />
              <CreditPacksCards onPurchaseSuccess={refreshData} />
            </div>
          )}

          {activeTab === "history" && (
            <div
              role="tabpanel"
              id="tabpanel-history"
              aria-labelledby="tab-history"
              className="animate-in fade-in slide-in-from-bottom-4 duration-300"
            >
              <div className="space-y-4">
                <CreditTransactionsTable />
                <InvoicesTable currentPlan={subscriptionData?.subscription} />
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
