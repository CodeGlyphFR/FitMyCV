'use client';

/**
 * Modal de confirmation pour l'activation du mode maintenance
 */
export function MaintenanceConfirmModal({
  show,
  maintenanceInfo,
  onConfirm,
  onCancel,
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900/95 backdrop-blur-xl rounded-lg shadow-2xl border border-orange-500/30 p-6 max-w-md w-full">
        <h3 className="text-xl font-semibold text-orange-400 mb-4">
          Activer le mode maintenance ?
        </h3>
        <p className="text-white/80 mb-4">
          Cette action va <strong className="text-white">déconnecter</strong> tous les utilisateurs non-admin à leur prochaine action.
        </p>
        {maintenanceInfo && (
          <div className="bg-white/10 rounded-lg p-4 mb-4">
            <p className="text-white/70 text-sm mb-2">Sessions potentiellement affectées :</p>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-400">
                  {maintenanceInfo.recentActiveUsers}
                </p>
                <p className="text-xs text-white/60">utilisateurs actifs</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-white/60">
                  (derniers {maintenanceInfo.sessionMaxAgeDays} jours)
                </p>
              </div>
            </div>
          </div>
        )}
        <p className="text-orange-300 text-sm mb-6">
          Les formulaires de connexion seront masqués. Seuls les administrateurs pourront se connecter.
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2.5 bg-white/10 text-white border border-white/20 rounded-lg hover:bg-white/20 transition text-sm"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="w-full sm:w-auto px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition text-sm font-medium"
          >
            Activer la maintenance
          </button>
        </div>
      </div>
    </div>
  );
}
