'use client';

import {
  getSettingLabel,
  getPdfImportStructure,
  getPdfImportConfig,
} from '@/lib/admin/settingsConfig';
import { CustomSelect } from '../CustomSelect';

/**
 * Composant pour afficher les paramètres PDF Import avec sliders et select
 */
export function PdfImportSettings({
  settings,
  modifiedSettings,
  onValueChange,
  getCurrentValue,
}) {
  const structure = getPdfImportStructure();
  const config = getPdfImportConfig();

  const settingsByName = settings.reduce((acc, setting) => {
    acc[setting.settingName] = setting;
    return acc;
  }, {});

  function renderSlider(setting, settingConfig) {
    const currentValue = getCurrentValue(setting);
    const isModified = modifiedSettings[setting.id] !== undefined;
    const numValue = parseFloat(currentValue);

    return (
      <div
        key={setting.id}
        className={`p-4 rounded-lg transition-colors ${
          isModified ? 'bg-blue-500/10 border border-blue-400/30' : 'bg-white/5'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">
              {getSettingLabel(setting.settingName)}
            </span>
            {isModified && (
              <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded">
                modifié
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-mono text-white font-semibold">
              {Number.isInteger(numValue) ? numValue : numValue.toFixed(2)}
            </span>
            <span className="text-sm text-white/60">{settingConfig.unit}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-white/50 w-8">{settingConfig.min}</span>
          <input
            type="range"
            min={settingConfig.min}
            max={settingConfig.max}
            step={settingConfig.step}
            value={numValue}
            onChange={(e) => onValueChange(setting.id, e.target.value)}
            className="flex-1 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:bg-sky-500
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition
              [&::-webkit-slider-thumb]:hover:bg-sky-400
              [&::-moz-range-thumb]:w-4
              [&::-moz-range-thumb]:h-4
              [&::-moz-range-thumb]:bg-sky-500
              [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:cursor-pointer"
          />
          <span className="text-xs text-white/50 w-8 text-right">{settingConfig.max}</span>
        </div>

        {setting.description && (
          <p className="text-xs text-white/60 mt-3">{setting.description}</p>
        )}
      </div>
    );
  }

  function renderSelect(setting, settingConfig) {
    const currentValue = getCurrentValue(setting);
    const isModified = modifiedSettings[setting.id] !== undefined;

    const options = settingConfig.options.map((opt) => ({
      value: opt,
      label: opt.charAt(0).toUpperCase() + opt.slice(1),
    }));

    return (
      <div
        key={setting.id}
        className={`p-4 rounded-lg transition-colors ${
          isModified ? 'bg-blue-500/10 border border-blue-400/30' : 'bg-white/5'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">
                {getSettingLabel(setting.settingName)}
              </span>
              {isModified && (
                <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded">
                  modifié
                </span>
              )}
            </div>
            {setting.description && (
              <p className="text-xs text-white/60 mt-1">{setting.description}</p>
            )}
          </div>
          <div className="flex-shrink-0">
            <CustomSelect
              value={currentValue}
              onChange={(value) => onValueChange(setting.id, value)}
              options={options}
              className="w-32"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Note explicative */}
      <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-3">
        <p className="text-xs text-sky-300">
          <strong>Note :</strong> Ces paramètres affectent la conversion des PDF en images
          pour l'analyse Vision AI. Des valeurs plus élevées améliorent la qualité mais
          augmentent les coûts en tokens.
        </p>
      </div>

      {Object.entries(structure).map(([groupLabel, settingNames]) => (
        <div key={groupLabel}>
          <h5 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-sky-400 rounded"></span>
            {groupLabel}
          </h5>
          <div className="space-y-3">
            {settingNames.map((settingName) => {
              const setting = settingsByName[settingName];
              const settingConfig = config[settingName];

              if (!setting || !settingConfig) return null;

              return settingConfig.type === 'slider'
                ? renderSlider(setting, settingConfig)
                : renderSelect(setting, settingConfig);
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
