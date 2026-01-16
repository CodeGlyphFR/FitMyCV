'use client';

import { useState } from 'react';

/**
 * Zone de danger avec actions irréversibles
 */
export function SettingsDangerZone({ onDeleteAnalytics }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAllData() {
    setDeleting(true);
    try {
      await onDeleteAnalytics();
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        <p className="text-white/60 text-sm">
          Cette action supprimera définitivement <strong className="text-white">toutes</strong> les données analytics :
          événements de télémétrie, utilisations de features, appels OpenAI et statistiques d'usage.
        </p>
        <p className="text-red-400 text-sm font-medium">
          Cette opération est irréversible.
        </p>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full sm:w-auto px-4 py-2.5 bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500/30 transition backdrop-blur-xl font-medium text-sm"
        >
          Supprimer toutes les données analytics
        </button>
      </div>

      {/* Modal de confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900/95 backdrop-blur-xl rounded-lg shadow-2xl border border-red-500/30 p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-red-400 mb-4">Confirmation requise</h3>
            <p className="text-white/80 mb-2">
              Êtes-vous absolument certain de vouloir supprimer <strong className="text-white">toutes</strong> les données analytics ?
            </p>
            <p className="text-white/60 text-sm mb-4">
              Cette action va supprimer :
            </p>
            <ul className="text-sm text-white/60 mb-6 space-y-1 list-disc list-inside">
              <li>Tous les événements de télémétrie</li>
              <li>Toutes les utilisations de features</li>
              <li>Tous les appels OpenAI</li>
              <li>Toutes les statistiques d'usage</li>
            </ul>
            <p className="text-red-400 font-semibold mb-6 text-sm">
              Cette action est définitive et ne peut pas être annulée.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="w-full sm:w-auto px-4 py-2.5 bg-white/10 text-white border border-white/20 rounded-lg hover:bg-white/20 transition disabled:opacity-50 text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteAllData}
                disabled={deleting}
                className="w-full sm:w-auto px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {deleting ? 'Suppression...' : 'Oui, supprimer tout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
