"use client";

import React from "react";
import { Info } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function CreditBalanceBanner({ creditBalance, currentPlan }) {
  const { t } = useLanguage();

  // N'afficher que si creditBalance > 0
  if (!creditBalance || creditBalance <= 0) {
    return null;
  }

  // Calculer le prix de la prochaine facture
  let nextInvoicePrice = 0;
  if (currentPlan) {
    nextInvoicePrice = currentPlan.billingPeriod === 'yearly'
      ? currentPlan.plan?.priceYearly || 0
      : currentPlan.plan?.priceMonthly || 0;
  }

  // Calculer les mois gratuits estimés
  let estimatedMonths = 0;
  let showMonthsEstimate = false;
  if (nextInvoicePrice > 0) {
    estimatedMonths = Math.floor(creditBalance / nextInvoicePrice);
    showMonthsEstimate = estimatedMonths >= 1;
  }

  return (
    <div className="backdrop-blur-md bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-green-500/50 rounded-xl p-4 md:p-5 shadow-lg mb-4">
      <div className="flex flex-col md:flex-row md:items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-lg bg-green-500/20 border border-green-500/50 flex items-center justify-center">
            <Info className="text-green-300" size={20} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-2">
          <h3 className="text-lg font-semibold text-white drop-shadow-lg">
            {t('subscription.invoices.creditBanner.title')}
          </h3>

          <p className="text-base text-green-100 font-medium">
            {t('subscription.invoices.creditBanner.amount', { amount: creditBalance.toFixed(2) })}
          </p>

          <p className="text-sm text-white/80">
            {t('subscription.invoices.creditBanner.explanation')}
          </p>

          {showMonthsEstimate && (
            <p className="text-sm text-green-200 font-medium">
              {t('subscription.invoices.creditBanner.estimatedMonths', { months: estimatedMonths })}
            </p>
          )}

          {!showMonthsEstimate && nextInvoicePrice > 0 && (
            <p className="text-sm text-green-200 font-medium">
              {t('subscription.invoices.creditBanner.lessThanOneMonth')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
