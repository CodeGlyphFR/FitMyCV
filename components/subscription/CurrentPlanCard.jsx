"use client";

import React from "react";
import { Crown, Calendar, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { isFreePlan, getPlanIcon, getYearlyDiscount } from "@/lib/subscription/planUtils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { translatePlanName } from "@/lib/subscription/planTranslations";

export default function CurrentPlanCard({ subscription, plan, cvStats, onCancelSubscription }) {
  const { t, language } = useLanguage();

  if (!subscription || !plan) {
    return null;
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/20 border border-green-500/50 text-green-200 text-xs">
            <CheckCircle size={14} />
            {t('subscription.currentPlan.status.active')}
          </span>
        );
      case "canceled":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-500/20 border border-orange-500/50 text-orange-200 text-xs">
            <AlertTriangle size={14} />
            {t('subscription.currentPlan.status.canceled')}
          </span>
        );
      case "past_due":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/20 border border-red-500/50 text-red-200 text-xs">
            <XCircle size={14} />
            {t('subscription.currentPlan.status.pastDue')}
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

  // Utiliser les fonctions utilitaires pour identifier le plan
  const isFreeplan = isFreePlan(plan);
  const planIcon = getPlanIcon(plan);
  const yearlyDiscount = getYearlyDiscount(plan);
  const [showCancelModal, setShowCancelModal] = React.useState(false);
  const [isCanceling, setIsCanceling] = React.useState(false);
  const [showReactivateModal, setShowReactivateModal] = React.useState(false);
  const [isReactivating, setIsReactivating] = React.useState(false);
  const [showYearlyWarningModal, setShowYearlyWarningModal] = React.useState(false);
  const [isSwitchingPeriod, setIsSwitchingPeriod] = React.useState(false);
  const [acceptedYearlyTerms, setAcceptedYearlyTerms] = React.useState(false);
  const [yearlyUpgradePreview, setYearlyUpgradePreview] = React.useState(null);
  const [loadingYearlyPreview, setLoadingYearlyPreview] = React.useState(false);

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

  const handleSwitchBillingPeriodClick = async (newPeriod) => {
    // Si passage de mensuel à annuel, afficher le modal d'avertissement
    if (subscription.billingPeriod === 'monthly' && newPeriod === 'yearly') {
      setAcceptedYearlyTerms(false); // Reset checkbox
      setLoadingYearlyPreview(true);
      setShowYearlyWarningModal(true);

      // Appeler l'API pour calculer le prorata
      try {
        const res = await fetch('/api/subscription/preview-upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: plan.id,
            billingPeriod: 'yearly'
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setYearlyUpgradePreview(data);
        }
      } catch (error) {
        console.error('Erreur preview:', error);
      } finally {
        setLoadingYearlyPreview(false);
      }
    } else {
      // Ne devrait jamais arriver (annuel → mensuel est bloqué)
      alert(t('subscription.packs.errors.cannotSwitchToMonthly'));
    }
  };

  const handleConfirmSwitchToYearly = async () => {
    // Vérifier que les CGV sont acceptées
    if (!acceptedYearlyTerms) {
      alert(t('subscription.currentPlan.yearlyWarningModal.termsRequired', 'Vous devez accepter les CGV'));
      return;
    }

    setIsSwitchingPeriod(true);
    try {
      const response = await fetch('/api/checkout/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          billingPeriod: 'yearly',
          locale: language,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur lors du changement de période');
      }

      const data = await response.json();

      // Si upgrade réussi (pas d'URL Stripe), recharger la page
      if (data.success || data.upgraded) {
        window.location.reload();
      } else if (data.url) {
        // Sinon redirection vers Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error('Réponse invalide du serveur');
      }
    } catch (error) {
      console.error('Erreur changement période:', error);
      alert(error.message);
      setIsSwitchingPeriod(false);
      setShowYearlyWarningModal(false);
    }
  };

  return (
    <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-4 shadow-lg h-full flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-2xl">{planIcon}</div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              {t('subscription.currentPlan.title', { planName: translatePlanName(plan.name, language) })}
            </h2>
            {!isFreeplan && (
              <p className="text-xs text-white/60 mt-0.5">
                {subscription.billingPeriod === "yearly" ? t('subscription.currentPlan.billingYearly') : t('subscription.currentPlan.billingMonthly')}
              </p>
            )}
          </div>
        </div>

        <div className="text-right">
          {!isFreeplan && (
            <>
              <div className="text-xl font-bold text-white">
                {subscription.billingPeriod === "yearly"
                  ? `${plan.priceYearly}€`
                  : `${plan.priceMonthly}€`}
              </div>
              <div className="text-xs text-white/60">
                /{subscription.billingPeriod === "yearly" ? t('subscription.currentPlan.perYear') : t('subscription.currentPlan.perMonth')}
              </div>
            </>
          )}
          <div className="mt-1">
            {getStatusBadge(subscription.status)}
          </div>
        </div>
      </div>

      {!isFreeplan && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {/* Période actuelle */}
            <div className="space-y-1">
              <div className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={12} />
                {t('subscription.currentPlan.currentPeriod')}
              </div>
              <div className="text-sm text-white">
                {t('subscription.currentPlan.periodFrom', { date: formatDate(subscription.currentPeriodStart) })}
              </div>
              <div className="text-sm text-white">
                {t('subscription.currentPlan.periodTo', { date: formatDate(subscription.currentPeriodEnd) })}
              </div>
            </div>

            {/* Renouvellement */}
            <div className="space-y-1">
              <div className="text-xs text-white/60 uppercase tracking-wider">{t('subscription.currentPlan.renewal')}</div>
              {subscription.cancelAtPeriodEnd ? (
                <div className="text-sm text-orange-300">
                  {t('subscription.currentPlan.canceledOn', { date: formatDate(subscription.currentPeriodEnd) })}
                </div>
              ) : (
                <div className="text-sm text-white">
                  {subscription.status === "active" ? t('subscription.currentPlan.renewalAutomatic') : t('subscription.currentPlan.renewalInactive')}
                </div>
              )}
            </div>
          </div>

          {/* Bouton de changement de période de facturation */}
          {!subscription.cancelAtPeriodEnd && plan.priceYearly && plan.priceYearly !== plan.priceMonthly && subscription.billingPeriod === 'monthly' && (
            <div className="mt-3">
              <button
                onClick={() => handleSwitchBillingPeriodClick('yearly')}
                className="w-full px-3 py-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-500/50 text-blue-300 hover:text-blue-200 text-xs font-medium transition-all"
              >
                🎁 {t('subscription.currentPlan.switchToYearly', { price: plan.priceYearly, discount: yearlyDiscount })}
              </button>
            </div>
          )}

          {/* Bouton Gérer ma carte bancaire */}
          {!subscription.cancelAtPeriodEnd && (
            <div className="mt-3">
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/subscription/billing-portal', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                    });

                    if (!response.ok) {
                      const data = await response.json();
                      throw new Error(data.error || 'Erreur lors de l\'ouverture du portail');
                    }

                    const { url } = await response.json();
                    window.location.href = url;
                  } catch (error) {
                    console.error('Erreur Billing Portal:', error);
                    alert(error.message);
                  }
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 text-white text-xs font-medium transition-all"
              >
                💳 Gérer ma carte bancaire
              </button>
            </div>
          )}

          {/* Message informatif + Bouton d'annulation/réactivation - Poussé en bas */}
          <div className="mt-auto pt-3 border-t border-white/10">
            {subscription.cancelAtPeriodEnd ? (
              <div className="space-y-3">
                {/* Warning block */}
                <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-sm text-orange-200">
                  ⚠️ {t('subscription.currentPlan.canceledWarning', { date: formatDate(subscription.currentPeriodEnd) })}
                </div>
                {/* Reactivate button */}
                <button
                  onClick={handleReactivateClick}
                  className="w-full px-3 py-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/50 text-green-300 hover:text-green-200 text-xs font-medium transition-all"
                >
                  {t('subscription.currentPlan.reactivateButton')}
                </button>
              </div>
            ) : (
              <>
                {subscription.billingPeriod === 'yearly' && plan.priceYearly && plan.priceYearly !== plan.priceMonthly ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-300 text-xs">
                      ℹ️ {t('subscription.currentPlan.switchPeriodInfo')}
                    </div>
                    <button
                      onClick={handleCancelClick}
                      className="flex-shrink-0 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-300 hover:text-red-200 text-xs font-medium transition-all whitespace-nowrap"
                    >
                      {t('subscription.currentPlan.cancelButton').replace('l\'abonnement', '').trim()}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleCancelClick}
                    className="w-full px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-300 hover:text-red-200 text-xs font-medium transition-all"
                  >
                    {t('subscription.currentPlan.cancelButton')}
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Modal de confirmation d'annulation */}
      <Modal
        open={showCancelModal}
        onClose={() => !isCanceling && setShowCancelModal(false)}
        title={t('subscription.currentPlan.cancelModal.title')}
        disableEscapeKey={isCanceling}
        disableBackdropClick={isCanceling}
      >
        <div className="space-y-4">
          <p className="text-white/90">
            {t('subscription.currentPlan.cancelModal.description')}
          </p>
          <ul className="space-y-2 text-white/80">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>{t('subscription.currentPlan.cancelModal.keepAccessUntil', { date: formatDate(subscription.currentPeriodEnd) })}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>{t('subscription.currentPlan.cancelModal.downgradePlan')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>{t('subscription.currentPlan.cancelModal.canReactivate')}</span>
            </li>
          </ul>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowCancelModal(false)}
              disabled={isCanceling}
              className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors disabled:opacity-50 font-medium"
            >
              {t('subscription.currentPlan.cancelModal.keepButton')}
            </button>
            <button
              onClick={handleConfirmCancel}
              disabled={isCanceling}
              className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50 font-medium"
            >
              {isCanceling ? t('subscription.currentPlan.cancelModal.canceling') : t('subscription.currentPlan.cancelModal.confirmButton')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmation de réactivation */}
      <Modal
        open={showReactivateModal}
        onClose={() => !isReactivating && setShowReactivateModal(false)}
        title={t('subscription.currentPlan.reactivateModal.title')}
        disableEscapeKey={isReactivating}
        disableBackdropClick={isReactivating}
      >
        <div className="space-y-4">
          <p className="text-white/90">
            {t('subscription.currentPlan.reactivateModal.description')}
          </p>
          <ul className="space-y-2 text-white/80">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>{t('subscription.currentPlan.reactivateModal.renewalRestored')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>{t('subscription.currentPlan.reactivateModal.keepPlan', { planName: plan.name, date: formatDate(subscription.currentPeriodEnd) })}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>{t('subscription.currentPlan.reactivateModal.canCancelAgain')}</span>
            </li>
          </ul>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowReactivateModal(false)}
              disabled={isReactivating}
              className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors disabled:opacity-50 font-medium"
            >
              {t('subscription.currentPlan.reactivateModal.cancelButton')}
            </button>
            <button
              onClick={handleConfirmReactivate}
              disabled={isReactivating}
              className="flex-1 px-4 py-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors disabled:opacity-50 font-medium"
            >
              {isReactivating ? t('subscription.currentPlan.reactivateModal.reactivating') : t('subscription.currentPlan.reactivateModal.confirmButton')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal d'avertissement pour passage en facturation annuelle */}
      <Modal
        open={showYearlyWarningModal}
        onClose={() => !isSwitchingPeriod && setShowYearlyWarningModal(false)}
        title={t('subscription.currentPlan.yearlyWarningModal.title')}
        disableEscapeKey={isSwitchingPeriod}
        disableBackdropClick={isSwitchingPeriod}
      >
        <div className="space-y-4">
          {/* Montant du prorata */}
          {loadingYearlyPreview ? (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
              <Loader2 className="animate-spin mx-auto mb-2" size={24} />
              <p className="text-white/60 text-sm">
                {t('subscription.comparison.upgradeModal.calculatingProrata', 'Calcul du prorata...')}
              </p>
            </div>
          ) : yearlyUpgradePreview && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
              {/* Si customer balance existe, afficher le détail */}
              {yearlyUpgradePreview.customerBalance && yearlyUpgradePreview.customerBalance < 0 ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/70">Montant du prorata</span>
                    <span className="text-white">
                      {yearlyUpgradePreview.prorataAmountBeforeBalance.toFixed(2)} €
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-emerald-400">Solde créditeur</span>
                    <span className="text-emerald-400">
                      {yearlyUpgradePreview.customerBalance.toFixed(2)} €
                    </span>
                  </div>
                  <div className="border-t border-white/10 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white/70 font-medium">
                        {t('subscription.comparison.upgradeModal.prorataAmount', 'Montant à payer')}
                      </span>
                      <span className="text-2xl font-bold text-emerald-400">
                        {yearlyUpgradePreview.prorataAmount.toFixed(2)} €
                      </span>
                    </div>
                  </div>
                  <p className="text-white/60 text-xs text-center">
                    {t('subscription.comparison.upgradeModal.prorataInfo', 'Montant calculé pour la période restante (prorata automatique)')}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-white/70">
                      {t('subscription.comparison.upgradeModal.prorataAmount', 'Montant à payer')}
                    </span>
                    <span className="text-2xl font-bold text-emerald-400">
                      {yearlyUpgradePreview.prorataAmount.toFixed(2)} €
                    </span>
                  </div>
                  <p className="text-sm text-white/50">
                    {t('subscription.comparison.upgradeModal.prorataInfo', 'Montant calculé pour la période restante (prorata automatique)')}
                  </p>
                </>
              )}
            </div>
          )}

          <p className="text-white/90 font-medium">
            {t('subscription.currentPlan.yearlyWarningModal.warningTitle')}
          </p>
          <ul className="space-y-2 text-white/80 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>{t('subscription.currentPlan.yearlyWarningModal.cannotGoBackMonthly')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>{t('subscription.currentPlan.yearlyWarningModal.savingsInfo', { discount: yearlyDiscount, yearlyPrice: plan.priceYearly, monthlyTotal: plan.priceMonthly * 12 })}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>{t('subscription.currentPlan.yearlyWarningModal.cancellationInfo')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>{t('subscription.currentPlan.yearlyWarningModal.prorataInfo')}</span>
            </li>
          </ul>

          {/* Checkbox CGV */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedYearlyTerms}
                onChange={(e) => setAcceptedYearlyTerms(e.target.checked)}
                className="mt-1 w-4 h-4 rounded-xs border-2 border-white/30 bg-white/5 appearance-none cursor-pointer transition-all checked:bg-gradient-to-br checked:from-emerald-500/40 checked:to-emerald-600/40 checked:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-0 relative checked:after:content-['✓'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-white checked:after:text-xs checked:after:font-bold"
              />
              <span className="text-sm text-white/80 group-hover:text-white transition-colors">
                {t('subscription.currentPlan.yearlyWarningModal.termsLabel', 'J\'accepte les')}{' '}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t('subscription.currentPlan.yearlyWarningModal.termsLink', 'Conditions Générales de Vente')}
                </a>
              </span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowYearlyWarningModal(false)}
              disabled={isSwitchingPeriod}
              className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors disabled:opacity-50 font-medium"
            >
              {t('subscription.currentPlan.yearlyWarningModal.cancelButton')}
            </button>
            <button
              onClick={handleConfirmSwitchToYearly}
              disabled={isSwitchingPeriod || !acceptedYearlyTerms}
              className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white transition-colors disabled:opacity-50 font-medium shadow-lg shadow-emerald-500/20"
            >
              {isSwitchingPeriod ? t('subscription.currentPlan.yearlyWarningModal.switching', 'Traitement...') : t('subscription.currentPlan.yearlyWarningModal.confirm', 'Confirmer')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
