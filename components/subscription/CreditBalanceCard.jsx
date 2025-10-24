"use client";

import React from "react";
import { Zap, TrendingUp, TrendingDown, RotateCcw, Gift } from "lucide-react";

export default function CreditBalanceCard({ balance }) {
  if (!balance) {
    return null;
  }

  const stats = [
    {
      label: "Achetés",
      value: balance.totalPurchased,
      icon: TrendingUp,
      color: "text-green-300",
    },
    {
      label: "Utilisés",
      value: balance.totalUsed,
      icon: TrendingDown,
      color: "text-blue-300",
    },
    {
      label: "Remboursés",
      value: balance.totalRefunded,
      icon: RotateCcw,
      color: "text-purple-300",
    },
    {
      label: "Bonus reçus",
      value: balance.totalGifted,
      icon: Gift,
      color: "text-yellow-300",
    },
  ];

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-xl p-6 shadow-lg">
      {/* Balance principale */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Zap className="text-yellow-300" size={32} />
          <h2 className="text-2xl font-semibold text-white">Balance de crédits</h2>
        </div>

        <div className="text-6xl font-bold text-white mb-2">
          {balance.balance}
        </div>
        <div className="text-sm text-white/70">crédits disponibles</div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center"
            >
              <Icon className={`mx-auto mb-1 ${stat.color}`} size={20} />
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-white/60">{stat.label}</div>
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div className="mt-6 p-4 bg-white/10 rounded-lg text-sm text-white">
        <div className="font-medium mb-2">💎 Comment ça marche ?</div>
        <ul className="space-y-1 text-white/80 text-xs">
          <li>• 1 crédit = 1 utilisation de n'importe quelle feature</li>
          <li>• Les crédits sont permanents (pas d'expiration)</li>
          <li>• Remboursement automatique si une tâche échoue</li>
          <li>• Utilisez vos crédits pour dépasser les limites mensuelles</li>
        </ul>
      </div>
    </div>
  );
}
