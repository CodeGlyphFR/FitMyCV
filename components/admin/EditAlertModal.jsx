'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { CustomSelect } from './CustomSelect';

/**
 * EditAlertModal - Modal popup for editing or creating an OpenAI alert
 *
 * @param {boolean} open - Whether the modal is open
 * @param {Function} onClose - Callback when modal is closed
 * @param {Object} alert - Alert object to edit (with id, type, threshold, name, description, enabled). If null, creates new alert.
 * @param {Function} onSave - Callback when alert is saved (receives updated alert data)
 * @param {Object} alertTypeLabels - Labels for alert types
 */
export default function EditAlertModal({ open, onClose, alert, onSave, alertTypeLabels }) {
  const isEditMode = alert !== null;

  // Default form state factory - single source of truth
  const getInitialFormState = (alertData) => {
    if (alertData) {
      return {
        type: alertData.type || 'user_daily',
        threshold: alertData.threshold || '',
        enabled: alertData.enabled ?? true,
        name: alertData.name || '',
        description: alertData.description || '',
      };
    }
    // Default state for create mode
    return {
      type: 'user_daily',
      threshold: '',
      enabled: true,
      name: '',
      description: '',
    };
  };

  const [formData, setFormData] = useState(() => getInitialFormState(alert));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Reset form when modal opens or alert changes
  useEffect(() => {
    setFormData(getInitialFormState(alert));
    setError(null);
  }, [alert, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      setError('Le nom est requis');
      return;
    }

    if (!formData.threshold || parseFloat(formData.threshold) < 0) {
      setError('Le seuil doit être un nombre positif');
      return;
    }

    // Validate type matches server-side validation
    const validTypes = ['user_daily', 'user_monthly', 'global_daily', 'global_monthly', 'feature_daily'];
    if (!validTypes.includes(formData.type)) {
      setError('Type d\'alerte invalide');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Include alert id only in edit mode
      const dataToSave = {
        ...formData,
        threshold: parseFloat(formData.threshold),
      };

      if (isEditMode) {
        dataToSave.id = alert.id;
      }

      await onSave(dataToSave);
      // Success - parent will close modal via onSave callback
    } catch (err) {
      // Capture error for inline display
      setError(err.message || 'Erreur lors de la sauvegarde');
      setIsSaving(false); // Keep modal open on error
    }
  };

  const handleCancel = () => {
    // Reset form to original alert data using factory
    setFormData(getInitialFormState(alert));
    setError(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title={isEditMode ? 'Modifier l\'alerte' : 'Créer une alerte'}
      size="default"
      disableBackdropClick={isSaving}
      disableEscapeKey={isSaving}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Alert Type */}
        <div>
          <label className="block text-sm font-medium text-white/80 mb-1">
            Type d'alerte
          </label>
          <CustomSelect
            value={formData.type}
            onChange={(value) => setFormData({ ...formData, type: value })}
            options={Object.entries(alertTypeLabels).map(([value, label]) => ({
              value,
              label,
            }))}
            placeholder="Sélectionner un type"
          />
        </div>

        {/* Threshold */}
        <div>
          <label className="block text-sm font-medium text-white/80 mb-1">
            Seuil ($) <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.threshold}
            onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none"
            placeholder="0.00"
            required
          />
          {!formData.threshold && (
            <p className="text-xs text-white/50 mt-1">Entrez le montant seuil en dollars</p>
          )}
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-white/80 mb-1">
            Nom <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none"
            placeholder="Nom de l'alerte"
            required
          />
          {!formData.name.trim() && (
            <p className="text-xs text-red-400/80 mt-1">Le nom est requis</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-white/80 mb-1">
            Description (optionnel)
          </label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none"
            placeholder="Description de l'alerte"
          />
        </div>

        {/* Enabled Checkbox */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="edit-enabled"
            checked={formData.enabled}
            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-2 focus:ring-emerald-400/50"
          />
          <label htmlFor="edit-enabled" className="text-sm text-white/80">
            Alerte activée
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSaving || !formData.name.trim() || !formData.threshold}
            title={!formData.name.trim() ? 'Veuillez saisir un nom' : (!formData.threshold ? 'Veuillez saisir un seuil' : '')}
            className="flex-1 px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Enregistrement...' : (isEditMode ? 'Mettre à jour' : 'Créer')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
