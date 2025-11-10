"use client";

import React from "react";
import { Zap, TrendingUp, TrendingDown, RotateCcw, Gift } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function CreditBalanceCard({ balance }) {
  const { t } = useLanguage();

  if (!balance) {
    return null;
  }

  const stats = [
    {
      label: t('subscription.credits.purchased'),
      value: balance.totalPurchased,
      icon: TrendingUp,
      color: "text-green-300",
    },
    {
      label: t('subscription.credits.used'),
      value: balance.totalUsed,
      icon: TrendingDown,
      color: "text-blue-300",
    },
    {
      label: t('subscription.credits.refunded'),
      value: balance.totalRefunded,
      icon: RotateCcw,
      color: "text-purple-300",
    },
    {
      label: t('subscription.credits.gifted'),
      value: balance.totalGifted,
      icon: Gift,
      color: "text-yellow-300",
    },
  ];

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-xl p-4 shadow-lg">
      {/* Balance principale */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Zap className="text-yellow-300" size={24} />
          <h2 className="text-lg font-semibold text-white">{t('subscription.credits.title')}</h2>
        </div>

        <div className="text-4xl font-bold text-white mb-1">
          {balance.balance}
        </div>
        <div className="text-xs text-white/70">{t('subscription.credits.available')}</div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white/10 backdrop-blur-sm rounded-lg p-2 text-center"
            >
              <Icon className={`mx-auto mb-0.5 ${stat.color}`} size={16} />
              <div className="text-xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-white/60">{stat.label}</div>
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-white/10 rounded-lg text-xs text-white">
        <div className="font-medium mb-1">{t('subscription.credits.howItWorks')}</div>
        <ul className="space-y-0.5 text-white/80 text-xs">
          <li>• {t('subscription.credits.rule1')}</li>
          <li>• {t('subscription.credits.rule2')}</li>
          <li>• {t('subscription.credits.rule3')}</li>
          <li>• {t('subscription.credits.rule4')}</li>
        </ul>
      </div>
    </div>
  );
}
