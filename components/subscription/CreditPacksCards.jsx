"use client";

import React from "react";
import { Zap, Loader2, Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function CreditPacksCards({ onPurchaseSuccess }) {
  const { t, language } = useLanguage();
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
        body: JSON.stringify({ packId, locale: language }),
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

  const getPackIcon = (price) => {
    if (price >= 35) return "💎";
    if (price >= 25) return "⚡";
    if (price >= 14) return "🔥";
    return "✨";
  };

  // Calculer le prix de base (pack le plus cher par crédit) pour déterminer les réductions
  const baseUnitPrice = React.useMemo(() => {
    if (packs.length === 0) return 0;
    return Math.max(...packs.map(p => p.price / p.creditAmount));
  }, [packs]);

  const calculateDiscount = (price, credits) => {
    if (baseUnitPrice === 0) return 0;
    const unitPrice = price / credits;
    const discount = ((baseUnitPrice - unitPrice) / baseUnitPrice) * 100;
    return Math.round(discount / 5) * 5; // Arrondi à 0 ou 5
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {packs.map((pack) => {
          const colorClass = getPackColor(pack.name);
          const icon = getPackIcon(pack.price);
          const discount = calculateDiscount(pack.price, pack.creditAmount);

          return (
            <div
              key={pack.id}
              className={`
                relative backdrop-blur-md bg-gradient-to-br ${colorClass}
                border rounded-xl p-4 shadow-lg transition-all md:hover:scale-105
              `}
            >
              {/* Badge réduction - style ruban */}
              {discount > 0 && (
                <div className="absolute top-0 right-0 z-10 overflow-hidden w-16 h-16 pointer-events-none">
                  <div className="absolute top-2 -right-5 rotate-45 bg-green-500 text-white text-[10px] font-bold py-1 w-20 text-center shadow-[0_2px_8px_rgba(34,197,94,0.6)]">
                    -{discount}%
                  </div>
                </div>
              )}

              {/* Header avec icône */}
              <div className="text-center mb-2">
                <div className="text-2xl mb-1">{icon}</div>
              </div>

              {/* Credits */}
              <div className="text-center mb-2">
                <div className="text-3xl font-bold text-white mb-0.5">
                  {pack.creditAmount}
                </div>
                <div className="text-xs text-white/60">{t('subscription.packs.credits')}</div>
              </div>

              {/* Price */}
              <div className="text-center mb-3">
                <div className="text-xl font-bold text-white">{pack.price}€</div>
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
