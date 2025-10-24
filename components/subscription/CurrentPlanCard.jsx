"use client";

import React from "react";
import { Crown, Calendar, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

export default function CurrentPlanCard({ subscription, plan, cvStats }) {
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
            <p className="text-sm text-white/60 mt-0.5">
              {subscription.billingPeriod === "yearly" ? "Facturation annuelle" : "Facturation mensuelle"}
            </p>
          </div>
        </div>

        {plan.id !== 1 && (
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
    </div>
  );
}
