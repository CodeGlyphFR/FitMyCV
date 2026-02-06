'use client';

import { useState, useEffect } from 'react';
import { KPICard } from './KPICard';
import { Toast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import { MACRO_FEATURES } from '@/lib/subscription/macroFeatures';
import {
  PlanModal,
  PackModal,
  usePlansManagement,
  usePacksManagement
} from './SubscriptionPlans';

// Helper functions for margin colors
function getMarginColor(marginPercent) {
  if (marginPercent === null || marginPercent === undefined) return 'text-white/40';
  if (marginPercent < 50) return 'text-red-400';
  if (marginPercent < 70) return 'text-orange-400';
  return 'text-green-400';
}

function getMarginBgColor(marginPercent) {
  if (marginPercent === null || marginPercent === undefined) return 'bg-white/5 border-white/10';
  if (marginPercent < 50) return 'bg-red-500/10 border-red-500/30';
  if (marginPercent < 70) return 'bg-orange-500/10 border-orange-500/30';
  return 'bg-green-500/10 border-green-500/30';
}

export function SubscriptionPlansTab({ refreshKey }) {
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Plans management hook
  const plans = usePlansManagement({
    onToast: setToast,
    onConfirm: setConfirmDialog,
  });

  // Packs management hook
  const packs = usePacksManagement({
    onToast: setToast,
    onConfirm: setConfirmDialog,
  });

  // Refresh on refreshKey change
  useEffect(() => {
    plans.fetchPlans();
    packs.fetchPacks();
  }, [refreshKey]);

  if (plans.loading && plans.plans.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white/60">Chargement des plans d'abonnement...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* KPI Cards - Plans & Packs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* KPI Plans */}
        <KPICard
          icon="💳"
          label="Plans disponibles"
          value={plans.plans.length}
          subtitle="au total"
          description="Nombre total de plans d'abonnement configurés"
        />
        <KPICard
          icon="💰"
          label="Plan le plus cher"
          value={
            plans.plans.length > 0
              ? `${Math.max(...plans.plans.map((p) => p.priceMonthly)).toFixed(2)} €`
              : '-'
          }
          subtitle="par mois"
          description="Tarif mensuel le plus élevé parmi les plans disponibles"
        />
        <KPICard
          icon="🎁"
          label="Plans gratuits"
          value={plans.plans.filter((p) => p.priceMonthly === 0).length}
          subtitle="disponibles"
          description="Nombre de plans avec un tarif gratuit"
        />

        {/* KPI Packs */}
        <KPICard
          icon="🎫"
          label="Packs disponibles"
          value={packs.packs.length}
          subtitle="au total"
          description="Nombre total de packs de crédits configurés"
        />
        <KPICard
          icon="💵"
          label="Pack le plus cher"
          value={
            packs.packs.length > 0
              ? `${Math.max(...packs.packs.map((p) => p.price)).toFixed(2)} €`
              : '-'
          }
          subtitle="prix maximum"
          description="Prix le plus élevé parmi les packs disponibles"
        />
        <KPICard
          icon="⚡"
          label="Crédits moyens/pack"
          value={
            packs.packs.length > 0
              ? Math.round(packs.packs.reduce((sum, p) => sum + p.creditAmount, 0) / packs.packs.length)
              : 0
          }
          subtitle="crédits"
          description="Nombre moyen de crédits par pack"
        />
      </div>

      {/* Create plan button */}
      <div className="flex justify-end">
        <button
          onClick={plans.openCreateModal}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Créer un plan
        </button>
      </div>

      {/* Plans Section Title */}
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <span>💳</span> Plans d'abonnement
      </h2>

      {/* Plans List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            planCosts={plans.planCosts}
            costsLoading={plans.costsLoading}
            updating={plans.updating}
            onEdit={() => plans.openEditModal(plan)}
            onDelete={() => plans.handleDeletePlan(plan)}
          />
        ))}
      </div>

      {/* CREDIT PACKS SECTION */}
      <div className="mt-12 pt-8 border-t border-white/20">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
          <span>🎫</span> Packs de crédits
        </h2>

        <div className="flex justify-end mb-6">
          <button
            onClick={packs.openCreateModal}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Créer un pack
          </button>
        </div>

        {/* Packs List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packs.packs.map((pack) => (
            <PackCard
              key={pack.id}
              pack={pack}
              updating={packs.updating}
              onEdit={() => packs.openEditModal(pack)}
              onDelete={() => packs.handleDeletePack(pack)}
            />
          ))}
        </div>
      </div>

      {/* Modals */}
      {plans.showCreateModal && (
        <PlanModal
          title="Créer un plan d'abonnement"
          formData={plans.formData}
          setFormData={plans.setFormData}
          featureLimits={plans.featureLimits}
          setFeatureLimits={plans.setFeatureLimits}
          onSave={plans.handleCreatePlan}
          onCancel={plans.closeCreateModal}
          updating={plans.updating}
        />
      )}

      {plans.showEditModal && plans.selectedPlan && (
        <PlanModal
          title={`Éditer le plan "${plans.selectedPlan.name}"`}
          formData={plans.formData}
          setFormData={plans.setFormData}
          featureLimits={plans.featureLimits}
          setFeatureLimits={plans.setFeatureLimits}
          onSave={plans.handleUpdatePlan}
          onCancel={plans.closeEditModal}
          updating={plans.updating}
        />
      )}

      {packs.showCreateModal && (
        <PackModal
          title="Créer un pack de crédits"
          formData={packs.formData}
          setFormData={packs.setFormData}
          onSave={packs.handleCreatePack}
          onCancel={packs.closeCreateModal}
          updating={packs.updating}
        />
      )}

      {packs.showEditModal && packs.selectedPack && (
        <PackModal
          title={`Éditer le pack "${packs.selectedPack.name}"`}
          formData={packs.formData}
          setFormData={packs.setFormData}
          onSave={packs.handleUpdatePack}
          onCancel={packs.closeEditModal}
          updating={packs.updating}
        />
      )}

      {/* Toast and Confirm Dialog */}
      <Toast toast={toast} onClose={() => setToast(null)} />
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}

// Plan Card Component
function PlanCard({ plan, planCosts, costsLoading, updating, onEdit, onDelete }) {
  const enabledFeatures = plan.featureLimits.filter((fl) => fl.isEnabled).length;
  const costs = planCosts[plan.name];

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6 hover:border-white/30 hover:bg-white/10 transition-all flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white">{plan.name}</h3>
          {plan.description && (
            <p className="text-sm text-white/60 mt-1">{plan.description}</p>
          )}
        </div>
        <div className="text-2xl">💳</div>
      </div>

      {/* Price */}
      <div className="mb-4 pb-4 border-b border-white/10">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-white">
            {plan.priceMonthly.toFixed(2)}
          </span>
          <span className="text-white/60">{plan.priceCurrency}/mois</span>
        </div>
        {plan.yearlyDiscountPercent > 0 && (
          <div className="text-sm text-green-400 mt-1">
            ou {plan.priceYearly.toFixed(2)} {plan.priceCurrency}/an (-
            {plan.yearlyDiscountPercent.toFixed(0)}%)
          </div>
        )}
      </div>

      {/* Features */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/60">Features activées</span>
          <span className="text-white font-medium">
            {enabledFeatures} / {Object.keys(MACRO_FEATURES).length}
          </span>
        </div>
      </div>

      {/* Costs & Margin */}
      {costs ? (
        <div className={`space-y-2 mb-4 p-3 rounded-lg border ${getMarginBgColor(costs.marginPercent)}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60 flex items-center gap-1">
              <span>💰</span> Coût API
            </span>
            <span className="text-white text-sm font-medium">
              ${costs.costMinUsd.toFixed(2)} / ${costs.costAvgUsd.toFixed(2)} / ${costs.costMaxUsd.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60 flex items-center gap-1">
              <span>📊</span> Marge
            </span>
            <span className={`text-sm font-medium ${getMarginColor(costs.marginPercent)}`}>
              {costs.grossMarginEur.toFixed(2)} € ({costs.marginPercent.toFixed(0)}%)
            </span>
          </div>

          {costs.marginPercent < 70 && (
            <div className={`text-xs mt-1 ${costs.marginPercent < 50 ? 'text-red-300' : 'text-orange-300'}`}>
              {costs.marginPercent < 50
                ? '⚠️ Marge critique - Risque de perte'
                : '⚠️ Marge faible - À surveiller'}
            </div>
          )}
        </div>
      ) : costsLoading ? (
        <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10 animate-pulse">
          <div className="h-4 bg-white/10 rounded w-2/3 mb-2"></div>
          <div className="h-4 bg-white/10 rounded w-1/2"></div>
        </div>
      ) : (
        <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
          <span className="text-xs text-white/40">Données de coût non disponibles</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        <button
          onClick={onEdit}
          disabled={updating}
          className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Éditer
        </button>
        <button
          onClick={onDelete}
          disabled={updating}
          className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}

// Pack Card Component
function PackCard({ pack, updating, onEdit, onDelete }) {
  return (
    <div
      className={`bg-white/5 backdrop-blur-xl rounded-lg border p-6 hover:border-white/30 hover:bg-white/10 transition-all flex flex-col ${
        pack.isActive ? 'border-white/10' : 'border-red-500/30 opacity-60'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white">{pack.name}</h3>
          {pack.description && (
            <p className="text-sm text-white/60 mt-1">{pack.description}</p>
          )}
          {!pack.isActive && (
            <span className="inline-block mt-2 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
              Désactivé
            </span>
          )}
        </div>
        <div className="text-2xl">🎫</div>
      </div>

      {/* Price and Credits */}
      <div className="mb-4 pb-4 border-b border-white/10">
        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-3xl font-bold text-white">
            {pack.price.toFixed(2)}
          </span>
          <span className="text-white/60">{pack.priceCurrency}</span>
        </div>
        <div className="text-sm text-green-400">
          {pack.creditAmount} crédits
        </div>
        <div className="text-xs text-white/40 mt-1">
          {(pack.price / pack.creditAmount).toFixed(2)} {pack.priceCurrency}/crédit
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        <button
          onClick={onEdit}
          disabled={updating}
          className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Éditer
        </button>
        <button
          onClick={onDelete}
          disabled={updating}
          className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
