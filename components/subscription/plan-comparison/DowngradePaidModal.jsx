"use client";

import React from "react";
import Modal from "@/components/ui/Modal";

/**
 * Modal de confirmation de downgrade entre plans payants
 */
export default function DowngradePaidModal({
  open,
  onClose,
  plans,
  downgradePlanId,
  subscription,
  isDowngrading,
  acceptedDowngradeTerms,
  setAcceptedDowngradeTerms,
  onConfirm,
  t,
  language
}) {
  const selectedPlan = plans.find(p => p.id === downgradePlanId);

  if (!selectedPlan) return null;

  const effectiveDate = new Date(subscription?.currentPeriodEnd);
  const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('subscription.comparison.downgradePaidModal.title', 'Confirmer le downgrade')}
    >
      <div className="space-y-4">
        {/* Informations sur le changement */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <p className="text-white/90 mb-2">
            {t('subscription.comparison.downgradePaidModal.description',
              'Votre abonnement sera modifié à la fin de votre période en cours.')}
          </p>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
            <span className="text-white/70">{t('subscription.comparison.downgradePaidModal.effectiveDate', 'Date d\'effet')}</span>
            <span className="font-semibold text-emerald-400">
              {effectiveDate.toLocaleDateString(locale, dateOptions)}
            </span>
          </div>
        </div>

        {/* Détails */}
        <ul className="space-y-2 text-white/80">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">•</span>
            <span>
              Vous conservez votre plan actuel jusqu'au <strong className="text-white">
                {effectiveDate.toLocaleDateString(locale, dateOptions)}
              </strong>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">•</span>
            <span>{t('subscription.comparison.downgradePaidModal.noRefund', 'Aucun remboursement ne sera effectué')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">•</span>
            <span>{t('subscription.comparison.downgradePaidModal.newInvoice', 'Une nouvelle facture sera émise à la date d\'effet')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">•</span>
            <span>
              Vous pouvez annuler ce changement jusqu'au <strong className="text-white">
                {effectiveDate.toLocaleDateString(locale, dateOptions)}
              </strong>
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
              className="mt-1 w-4 h-4 rounded-xs border-2 border-white/30 bg-white/5 appearance-none cursor-pointer transition-all checked:bg-gradient-to-br checked:from-emerald-500/40 checked:to-emerald-600/40 checked:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-0 relative checked:after:content-['✓'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-white checked:after:text-xs checked:after:font-bold"
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
            onClick={onClose}
            disabled={isDowngrading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors disabled:opacity-50 font-medium"
          >
            {t('subscription.comparison.downgradePaidModal.cancel', 'Annuler')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isDowngrading || !acceptedDowngradeTerms}
            className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white transition-colors disabled:opacity-50 font-medium shadow-lg shadow-emerald-500/20"
          >
            {isDowngrading
              ? t('subscription.comparison.downgradePaidModal.scheduling', 'Programmation...')
              : t('subscription.comparison.downgradePaidModal.confirm', 'Confirmer')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
