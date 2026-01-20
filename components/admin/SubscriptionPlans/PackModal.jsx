'use client';

import { CustomSelect } from '../CustomSelect';
import { ToggleSwitch } from '../ToggleSwitch';

/**
 * Modal for creating/editing a credit pack
 */
export function PackModal({ title, formData, setFormData, onSave, onCancel, updating }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-[9999] p-4 pt-32 overflow-y-auto">
      <div className="bg-gray-900 border border-white/20 rounded-lg p-6 max-w-2xl w-full my-8">
        <h3 className="text-xl font-bold text-white mb-6">{title}</h3>

        <div className="space-y-6">
          {/* Generated name preview */}
          {formData.creditAmount > 0 && (
            <div className="px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="text-xs text-blue-300 mb-1">Nom du pack (généré automatiquement) :</div>
              <div className="text-lg text-blue-400 font-semibold">{formData.creditAmount} Crédits</div>
            </div>
          )}

          {/* Credit amount */}
          <div>
            <label className="text-white/60 text-sm mb-2 block">Nombre de crédits *</label>
            <input
              type="number"
              min="1"
              value={formData.creditAmount}
              onChange={(e) => setFormData({ ...formData, creditAmount: parseInt(e.target.value, 10) || 0 })}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-hidden focus:border-blue-400/50 transition"
            />
          </div>

          {/* Price and Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white/60 text-sm mb-2 block">Prix *</label>
              <input
                type="text"
                inputMode="decimal"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-hidden focus:border-blue-400/50 transition"
              />
            </div>

            <div>
              <label className="text-white/60 text-sm mb-2 block">Devise *</label>
              <CustomSelect
                value={formData.priceCurrency}
                onChange={(value) => setFormData({ ...formData, priceCurrency: value })}
                options={[
                  { value: 'EUR', label: 'EUR (€)' },
                  { value: 'USD', label: 'USD ($)' },
                  { value: 'GBP', label: 'GBP (£)' },
                ]}
              />
            </div>
          </div>

          {/* Calculated unit price */}
          {formData.creditAmount > 0 && formData.price > 0 && (
            <div className="text-sm text-white/40 bg-white/5 p-3 rounded-sm border border-white/10">
              Prix par crédit : <strong className="text-white/60">{(formData.price / formData.creditAmount).toFixed(2)} {formData.priceCurrency}</strong>
            </div>
          )}

          {/* Active status */}
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
            <div>
              <div className="text-white font-medium">Pack actif</div>
              <div className="text-xs text-white/40 mt-1">
                Les packs désactivés ne sont pas affichés aux utilisateurs
              </div>
            </div>
            <ToggleSwitch
              enabled={formData.isActive}
              onChange={(enabled) => setFormData({ ...formData, isActive: enabled })}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-white/10">
          <button
            onClick={onCancel}
            disabled={updating}
            className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Annuler
          </button>
          <button
            onClick={onSave}
            disabled={updating}
            className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updating ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
