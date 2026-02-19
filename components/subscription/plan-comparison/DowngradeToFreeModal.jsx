"use client";

import React from "react";
import Modal from "@/components/ui/Modal";

/** Renders text allowing only <strong> tags as React elements, escaping everything else */
function renderSafeMarkup(text) {
  if (!text || typeof text !== 'string' || !text.includes('<strong>')) return text;
  return text.split(/(<strong>.*?<\/strong>)/g).map((part, i) => {
    const match = part.match(/^<strong>(.*?)<\/strong>$/);
    return match ? <strong key={i}>{match[1]}</strong> : part;
  });
}

/**
 * Modal de confirmation de downgrade vers le plan Gratuit
 */
export default function DowngradeToFreeModal({
  open,
  onClose,
  plans,
  subscription,
  scheduledDowngrade,
  isDowngrading,
  onConfirm,
  t,
  language
}) {
  const effectiveDate = new Date(subscription?.currentPeriodEnd);
  const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  const shortDateOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('subscription.comparison.downgradeToFreeModal.title', 'Passer au plan Gratuit')}
    >
      <div className="space-y-4">
        <p className="text-white/90">
          {t('subscription.comparison.downgradeToFreeModal.description', 'Vous êtes sur le point d\'annuler votre abonnement.')}
        </p>

        {/* Warning si un downgrade est déjà programmé */}
        {scheduledDowngrade && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
            <p className="text-sm text-orange-300">
              {t('subscription.comparison.downgradeToFreeModal.scheduledCancelled', {
                planName: plans.find(p => p.id === scheduledDowngrade.targetPlanId)?.name || 'votre futur plan'
              })}
            </p>
          </div>
        )}

        <ul className="space-y-2 text-white/80">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">•</span>
            <span>{renderSafeMarkup(t('subscription.comparison.downgradeToFreeModal.keepAccessUntil', {
                date: effectiveDate.toLocaleDateString(locale, dateOptions)
              }))}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">•</span>
            <span>
              {t('subscription.comparison.downgradeToFreeModal.effectiveDate', {
                date: effectiveDate.toLocaleDateString(locale, shortDateOptions)
              })}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">•</span>
            <span>{renderSafeMarkup(t('subscription.comparison.downgradeToFreeModal.switchToFree', 'Vous passerez au plan <strong>Gratuit</strong> après cette date'))}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">•</span>
            <span>{t('subscription.comparison.downgradeToFreeModal.canUpgrade', 'Vous pourrez upgrader à nouveau à tout moment')}</span>
          </li>
        </ul>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            disabled={isDowngrading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors disabled:opacity-50 font-medium"
          >
            {t('subscription.comparison.downgradeToFreeModal.cancel', 'Annuler')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isDowngrading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white transition-colors disabled:opacity-50 font-medium shadow-lg shadow-emerald-500/20"
          >
            {isDowngrading
              ? t('subscription.comparison.downgradeToFreeModal.scheduling', 'Programmation...')
              : t('subscription.comparison.downgradeToFreeModal.confirm', 'Confirmer')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
