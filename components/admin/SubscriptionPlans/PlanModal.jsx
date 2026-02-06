'use client';

import { useLanguage } from '@/lib/i18n/LanguageContext';
import { getPlanNameByTier } from '@/lib/i18n/cvLabels';
import { CustomSelect } from '../CustomSelect';
import { ToggleSwitch } from '../ToggleSwitch';
import { MACRO_FEATURES } from '@/lib/subscription/macroFeatures';

/**
 * Modal for creating/editing a subscription plan
 */
export function PlanModal({ title, formData, setFormData, featureLimits, setFeatureLimits, onSave, onCancel, updating }) {
  const { t } = useLanguage();

  // Calculate annual discount in real-time
  const priceMonthly = parseFloat(formData.priceMonthly) || 0;
  const priceYearly = parseFloat(formData.priceYearly) || 0;
  const calculatedDiscount = priceMonthly > 0 && priceYearly > 0
    ? ((priceMonthly * 12 - priceYearly) / (priceMonthly * 12)) * 100
    : 0;

  // Get plan name in real-time based on tier
  const planName = getPlanNameByTier(formData.tier || 0, t);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-[9999] p-4 pt-24 overflow-y-auto">
      <div className="bg-gray-900 border border-white/20 rounded-lg p-4 max-w-3xl w-full my-6">
        <h3 className="text-lg font-bold text-white mb-4">{title}</h3>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide">
          {/* Section: Identification */}
          <div className="space-y-3">
            <h4 className="text-base font-semibold text-white border-b border-white/10 pb-2">
              Identification
            </h4>

            {/* Tier with name preview */}
            <div>
              <label className="text-white/60 text-sm mb-2 block">
                Niveau (Tier) *
              </label>
              <input
                type="number"
                min="0"
                value={formData.tier}
                onChange={(e) => setFormData({ ...formData, tier: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-hidden focus:border-blue-400/50 transition"
                placeholder="0, 1, 2, 3, 4..."
              />
              <div className="mt-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <span className="text-xs text-blue-300">Nom du plan : </span>
                <span className="text-sm text-blue-400 font-semibold">{planName}</span>
              </div>
              <p className="text-xs text-white/40 mt-1">
                0=Gratuit, 1=Pro, 2=Premium, 3=Business, 4=Enterprise
              </p>
            </div>

            {/* Free Plan and Popular Plan toggles */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <label className="text-white text-sm">Plan gratuit ?</label>
                <ToggleSwitch
                  enabled={formData.isFree}
                  onChange={(enabled) => setFormData({ ...formData, isFree: enabled })}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <label className="text-white text-sm">Plan recommandé ?</label>
                <ToggleSwitch
                  enabled={formData.isPopular}
                  onChange={(enabled) => setFormData({ ...formData, isPopular: enabled })}
                />
              </div>
            </div>

            {/* Warnings */}
            {formData.isFree && parseFloat(formData.priceMonthly) !== 0 && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-2 text-orange-300 text-xs">
                ⚠️ Un plan gratuit devrait avoir un prix de 0€
              </div>
            )}
          </div>

          {/* Section: Pricing */}
          <div className="space-y-3">
            <h4 className="text-base font-semibold text-white border-b border-white/10 pb-2">
              Tarification
            </h4>

            {/* Compact price grid */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-white/60 text-sm mb-2 block">Prix mensuel *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.priceMonthly}
                  onChange={(e) => setFormData({ ...formData, priceMonthly: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-hidden focus:border-blue-400/50 transition"
                  placeholder="9.99"
                />
              </div>

              <div>
                <label className="text-white/60 text-sm mb-2 block">Prix annuel *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.priceYearly}
                  onChange={(e) => setFormData({ ...formData, priceYearly: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-hidden focus:border-blue-400/50 transition"
                  placeholder="99.99"
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

            {/* Automatically calculated discount */}
            {calculatedDiscount > 0 && (
              <div className="px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                <span className="text-xs text-green-300">Réduction annuelle : </span>
                <span className="text-sm text-green-400 font-semibold">
                  {calculatedDiscount.toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Section: Features Configuration */}
          <div className="space-y-3">
            <h4 className="text-base font-semibold text-white border-b border-white/10 pb-2">
              Configuration des features
            </h4>

            <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
              <div className="overflow-x-auto scrollbar-hide">
                <table className="min-w-full divide-y divide-white/10 text-sm">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-white/60 uppercase">
                        Feature
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-white/60 uppercase">
                        Activée
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-white/60 uppercase">
                        Limite
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-white/60 uppercase">
                        Illimité
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {Object.entries(MACRO_FEATURES).map(([featureName, config]) => {
                      const limit = featureLimits[featureName] || {
                        isEnabled: true,
                        usageLimit: -1,
                      };

                      const isUnlimited = limit.usageLimit === -1;

                      return (
                        <tr key={featureName} className="hover:bg-white/5 transition">
                          {/* Feature name */}
                          <td className="px-3 py-2 text-xs text-white">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{config.icon}</span>
                              <div className="font-medium">{config.name}</div>
                            </div>
                          </td>

                          {/* Enabled */}
                          <td className="px-3 py-2 text-center">
                            <div className="flex justify-center">
                              <ToggleSwitch
                                enabled={limit.isEnabled}
                                onChange={(enabled) =>
                                  setFeatureLimits({
                                    ...featureLimits,
                                    [featureName]: {
                                      ...limit,
                                      isEnabled: enabled,
                                      usageLimit: enabled ? limit.usageLimit : 0
                                    },
                                  })
                                }
                              />
                            </div>
                          </td>

                          {/* Limit */}
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              value={isUnlimited ? '' : limit.usageLimit}
                              onChange={(e) =>
                                setFeatureLimits({
                                  ...featureLimits,
                                  [featureName]: {
                                    ...limit,
                                    usageLimit: parseInt(e.target.value, 10) || 0,
                                  },
                                })
                              }
                              disabled={!limit.isEnabled || isUnlimited}
                              placeholder={isUnlimited ? '∞' : '0'}
                              className="w-16 mx-auto block px-2 py-1 bg-white/10 border border-white/20 rounded-sm text-white text-xs text-center focus:outline-hidden focus:border-blue-400/50 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/5"
                            />
                          </td>

                          {/* Unlimited */}
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={isUnlimited}
                              onChange={(e) =>
                                setFeatureLimits({
                                  ...featureLimits,
                                  [featureName]: {
                                    ...limit,
                                    usageLimit: e.target.checked ? -1 : 0,
                                  },
                                })
                              }
                              disabled={!limit.isEnabled}
                              className="w-4 h-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-4 pt-3 border-t border-white/10">
          <button
            onClick={onCancel}
            disabled={updating}
            className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Annuler
          </button>
          <button
            onClick={onSave}
            disabled={updating}
            className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updating ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
