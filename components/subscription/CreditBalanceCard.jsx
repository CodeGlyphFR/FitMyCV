"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
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
  ];

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-xl p-4 shadow-lg">
      {/* Titre */}
      <h2 className="text-lg font-semibold text-white mb-4">{t('subscription.credits.title')}</h2>

      {/* Mobile: Balance à gauche, KPIs à droite, Comment en dessous */}
      <div className="md:hidden">
        <div className="grid grid-cols-3 gap-3 mb-3">
          {/* Balance principale */}
          <div className="flex flex-col items-center justify-center">
            <div className="text-5xl font-bold text-white mb-1">
              {balance.balance}
            </div>
            <div className="text-xs text-white/70">{t('subscription.credits.available')}</div>
          </div>

          {/* 2 tuiles KPI */}
          <div className="col-span-2 grid grid-cols-2 gap-2">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="bg-white/10 backdrop-blur-sm rounded-lg p-2 flex flex-col items-center justify-center"
                >
                  <Icon className={`mb-0.5 ${stat.color}`} size={16} />
                  <div className="text-xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-white/60">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comment ça marche ? */}
        <div className="bg-white/10 rounded-lg p-3 text-xs text-white">
          <div className="font-medium mb-1">{t('subscription.credits.howItWorks')}</div>
          <ul className="space-y-0.5 text-white/80 text-xs">
            <li>• {t('subscription.credits.rule2')}</li>
            <li>• {t('subscription.credits.rule3')}</li>
          </ul>
        </div>
      </div>

      {/* Desktop: Layout 1/3 + 2/3 */}
      <div className="hidden md:grid md:grid-cols-3 gap-4">
        {/* Balance principale à gauche */}
        <div className="flex flex-col items-center justify-center">
          <div className="text-6xl font-bold text-white mb-1">
            {balance.balance}
          </div>
          <div className="text-xs text-white/70">{t('subscription.credits.available')}</div>
        </div>

        {/* KPIs + Comment ça marche à droite */}
        <div className="col-span-2 flex flex-col gap-3">
          {/* 2 tuiles KPI */}
          <div className="grid grid-cols-2 gap-3">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="bg-white/10 backdrop-blur-sm rounded-lg p-2 flex flex-col items-center justify-center"
                >
                  <Icon className={`mb-0.5 ${stat.color}`} size={16} />
                  <div className="text-xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-white/60">{stat.label}</div>
                </div>
              );
            })}
          </div>

          {/* Comment ça marche ? */}
          <div className="bg-white/10 rounded-lg p-3 text-xs text-white">
            <div className="font-medium mb-1">{t('subscription.credits.howItWorks')}</div>
            <ul className="space-y-0.5 text-white/80 text-xs">
              <li>• {t('subscription.credits.rule2')}</li>
              <li>• {t('subscription.credits.rule3')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
