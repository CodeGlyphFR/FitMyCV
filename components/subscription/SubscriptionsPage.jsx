"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CreditCard, Zap, History, Crown } from "lucide-react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import CurrentPlanCard from "./CurrentPlanCard";
import PlanComparisonCards from "./PlanComparisonCards";
import FeatureCountersCard from "./FeatureCountersCard";
import CreditBalanceCard from "./CreditBalanceCard";
import CreditPacksCards from "./CreditPacksCards";
import CreditTransactionsTable from "./CreditTransactionsTable";

export default function SubscriptionsPage({ user }) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = React.useState("subscription");
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
      setSuccessMessage("✅ Abonnement activé avec succès !");
      setTimeout(() => setSuccessMessage(""), 5000);
      // Rafraîchir les données après un petit délai pour laisser le webhook se traiter
      setTimeout(() => refreshData(), 1000);
    } else if (searchParams.get('credits_success') === 'true') {
      setSuccessMessage("✅ Crédits achetés avec succès !");
      setActiveTab("credits");
      setTimeout(() => setSuccessMessage(""), 5000);
      // Rafraîchir les données après un petit délai
      setTimeout(() => refreshData(), 1000);
    } else if (searchParams.get('canceled') === 'true') {
      setError("Paiement annulé.");
      setTimeout(() => setError(null), 5000);
    }
  }, [searchParams, refreshData]);

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
          throw new Error('Erreur lors du chargement des données');
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
    enabled: true,
  });

  const tabs = [
    { id: "subscription", label: "Abonnement", icon: Crown },
    { id: "credits", label: "Crédits", icon: Zap },
    { id: "history", label: "Historique", icon: History },
  ];

  if (loading) {
    return (
      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto px-6 pt-6 pb-12 space-y-6">
          <div className="text-center text-white/70 py-12">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-white/20 border-t-white/80 rounded-full"></div>
            <p className="mt-4">Chargement...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 pt-6 pb-12 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white mb-4 transition-colors drop-shadow"
          >
            <span>←</span>
            <span>Retour aux CV</span>
          </Link>
          <h1 className="text-2xl font-semibold text-white drop-shadow-lg">
            Abonnements & Crédits
          </h1>
          <p className="text-sm text-white/70 drop-shadow">
            Gérez votre abonnement, achetez des crédits et consultez votre historique.
          </p>
        </div>

        {/* Messages de succès/erreur */}
        {successMessage && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-white backdrop-blur-md">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-white backdrop-blur-md">
            ❌ {error}
          </div>
        )}

        {/* Onglets */}
        <div className="flex gap-2 border-b border-white/20 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap
                  ${isActive
                    ? 'text-white border-b-2 border-white'
                    : 'text-white/60 hover:text-white/80'
                  }
                `}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Contenu des onglets */}
        <div className="space-y-6">
          {activeTab === "subscription" && subscriptionData && (
            <>
              <CurrentPlanCard
                subscription={subscriptionData.subscription}
                plan={subscriptionData.subscription?.plan}
                cvStats={subscriptionData.cvStats}
              />
              <FeatureCountersCard
                featureCounters={subscriptionData.featureCounters}
                plan={subscriptionData.subscription?.plan}
              />
              <PlanComparisonCards
                currentPlan={subscriptionData.subscription?.plan}
                subscription={subscriptionData.subscription}
                onUpgradeSuccess={refreshData}
              />
            </>
          )}

          {activeTab === "credits" && creditData && (
            <>
              <CreditBalanceCard balance={creditData} />
              <CreditPacksCards onPurchaseSuccess={refreshData} />
            </>
          )}

          {activeTab === "history" && (
            <CreditTransactionsTable />
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-xs text-white/70 text-center space-y-2">
          <div>© 2025 FitMyCv.ai (v1.0.8)</div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-0 sm:gap-1 leading-none -space-y-3 sm:space-y-0">
            <div className="flex items-baseline justify-center gap-1 leading-none">
              <a href="/about" className="hover:text-white transition-colors">
                À propos
              </a>
              <span className="text-white/40">•</span>
              <a href="/cookies" className="hover:text-white transition-colors">
                Cookies
              </a>
              <span className="text-white/40 hidden sm:inline">•</span>
            </div>
            <div className="flex items-baseline justify-center gap-1 leading-none">
              <a href="/terms" className="hover:text-white transition-colors">
                Conditions générales
              </a>
              <span className="text-white/40">•</span>
              <a href="/privacy" className="hover:text-white transition-colors">
                Politique de confidentialité
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
