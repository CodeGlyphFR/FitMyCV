"use client";

import React from "react";
import { Zap, Loader2, Sparkles } from "lucide-react";

export default function CreditPacksCards({ onPurchaseSuccess }) {
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
      <h2 className="text-xl font-semibold text-white mb-4 drop-shadow-lg flex items-center gap-2">
        <Sparkles size={24} />
        Acheter des crédits
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {packs.map((pack) => {
          const colorClass = getPackColor(pack.name);
          const icon = getPackIcon(pack.creditAmount);
          const unitPrice = calculateUnitPrice(pack.price, pack.creditAmount);

          return (
            <div
              key={pack.id}
              className={`
                backdrop-blur-md bg-gradient-to-br ${colorClass}
                border rounded-xl p-6 shadow-lg transition-all hover:scale-105
              `}
            >
              {/* Header */}
              <div className="text-center mb-4">
                <div className="text-4xl mb-3">{icon}</div>
                <h3 className="text-xl font-bold text-white mb-1">{pack.name}</h3>
                <div className="text-sm text-white/70">{pack.description}</div>
              </div>

              {/* Credits */}
              <div className="text-center mb-4">
                <div className="text-5xl font-bold text-white mb-1">
                  {pack.creditAmount}
                </div>
                <div className="text-sm text-white/60">crédits</div>
              </div>

              {/* Price */}
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-white">{pack.price}€</div>
                <div className="text-xs text-white/60 mt-1">
                  soit {unitPrice}€ par crédit
                </div>
              </div>

              {/* CTA Button */}
              <button
                onClick={() => handlePurchase(pack.id)}
                disabled={processingPackId === pack.id}
                className="w-full py-3 px-4 rounded-lg bg-white hover:bg-white/90 text-gray-900 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processingPackId === pack.id ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Redirection...
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    Acheter
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 text-sm text-white/60 text-center">
        💳 Paiement sécurisé via Stripe • Crédits permanents
      </div>
    </div>
  );
}
