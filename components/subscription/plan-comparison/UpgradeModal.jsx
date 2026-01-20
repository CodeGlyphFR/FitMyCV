"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";

/**
 * Modal de confirmation d'upgrade
 */
export default function UpgradeModal({
  open,
  onClose,
  subscription,
  upgradeBillingPeriod,
  upgradePreview,
  loadingPreview,
  processingPlanId,
  acceptedTerms,
  setAcceptedTerms,
  onConfirm,
  t,
  language
}) {
  const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';

  return (
    <Modal
      open={open}
      onClose={onClose}
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
                <div className="flex items-center justify-between">
                  <span className="text-white/70">{t('subscription.comparison.upgradeModal.prorataAmount', 'Montant à payer')}</span>
                  <span className="text-2xl font-bold text-emerald-400">
                    {upgradePreview.prorataAmount.toFixed(2)} {upgradePreview.currency}
                  </span>
                </div>
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
                      date: new Date(subscription?.currentPeriodEnd).toLocaleDateString(locale, dateOptions)
                    })
                  }} />
                </p>
              </div>
            )}

            {/* Crédit appliqué (si upgrade tier avec annuel → mensuel) */}
            {subscription?.billingPeriod === 'yearly' && upgradeBillingPeriod === 'monthly' && upgradePreview?.monthsOffered > 0 && (() => {
              const nextBillingDate = new Date();
              nextBillingDate.setMonth(nextBillingDate.getMonth() + upgradePreview.monthsOffered);
              const formattedDate = nextBillingDate.toLocaleDateString(locale, dateOptions);

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
                  className="mt-1 w-4 h-4 rounded-xs border-2 border-white/30 bg-white/5 appearance-none cursor-pointer transition-all checked:bg-gradient-to-br checked:from-emerald-500/40 checked:to-emerald-600/40 checked:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-0 relative checked:after:content-['✓'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-white checked:after:text-xs checked:after:font-bold"
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
                onClick={onClose}
                disabled={processingPlanId !== null}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors disabled:opacity-50 font-medium"
              >
                {t('subscription.comparison.upgradeModal.cancel', 'Annuler')}
              </button>
              <button
                onClick={onConfirm}
                disabled={processingPlanId !== null || !acceptedTerms}
                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white transition-colors disabled:opacity-50 font-medium shadow-lg shadow-green-500/20"
              >
                {processingPlanId !== null
                  ? t('subscription.comparison.upgradeModal.processing', 'Traitement...')
                  : t('subscription.comparison.upgradeModal.confirm', 'Confirmer')}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
