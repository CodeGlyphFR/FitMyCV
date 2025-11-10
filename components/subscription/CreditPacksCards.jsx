"use client";

import React from "react";
import { Zap, Loader2, Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function CreditPacksCards({ onPurchaseSuccess }) {
  const { t } = useLanguage();
  const [packs, setPacks] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [processingPackId, setProcessingPackId] = React.useState(null);

  // Charger les packs disponibles
  React.useEffect(() => {
    async function fetchPacks() {
      try {
        const res = await fetch('/api/subscription/credit-packs');
        if (res.ok) {
          const data = await res.json();
          setPacks(data.packs || []);
        }
      } catch (error) {
        console.error('Error fetching packs:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchPacks();
  }, []);

  const handlePurchase = async (packId) => {
    try {
      setProcessingPackId(packId);

      const res = await fetch('/api/checkout/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Erreur lors de la création de la session de paiement');
        setProcessingPackId(null);
        return;
      }

      const { url } = await res.json();

      // Rediriger vers Stripe Checkout
      window.location.href = url;
    } catch (error) {
      console.error('Error purchasing credits:', error);
      alert('Erreur lors de l\'achat');
      setProcessingPackId(null);
    }
  };

  const getPackColor = (name) => {
    if (name.includes("Pro")) return "from-purple-500/20 to-pink-500/20 border-purple-500/50";
    if (name.includes("Plus")) return "from-blue-500/20 to-cyan-500/20 border-blue-500/50";
    return "from-yellow-500/20 to-orange-500/20 border-yellow-500/50";
  };

  const getPackIcon = (credits) => {
    if (credits >= 50) return "💎";
    if (credits >= 25) return "⚡";
    return "✨";
  };

  const calculateUnitPrice = (price, credits) => {
    return (price / credits).toFixed(2);
  };

  if (loading) {
    return (
      <div className="text-center text-white/70 py-8">
        <Loader2 className="animate-spin inline-block" size={24} />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-3 drop-shadow-lg flex items-center gap-2">
        <Sparkles size={20} />
        {t('subscription.packs.title')}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {packs.map((pack) => {
          const colorClass = getPackColor(pack.name);
          const icon = getPackIcon(pack.creditAmount);
          const unitPrice = calculateUnitPrice(pack.price, pack.creditAmount);

          return (
            <div
              key={pack.id}
              className={`
                backdrop-blur-md bg-gradient-to-br ${colorClass}
                border rounded-xl p-4 shadow-lg transition-all md:hover:scale-105
              `}
            >
              {/* Header */}
              <div className="text-center mb-3">
                <div className="text-3xl mb-2">{icon}</div>
                <h3 className="text-lg font-bold text-white mb-0.5">
                  {pack.creditAmount} {t('subscription.packs.credits')}
                </h3>
                {pack.description && (
                  <div className="text-xs text-white/70">{pack.description}</div>
                )}
              </div>

              {/* Credits */}
              <div className="text-center mb-3">
                <div className="text-4xl font-bold text-white mb-0.5">
                  {pack.creditAmount}
                </div>
                <div className="text-xs text-white/60">{t('subscription.packs.credits')}</div>
              </div>

              {/* Price */}
              <div className="text-center mb-3">
                <div className="text-2xl font-bold text-white">{pack.price}€</div>
                <div className="text-xs text-white/60 mt-0.5">
                  {t('subscription.packs.pricePerCredit', { price: unitPrice })}
                </div>
              </div>

              {/* CTA Button */}
              <button
                onClick={() => handlePurchase(pack.id)}
                disabled={processingPackId === pack.id}
                className="w-full py-2 px-3 rounded-lg bg-white hover:bg-white/90 text-gray-900 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processingPackId === pack.id ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    {t('subscription.packs.redirecting')}
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    {t('subscription.packs.buyButton')}
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-xs text-white/60 text-center">
        {t('subscription.packs.securePayment')}
      </div>
    </div>
  );
}
