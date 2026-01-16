'use client';

/**
 * Header pour la page Settings (titre uniquement)
 */
export function SettingsHeader({ hasChanges, modifiedCount }) {
  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-4 sm:p-6 border border-white/20">
      <h3 className="text-lg font-semibold text-white">Paramètres système</h3>
      <p className="text-sm text-white/60 mt-1">
        {hasChanges
          ? `${modifiedCount} modification${modifiedCount > 1 ? 's' : ''} en attente`
          : 'Aucune modification'
        }
      </p>
    </div>
  );
}

/**
 * Footer avec boutons Sauvegarder/Annuler (en bas à gauche)
 */
export function SettingsFooter({
  hasChanges,
  saving,
  onSave,
  onCancel,
}) {
  return (
    <div className="flex gap-3">
      {hasChanges && (
        <button
          onClick={onCancel}
          className="px-4 py-2.5 bg-white/10 text-white/80 border border-white/20 rounded-lg hover:bg-white/20 transition backdrop-blur-xl text-sm font-medium"
        >
          Annuler
        </button>
      )}
      <button
        onClick={onSave}
        disabled={!hasChanges || saving}
        className={`px-4 py-2.5 rounded-lg transition backdrop-blur-xl text-sm font-medium ${
          hasChanges && !saving
            ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/50 hover:bg-emerald-500/40'
            : 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed'
        }`}
      >
        {saving ? 'Sauvegarde...' : 'Sauvegarder'}
      </button>
    </div>
  );
}
