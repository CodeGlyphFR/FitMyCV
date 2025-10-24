"use client";

import React from "react";
import { Crown, Calendar, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import Modal from "@/components/ui/Modal";

export default function CurrentPlanCard({ subscription, plan, cvStats, onCancelSubscription }) {
  if (!subscription || !plan) {
    return null;
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/20 border border-green-500/50 text-green-200 text-xs">
            <CheckCircle size={14} />
            Actif
          </span>
        );
      case "canceled":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-500/20 border border-orange-500/50 text-orange-200 text-xs">
            <AlertTriangle size={14} />
            Annulé
          </span>
        );
      case "past_due":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/20 border border-red-500/50 text-red-200 text-xs">
            <XCircle size={14} />
            Paiement échoué
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const getPlanIcon = (planName) => {
    if (planName === "Premium") return "👑";
    if (planName === "Pro") return "⚡";
    return "🎯";
  };

  // Identifier le plan gratuit de manière robuste (par prix = 0 OU nom = "Gratuit")
  const isFreeplan = plan.priceMonthly === 0 || plan.name === 'Gratuit';
  const [showCancelModal, setShowCancelModal] = React.useState(false);
  const [isCanceling, setIsCanceling] = React.useState(false);
  const [showReactivateModal, setShowReactivateModal] = React.useState(false);
  const [isReactivating, setIsReactivating] = React.useState(false);
  const [showYearlyWarningModal, setShowYearlyWarningModal] = React.useState(false);
  const [isSwitchingPeriod, setIsSwitchingPeriod] = React.useState(false);

  const handleCancelClick = () => {
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    setIsCanceling(true);
    try {
      if (onCancelSubscription) {
        await onCancelSubscription();
      }
      setShowCancelModal(false);
    } catch (error) {
      console.error('Erreur annulation:', error);
    } finally {
      setIsCanceling(false);
    }
  };

  const handleReactivateClick = () => {
    setShowReactivateModal(true);
  };

  const handleConfirmReactivate = async () => {
    setIsReactivating(true);
    try {
      const response = await fetch('/api/subscription/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur lors de la réactivation');
      }

      setShowReactivateModal(false);

      // Rafraîchir la page pour afficher les nouvelles données
      window.location.reload();
    } catch (error) {
      console.error('Erreur réactivation:', error);
      alert(error.message);
    } finally {
      setIsReactivating(false);
    }
  };

  const handleSwitchBillingPeriodClick = (newPeriod) => {
    // Si passage de mensuel à annuel, afficher le modal d'avertissement
    if (subscription.billingPeriod === 'monthly' && newPeriod === 'yearly') {
      setShowYearlyWarningModal(true);
    } else {
      // Ne devrait jamais arriver (annuel → mensuel est bloqué)
      alert('Impossible de revenir au paiement mensuel. Veuillez annuler votre abonnement si nécessaire.');
    }
  };

  const handleConfirmSwitchToYearly = async () => {
    setIsSwitchingPeriod(true);
    try {
      const response = await fetch('/api/checkout/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          billingPeriod: 'yearly',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur lors du changement de période');
      }

      const { url, updated } = await response.json();

      // Rediriger vers la page appropriée
      window.location.href = url;
    } catch (error) {
      console.error('Erreur changement période:', error);
      alert(error.message);
      setIsSwitchingPeriod(false);
      setShowYearlyWarningModal(false);
    }
  };

  return (
    <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 shadow-lg">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{getPlanIcon(plan.name)}</div>
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              Plan {plan.name}
              {getStatusBadge(subscription.status)}
            </h2>
            {!isFreeplan && (
              <p className="text-sm text-white/60 mt-0.5">
                {subscription.billingPeriod === "yearly" ? "Facturation annuelle" : "Facturation mensuelle"}
              </p>
            )}
          </div>
        </div>

        {!isFreeplan && (
          <div className="text-right">
            <div className="text-2xl font-bold text-white">
              {subscription.billingPeriod === "yearly"
                ? `${plan.priceYearly}€`
                : `${plan.priceMonthly}€`}
            </div>
            <div className="text-xs text-white/60">
              /{subscription.billingPeriod === "yearly" ? "an" : "mois"}
            </div>
          </div>
        )}
      </div>

      {!isFreeplan && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {/* Période actuelle */}
            <div className="space-y-1">
              <div className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={12} />
                Période actuelle
              </div>
              <div className="text-sm text-white">
                Du {formatDate(subscription.currentPeriodStart)}
              </div>
              <div className="text-sm text-white">
                au {formatDate(subscription.currentPeriodEnd)}
              </div>
            </div>

            {/* Renouvellement */}
            <div className="space-y-1">
              <div className="text-xs text-white/60 uppercase tracking-wider">Renouvellement</div>
              {subscription.cancelAtPeriodEnd ? (
                <div className="text-sm text-orange-300">
                  Annulé le {formatDate(subscription.currentPeriodEnd)}
                </div>
              ) : (
                <div className="text-sm text-white">
                  {subscription.status === "active" ? "Automatique" : "Inactif"}
                </div>
              )}
            </div>
          </div>

          {subscription.cancelAtPeriodEnd && (
            <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-sm text-orange-200">
              ⚠️ Votre abonnement sera annulé le {formatDate(subscription.currentPeriodEnd)}. Vous conserverez l'accès jusqu'à cette date.
            </div>
          )}

          {/* Bouton de changement de période de facturation */}
          {!subscription.cancelAtPeriodEnd && plan.priceYearly && plan.priceYearly !== plan.priceMonthly && (
            <div className="mt-4">
              {subscription.billingPeriod === 'monthly' ? (
                <button
                  onClick={() => handleSwitchBillingPeriodClick('yearly')}
                  className="w-full px-4 py-2.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-500/50 text-blue-300 hover:text-blue-200 text-sm font-medium transition-all"
                >
                  🎁 Passer à la facturation annuelle ({plan.priceYearly}€/an - économisez {Math.round(((plan.priceMonthly * 12 - plan.priceYearly) / (plan.priceMonthly * 12)) * 100)}%)
                </button>
              ) : (
                <div className="w-full px-4 py-2.5 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-300 text-sm text-center">
                  ℹ️ Pour revenir au paiement mensuel, veuillez annuler votre abonnement annuel ci-dessous
                </div>
              )}
            </div>
          )}

          {/* Bouton d'annulation ou de réactivation */}
          <div className="mt-6 pt-4 border-t border-white/10">
            {subscription.cancelAtPeriodEnd ? (
              <button
                onClick={handleReactivateClick}
                className="w-full px-4 py-2.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/50 text-green-300 hover:text-green-200 text-sm font-medium transition-all"
              >
                Réactiver le renouvellement
              </button>
            ) : (
              <button
                onClick={handleCancelClick}
                className="w-full px-4 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-300 hover:text-red-200 text-sm font-medium transition-all"
              >
                Annuler l'abonnement
              </button>
            )}
          </div>
        </>
      )}

      {/* Modal de confirmation d'annulation */}
      <Modal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Annuler votre abonnement ?"
      >
        <div className="space-y-4">
          <p className="text-white/90">
            Si vous annulez votre abonnement :
          </p>
          <ul className="space-y-2 text-white/80">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>Vous conserverez l'accès jusqu'au <strong className="text-white">{formatDate(subscription.currentPeriodEnd)}</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>Vous repasserez automatiquement au <strong className="text-white">plan Gratuit</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>Vous pourrez réactiver à tout moment</span>
            </li>
          </ul>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowCancelModal(false)}
              disabled={isCanceling}
              className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors disabled:opacity-50 font-medium"
            >
              Conserver
            </button>
            <button
              onClick={handleConfirmCancel}
              disabled={isCanceling}
              className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50 font-medium"
            >
              {isCanceling ? 'Annulation...' : 'Confirmer'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmation de réactivation */}
      <Modal
        open={showReactivateModal}
        onClose={() => setShowReactivateModal(false)}
        title="Réactiver votre abonnement ?"
      >
        <div className="space-y-4">
          <p className="text-white/90">
            Si vous réactivez votre abonnement :
          </p>
          <ul className="space-y-2 text-white/80">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>Le renouvellement automatique sera rétabli</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>Vous conserverez votre <strong className="text-white">plan {plan.name}</strong> après le <strong className="text-white">{formatDate(subscription.currentPeriodEnd)}</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>Vous pourrez annuler à nouveau à tout moment</span>
            </li>
          </ul>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowReactivateModal(false)}
              disabled={isReactivating}
              className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors disabled:opacity-50 font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirmReactivate}
              disabled={isReactivating}
              className="flex-1 px-4 py-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors disabled:opacity-50 font-medium"
            >
              {isReactivating ? 'Réactivation...' : 'Confirmer'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal d'avertissement pour passage en facturation annuelle */}
      <Modal
        open={showYearlyWarningModal}
        onClose={() => !isSwitchingPeriod && setShowYearlyWarningModal(false)}
        title="⚠️ Passer à la facturation annuelle ?"
      >
        <div className="space-y-4">
          <p className="text-white/90 font-medium">
            Attention : Ce changement est <strong className="text-orange-300">irréversible</strong>
          </p>
          <ul className="space-y-2 text-white/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-orange-400 mt-0.5">⚠️</span>
              <span>Une fois passé en <strong className="text-white">facturation annuelle</strong>, vous ne pourrez <strong className="text-white">plus revenir au paiement mensuel</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">💰</span>
              <span>Vous économisez <strong className="text-white">{Math.round(((plan.priceMonthly * 12 - plan.priceYearly) / (plan.priceMonthly * 12)) * 100)}%</strong> par rapport au paiement mensuel ({plan.priceYearly}€/an au lieu de {plan.priceMonthly * 12}€/an)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-400 mt-0.5">🔒</span>
              <span>Si vous souhaitez annuler plus tard, l'annulation prendra effet <strong className="text-white">à la fin de votre période annuelle</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">✓</span>
              <span>Vous serez facturé dès maintenant au prorata pour la période restante</span>
            </li>
          </ul>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowYearlyWarningModal(false)}
              disabled={isSwitchingPeriod}
              className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors disabled:opacity-50 font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirmSwitchToYearly}
              disabled={isSwitchingPeriod}
              className="flex-1 px-4 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50 font-medium"
            >
              {isSwitchingPeriod ? 'Changement...' : 'Confirmer le passage en annuel'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
