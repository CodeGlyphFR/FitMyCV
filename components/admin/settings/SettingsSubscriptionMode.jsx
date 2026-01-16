'use client';

import { useState } from 'react';
import { ToggleSwitch } from '../ToggleSwitch';

/**
 * Section Mode Abonnement dans la catégorie Crédits
 */
export function SettingsSubscriptionMode({
  subscriptionMode,
  onToggle,
  onCancelAll,
}) {
  const [showCancelAllConfirm, setShowCancelAllConfirm] = useState(false);
  const [cancelAllPreview, setCancelAllPreview] = useState(null);
  const [cancellingAll, setCancellingAll] = useState(false);

  async function fetchCancelAllPreview() {
    try {
      const res = await fetch('/api/admin/cancel-all-subscriptions');
      const data = await res.json();
      setCancelAllPreview(data);
    } catch (error) {
      console.error('Error fetching cancel preview:', error);
    }
  }

  async function handleCancelAllSubscriptions() {
    setCancellingAll(true);
    try {
      await onCancelAll();
      setShowCancelAllConfirm(false);
      setCancelAllPreview(null);
    } finally {
      setCancellingAll(false);
    }
  }

  if (subscriptionMode.loading) {
    return <div className="text-white/60 text-sm py-4">Chargement...</div>;
  }

  return (
    <>
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <h5 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
          <span className="w-1 h-4 bg-blue-400 rounded"></span>
          Mode Abonnement
        </h5>

        <div className="space-y-3">
          {/* Toggle mode abonnement */}
          <div className="flex items-start sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium">Mode abonnement</p>
              <p className="text-white/60 text-xs mt-1">
                {subscriptionMode.enabled
                  ? 'Plans + limites mensuelles + crédits pour dépasser'
                  : 'Mode crédits uniquement - toutes features accessibles avec crédits'}
              </p>
            </div>
            <div className="flex-shrink-0">
              <ToggleSwitch
                enabled={subscriptionMode.enabled}
                onChange={onToggle}
              />
            </div>
          </div>

          {/* Statistiques compactes */}
          <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
            <span className="text-white/70 text-xs">Abonnés payants actifs :</span>
            <span className="text-lg font-bold text-blue-400">
              {subscriptionMode.paidSubscribersCount}
            </span>
          </div>

          {/* Bouton annuler tous les abonnements */}
          {subscriptionMode.paidSubscribersCount > 0 && !subscriptionMode.enabled && (
            <div className="border-t border-white/10 pt-3">
              <p className="text-orange-300 text-xs mb-2">
                Pour basculer complètement en mode crédits, annulez tous les abonnements payants.
              </p>
              <button
                onClick={() => {
                  fetchCancelAllPreview();
                  setShowCancelAllConfirm(true);
                }}
                className="w-full sm:w-auto px-3 py-1.5 text-xs bg-orange-500/20 text-orange-400 border border-orange-500/50 rounded-lg hover:bg-orange-500/30 transition font-medium"
              >
                Annuler tous les abonnements payants
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal d'annulation massive */}
      {showCancelAllConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900/95 backdrop-blur-xl rounded-lg shadow-2xl border border-orange-500/30 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-orange-400 mb-4">
              Annuler tous les abonnements payants ?
            </h3>

            {cancelAllPreview ? (
              <>
                <div className="bg-white/10 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-orange-400">
                        {cancelAllPreview.subscriptionsCount}
                      </p>
                      <p className="text-xs text-white/60">abonnements à annuler</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-400">
                        {cancelAllPreview.totalRefund?.toFixed(2)} {cancelAllPreview.currency}
                      </p>
                      <p className="text-xs text-white/60">remboursement estimé</p>
                    </div>
                  </div>
                </div>

                {cancelAllPreview.subscriptions?.length > 0 && (
                  <div className="mb-4 max-h-40 overflow-y-auto">
                    <p className="text-white/70 text-sm mb-2">Abonnements concernés :</p>
                    <div className="space-y-1">
                      {cancelAllPreview.subscriptions.map((sub, i) => (
                        <div key={i} className="text-xs text-white/60 flex justify-between">
                          <span className="truncate">{sub.userEmail}</span>
                          <span className="flex-shrink-0 ml-2">
                            {sub.planName} ({sub.prorataAmount?.toFixed(2)} {sub.currency})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-orange-300 text-sm mb-6">
                  Cette action va annuler tous les abonnements Stripe et rembourser les utilisateurs au prorata.
                  <strong className="text-white"> Cette opération est irréversible.</strong>
                </p>
              </>
            ) : (
              <div className="text-white/60 py-4">Chargement de la prévisualisation...</div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => {
                  setShowCancelAllConfirm(false);
                  setCancelAllPreview(null);
                }}
                disabled={cancellingAll}
                className="w-full sm:w-auto px-4 py-2.5 bg-white/10 text-white border border-white/20 rounded-lg hover:bg-white/20 transition disabled:opacity-50 text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleCancelAllSubscriptions}
                disabled={cancellingAll || !cancelAllPreview}
                className="w-full sm:w-auto px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {cancellingAll ? 'Annulation en cours...' : 'Confirmer l\'annulation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
