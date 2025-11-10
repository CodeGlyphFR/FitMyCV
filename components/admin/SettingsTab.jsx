'use client';

import { useState, useEffect } from 'react';
import { ToggleSwitch } from './ToggleSwitch';
import { CustomSelect } from './CustomSelect';
import { Toast } from './Toast';
import {
  getCategoryLabel,
  getSettingLabel,
  isHierarchicalCategory,
  getAIModelsStructure,
  AVAILABLE_AI_MODELS,
} from '@/lib/admin/settingsConfig';

export function SettingsTab({ refreshKey }) {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modifiedSettings, setModifiedSettings] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [toast, setToast] = useState(null);
  const [availableModels, setAvailableModels] = useState(AVAILABLE_AI_MODELS);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchAvailableModels();
  }, [refreshKey]);

  useEffect(() => {
    setHasChanges(Object.keys(modifiedSettings).length > 0);
  }, [modifiedSettings]);

  async function fetchAvailableModels() {
    try {
      const res = await fetch('/api/admin/openai-pricing');
      const data = await res.json();
      if (data.pricings && data.pricings.length > 0) {
        // Extract active model names from pricing data
        const models = data.pricings
          .filter(p => p.isActive)
          .map(p => p.modelName);
        if (models.length > 0) {
          setAvailableModels(models);
        }
      }
    } catch (error) {
      console.error('Error fetching available models:', error);
      // Keep using default AVAILABLE_AI_MODELS on error
    }
  }

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      setSettings(data.settings);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleValueChange(settingId, newValue) {
    setModifiedSettings(prev => ({
      ...prev,
      [settingId]: newValue
    }));
  }

  function getCurrentValue(setting) {
    return modifiedSettings[setting.id] !== undefined
      ? modifiedSettings[setting.id]
      : setting.value;
  }

  function isBinaryValue(value) {
    return value === '0' || value === '1';
  }

  async function handleSaveAll() {
    if (!hasChanges) return;

    setSaving(true);
    try {
      const promises = Object.entries(modifiedSettings).map(([id, value]) =>
        fetch(`/api/admin/settings/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        })
      );

      const results = await Promise.all(promises);
      const allSuccess = results.every(res => res.ok);

      if (allSuccess) {
        setToast({ type: 'success', message: 'Paramètres sauvegardés avec succès !' });
        setModifiedSettings({});
        await fetchSettings();
      } else {
        setToast({ type: 'error', message: 'Erreur lors de la sauvegarde de certains paramètres' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setToast({ type: 'error', message: 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setModifiedSettings({});
  }

  async function handleDeleteAllData() {
    setDeleting(true);
    try {
      const response = await fetch('/api/admin/telemetry/cleanup', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete data');
      }

      const result = await response.json();
      setToast({
        type: 'success',
        message: `${result.deleted.total} enregistrements supprimés avec succès`
      });
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Error deleting telemetry data:', error);
      setToast({
        type: 'error',
        message: `Erreur lors de la suppression: ${error.message}`
      });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-white">Chargement...</div>;
  }

  // Grouper les settings par catégorie
  const settingsByCategory = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {});

  const categories = Object.keys(settingsByCategory).sort();

  // Composant pour afficher un setting individuel
  function SettingRow({ setting, indent = false }) {
    const currentValue = getCurrentValue(setting);
    const isBinary = isBinaryValue(setting.value);
    const isAIModel = setting.category === 'ai_models';
    const isModified = modifiedSettings[setting.id] !== undefined;

    // Options pour le select des modèles IA (depuis OpenAI Pricing)
    const modelOptions = availableModels.map(model => ({
      value: model,
      label: model,
    }));

    return (
      <div
        className={`p-3 rounded-lg transition-colors ${
          isModified ? 'bg-blue-500/10 border border-blue-400/30' : 'bg-white/5'
        } ${indent ? 'ml-4' : ''}`}
      >
        {isBinary ? (
          // Layout pour les toggles: toujours en ligne avec toggle à droite
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white">
                    {getSettingLabel(setting.settingName)}
                  </span>
                  {isModified && (
                    <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded">
                      modifié
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                <ToggleSwitch
                  enabled={currentValue === '1'}
                  onChange={(enabled) =>
                    handleValueChange(setting.id, enabled ? '1' : '0')
                  }
                />
              </div>
            </div>
            {/* Description en dessous pour les toggles */}
            {setting.description && (
              <p className="text-xs text-white/60 mt-2">
                {setting.description}
              </p>
            )}
          </>
        ) : (
          // Layout pour les inputs/selects: colonne sur mobile, ligne sur desktop
          <>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white">
                    {getSettingLabel(setting.settingName)}
                  </span>
                  {isModified && (
                    <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded">
                      modifié
                    </span>
                  )}
                </div>
                {/* Description sur desktop pour les inputs/selects */}
                {setting.description && (
                  <p className="text-xs text-white/60 mt-1 hidden md:block">
                    {setting.description}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0 w-full md:w-auto">
                {isAIModel ? (
                  <CustomSelect
                    value={currentValue}
                    onChange={(value) => handleValueChange(setting.id, value)}
                    options={modelOptions}
                    className="md:w-64"
                  />
                ) : (
                  <input
                    type="text"
                    value={currentValue}
                    onChange={(e) => handleValueChange(setting.id, e.target.value)}
                    className="px-3 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 backdrop-blur-xl w-full md:w-64 font-mono"
                  />
                )}
              </div>
            </div>
            {/* Description sous le champ sur mobile pour les inputs/selects */}
            {setting.description && (
              <p className="text-xs text-white/60 mt-2 md:hidden">
                {setting.description}
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  // Afficher les modèles IA avec structure hiérarchique
  function renderAIModels(categorySettings) {
    const aiStructure = getAIModelsStructure();
    const settingsByName = categorySettings.reduce((acc, setting) => {
      acc[setting.settingName] = setting;
      return acc;
    }, {});

    return (
      <div className="space-y-6">
        {Object.entries(aiStructure).map(([groupLabel, settingNames]) => (
          <div key={groupLabel}>
            <h5 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-blue-400 rounded"></span>
              {groupLabel}
            </h5>
            <div className="space-y-2">
              {settingNames.map(settingName => {
                const setting = settingsByName[settingName];
                return setting ? (
                  <SettingRow key={setting.id} setting={setting} indent={settingNames.length > 1} />
                ) : null;
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Afficher les settings d'une catégorie non-hiérarchique
  function renderSimpleSettings(categorySettings) {
    return (
      <div className="space-y-3">
        {categorySettings.map(setting => (
          <SettingRow key={setting.id} setting={setting} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec bouton sauvegarder */}
      <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20 sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-white">Paramètres système</h3>
            <p className="text-sm text-white/60 mt-1">
              {hasChanges ? `${Object.keys(modifiedSettings).length} modification(s) en attente` : 'Aucune modification'}
            </p>
          </div>
          <div className="flex gap-3">
            {hasChanges && (
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-white/10 text-white/80 border border-white/20 rounded-lg hover:bg-white/20 transition backdrop-blur-xl"
              >
                Annuler
              </button>
            )}
            <button
              onClick={handleSaveAll}
              disabled={!hasChanges || saving}
              className={`px-4 py-2 rounded-lg transition backdrop-blur-xl ${
                hasChanges && !saving
                  ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/50 hover:bg-emerald-500/40'
                  : 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed'
              }`}
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder tout'}
            </button>
          </div>
        </div>
      </div>

      {/* Grid 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {categories.map((category) => (
          <div
            key={category}
            className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20"
          >
            <h4 className="text-md font-semibold text-white mb-4 pb-2 border-b border-white/10">
              {getCategoryLabel(category)}
            </h4>

            {isHierarchicalCategory(category)
              ? renderAIModels(settingsByCategory[category])
              : renderSimpleSettings(settingsByCategory[category])}
          </div>
        ))}
      </div>

      {settings.length === 0 && (
        <div className="text-center text-white/60 py-8 bg-white/10 backdrop-blur-xl rounded-lg">
          Aucun paramètre trouvé
        </div>
      )}

      {/* Danger Zone - Delete All Analytics Data */}
      <div className="bg-red-500/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-red-500/30">
        <h3 className="text-lg font-semibold text-red-400 mb-2">⚠️ Zone de danger</h3>
        <p className="text-white/60 text-sm mb-4">
          Cette action supprimera définitivement <strong className="text-white">toutes</strong> les données analytics :
          événements de télémétrie, utilisations de features, appels OpenAI et statistiques d'usage.
          <br />
          <strong className="text-red-400">Cette opération est irréversible.</strong>
        </p>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500/30 transition backdrop-blur-xl font-medium"
        >
          🗑️ Supprimer toutes les données analytics
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900/95 backdrop-blur-xl rounded-lg shadow-2xl border border-red-500/30 p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-red-400 mb-4">⚠️ Confirmation requise</h3>
            <p className="text-white/80 mb-2">
              Êtes-vous absolument certain de vouloir supprimer <strong className="text-white">toutes</strong> les données analytics ?
            </p>
            <p className="text-white/60 text-sm mb-6">
              Cette action va supprimer :
            </p>
            <ul className="text-sm text-white/60 mb-6 space-y-1 list-disc list-inside">
              <li>Tous les événements de télémétrie (TelemetryEvent)</li>
              <li>Toutes les utilisations de features (FeatureUsage)</li>
              <li>Tous les appels OpenAI (OpenAICall)</li>
              <li>Toutes les statistiques d'usage OpenAI (OpenAIUsage)</li>
            </ul>
            <p className="text-red-400 font-semibold mb-6 text-sm">
              ⚠️ Cette action est définitive et ne peut pas être annulée.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 bg-white/10 text-white border border-white/20 rounded-lg hover:bg-white/20 transition disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteAllData}
                disabled={deleting}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Suppression...' : 'Oui, supprimer tout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
