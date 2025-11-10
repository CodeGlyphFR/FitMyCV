"use client";

import React from "react";
import { AlertTriangle, CreditCard } from "lucide-react";
import Link from "next/link";

/**
 * Bannière affichée lorsque la balance de crédits est négative
 * Suite à un chargeback, l'utilisateur doit recharger des crédits
 */
export default function NegativeBalanceBanner({ balance }) {
  // N'afficher que si balance négative
  if (balance >= 0) {
    return null;
  }

  const absBalance = Math.abs(balance);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/95 backdrop-blur-sm border-b-2 border-red-600 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Message d'alerte */}
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-white flex-shrink-0" size={24} />
            <div>
              <div className="text-white font-semibold text-sm">
                ⚠️ Votre balance de crédits est négative : <span className="font-mono">{balance} crédits</span>
              </div>
              <div className="text-white/90 text-xs mt-0.5">
                Suite à un litige bancaire, votre balance est de <strong>{balance} crédits</strong>.
                Vous devez recharger <strong>{absBalance} crédits</strong> minimum pour continuer à utiliser le service.
              </div>
            </div>
          </div>

          {/* Bouton d'action */}
          <Link
            href="/account/subscriptions?tab=credits"
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 text-red-600 rounded-lg font-semibold text-sm transition-colors shadow-md flex-shrink-0"
          >
            <CreditCard size={18} />
            Recharger des crédits
          </Link>
        </div>
      </div>
    </div>
  );
}
