"use client";

import React from "react";
import { Check, Crown, Zap, Target, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";

export default function PlanComparisonCards({ currentPlan, subscription, onUpgradeSuccess }) {
  const [plans, setPlans] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [processingPlanId, setProcessingPlanId] = React.useState(null);
  const [showDowngradeModal, setShowDowngradeModal] = React.useState(false);
  const [isDowngrading, setIsDowngrading] = React.useState(false);
  const [downgradePlanId, setDowngradePlanId] = React.useState(null);

  // Charger les plans disponibles
  React.useEffect(() => {
    async function fetchPlans() {
      try {
        const res = await fetch('/api/subscription/plans');
        if (res.ok) {
          const data = await res.json();
          setPlans(data.plans || []);
        }
      } catch (error) {
        console.error('Error fetching plans:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, []);

  const handlePlanChange = async (planId, billingPeriod) => {
    try {
      // Trouver le plan sélectionné pour vérifier s'il est gratuit
      const selectedPlan = plans.find(p => p.id === planId);
      const isFreeplan = selectedPlan && (selectedPlan.priceMonthly === 0 || selectedPlan.name === 'Gratuit');

      // Si c'est un downgrade vers Gratuit, ouvrir le modal de confirmation
      if (isFreeplan) {
        setDowngradePlanId(planId);
        setShowDowngradeModal(true);
        return;
      }

      setProcessingPlanId(planId);

      // Sinon, upgrade via Stripe Checkout
      const res = await fetch('/api/checkout/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingPeriod }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Erreur lors de la création de la session de paiement');
        setProcessingPlanId(null);
        return;
      }

      const { url, updated } = await res.json();

      // Si l'abonnement a été mis à jour directement (pas de checkout Stripe)
      // La DB est déjà mise à jour, pas besoin d'attendre

      // Rediriger vers la page appropriée (Stripe Checkout OU page de succès)
      window.location.href = url;
    } catch (error) {
      console.error('Error changing plan:', error);
      alert('Erreur lors du changement de plan');
      setProcessingPlanId(null);
    }
  };

  const getPlanIcon = (planName) => {
    if (planName === "Premium") return Crown;
    if (planName === "Pro") return Zap;
    return Target;
  };

  const getPlanColor = (planName) => {
    if (planName === "Premium") return "from-purple-500/20 to-pink-500/20 border-purple-500/50";
    if (planName === "Pro") return "from-blue-500/20 to-cyan-500/20 border-blue-500/50";
    return "from-gray-500/20 to-gray-600/20 border-gray-500/50";
  };

  const handleConfirmDowngrade = async () => {
    setIsDowngrading(true);
    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ immediate: false }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erreur lors de l\'annulation');
      }

      setShowDowngradeModal(false);

      // Rafraîchir la page pour afficher les nouvelles données
      window.location.reload();
    } catch (error) {
      console.error('Erreur downgrade:', error);
      alert(error.message);
    } finally {
      setIsDowngrading(false);
    }
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
      <h2 className="text-xl font-semibold text-white mb-4 drop-shadow-lg">
        Plans disponibles
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const Icon = getPlanIcon(plan.name);
          const isCurrentPlan = currentPlan?.id === plan.id;
          const isDowngrade = currentPlan?.id > plan.id;
          const isUpgrade = currentPlan?.id < plan.id;
          const colorClass = getPlanColor(plan.name);

          // Bloquer le downgrade vers Gratuit si l'annulation est déjà programmée
          const isFreeplan = plan.priceMonthly === 0 || plan.name === 'Gratuit';
          const isDowngradeToFree = isFreeplan && isDowngrade;
          const isAlreadyCanceled = subscription?.cancelAtPeriodEnd;
          const shouldBlockDowngrade = isDowngradeToFree && isAlreadyCanceled;

          return (
            <div
              key={plan.id}
              className={`
                backdrop-blur-md bg-gradient-to-br ${colorClass}
                border rounded-xl p-6 shadow-lg transition-all
                ${isCurrentPlan ? 'ring-2 ring-white/50' : ''}
              `}
            >
              {/* Header */}
              <div className="text-center mb-6">
                <Icon className="mx-auto mb-3 text-white" size={32} />
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                {isCurrentPlan && (
                  <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs text-white font-medium">
                    Plan actuel
                  </span>
                )}
              </div>

              {/* Pricing */}
              <div className="text-center mb-6">
                {plan.id === 1 ? (
                  <div>
                    <div className="text-4xl font-bold text-white">Gratuit</div>
                    <div className="text-sm text-white/60 mt-1">Pour toujours</div>
                  </div>
                ) : (
                  <div>
                    <div className="text-4xl font-bold text-white">{plan.priceMonthly}€</div>
                    <div className="text-sm text-white/60 mt-1">par mois</div>
                    {plan.priceYearly && (
                      <div className="text-xs text-white/50 mt-2">
                        ou {plan.priceYearly}€/an
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="space-y-3 mb-6">
                {plan.featureLimits && plan.featureLimits.slice(0, 4).map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-white">
                    <Check size={16} className="flex-shrink-0" />
                    <span>
                      {feature.usageLimit === -1
                        ? `${feature.featureName} illimité`
                        : `${feature.usageLimit} ${feature.featureName}/mois`}
                    </span>
                  </div>
                ))}

                {plan.featureLimits && plan.featureLimits.length > 4 && (
                  <div className="text-xs text-white/60 pl-6">
                    + {plan.featureLimits.length - 4} autres features
                  </div>
                )}
              </div>

              {/* CTA Button */}
              {isCurrentPlan ? (
                <button
                  disabled
                  className="w-full py-3 px-4 rounded-lg bg-white/10 border border-white/30 text-white font-medium cursor-not-allowed"
                >
                  Plan actuel
                </button>
              ) : shouldBlockDowngrade ? (
                <button
                  disabled
                  className="w-full py-3 px-4 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-300 font-medium cursor-not-allowed text-sm"
                >
                  Downgrade déjà programmé
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => handlePlanChange(plan.id, 'monthly')}
                    disabled={processingPlanId === plan.id}
                    className="w-full py-3 px-4 rounded-lg bg-white hover:bg-white/90 text-gray-900 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {processingPlanId === plan.id ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        {isFreeplan ? 'Programmation...' : 'Redirection...'}
                      </>
                    ) : (
                      <>{isDowngrade ? 'Downgrade' : 'Upgrade'} {plan.priceYearly ? 'Mensuel' : ''}</>
                    )}
                  </button>
                  {plan.priceYearly && (
                    <button
                      onClick={() => handlePlanChange(plan.id, 'yearly')}
                      disabled={processingPlanId === plan.id}
                      className="w-full py-2 px-4 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ou Annuel (-17%)
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 text-sm text-white/60 text-center">
        💳 Paiement sécurisé via Stripe • Annulable à tout moment
      </div>

      {/* Modal de confirmation de downgrade vers Gratuit */}
      <Modal
        open={showDowngradeModal}
        onClose={() => setShowDowngradeModal(false)}
        title="Downgrade vers le plan Gratuit ?"
      >
        <div className="space-y-4">
          <p className="text-white/90">
            Si vous passez au plan Gratuit :
          </p>
          <ul className="space-y-2 text-white/80">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>Vous conserverez l'accès à votre plan actuel jusqu'au <strong className="text-white">{new Date(subscription?.currentPeriodEnd).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>Vous passerez automatiquement au <strong className="text-white">plan Gratuit</strong> à cette date</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>Vous pourrez upgrader à tout moment</span>
            </li>
          </ul>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowDowngradeModal(false)}
              disabled={isDowngrading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors disabled:opacity-50 font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirmDowngrade}
              disabled={isDowngrading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors disabled:opacity-50 font-medium"
            >
              {isDowngrading ? 'Programmation...' : 'Confirmer'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
