'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getSettingLabel, AVAILABLE_AI_MODELS } from '@/lib/admin/settingsConfig';

/**
 * Hook for managing settings state, fetching, and modifications
 */
export function useSettingsState({ refreshKey }) {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modifiedSettings, setModifiedSettings] = useState({});
  const [toast, setToast] = useState(null);
  const [availableModels, setAvailableModels] = useState(AVAILABLE_AI_MODELS);

  const hasChanges = Object.keys(modifiedSettings).length > 0;
  const modifiedCount = Object.keys(modifiedSettings).length;

  // Fetch available AI models
  const fetchAvailableModels = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/openai-pricing');
      const data = await res.json();
      if (data.pricings?.length > 0) {
        const models = data.pricings.filter((p) => p.isActive).map((p) => p.modelName);
        if (models.length > 0) setAvailableModels(models);
      }
    } catch (error) {
      console.error('Error fetching available models:', error);
    }
  }, []);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
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
  }, []);

  // Fetch active sessions count
  const fetchActiveSessionsCount = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/maintenance/active-sessions');
      return await res.json();
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      return null;
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchSettings();
    fetchAvailableModels();
  }, [refreshKey, fetchSettings, fetchAvailableModels]);

  // Get current value (modified or original)
  const getCurrentValue = useCallback((setting) => {
    return modifiedSettings[setting.id] !== undefined ? modifiedSettings[setting.id] : setting.value;
  }, [modifiedSettings]);

  // Check if value is binary
  const isBinaryValue = useCallback((value) => {
    return value === '0' || value === '1';
  }, []);

  // Handle value change
  const handleValueChange = useCallback((settingId, newValue) => {
    setModifiedSettings((prev) => ({ ...prev, [settingId]: newValue }));
  }, []);

  // Save all modified settings
  const handleSaveAll = useCallback(async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const maintenanceSettingId = settings.find((s) => s.settingName === 'maintenance_enabled')?.id;
      const maintenanceChanged = maintenanceSettingId && modifiedSettings[maintenanceSettingId] !== undefined;
      const maintenanceEnabled = modifiedSettings[maintenanceSettingId] === '1';

      const promises = Object.entries(modifiedSettings).map(([id, value]) =>
        fetch(`/api/admin/settings/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        })
      );

      const results = await Promise.all(promises);
      const allSuccess = results.every((res) => res.ok);

      if (allSuccess) {
        if (maintenanceChanged) {
          if (maintenanceEnabled) {
            const sessionInfo = await fetchActiveSessionsCount();
            setToast({
              type: 'success',
              message: `Mode maintenance activé ! ${sessionInfo?.recentActiveUsers || 0} utilisateurs seront déconnectés.`,
            });
          } else {
            setToast({
              type: 'success',
              message: 'Mode maintenance désactivé. Le site est de nouveau accessible.',
            });
          }
        } else {
          setToast({ type: 'success', message: 'Paramètres sauvegardés avec succès !' });
        }
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
  }, [hasChanges, modifiedSettings, settings, fetchActiveSessionsCount, fetchSettings]);

  // Cancel modifications
  const handleCancel = useCallback(() => {
    setModifiedSettings({});
  }, []);

  // Delete all analytics
  const handleDeleteAllAnalytics = useCallback(async () => {
    const response = await fetch('/api/admin/telemetry/cleanup', { method: 'DELETE' });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete data');
    }
    const result = await response.json();
    setToast({
      type: 'success',
      message: `${result.deleted.total} enregistrements supprimés avec succès`,
    });
  }, []);

  // List of modifications for display
  const modifiedSettingsList = useMemo(() => {
    return Object.entries(modifiedSettings).map(([settingId, newValue]) => {
      const setting = settings.find((s) => s.id === settingId);
      if (!setting) return null;
      const label = getSettingLabel(setting.settingName);
      const oldValue = setting.value;
      return {
        label: `${label}: ${oldValue} → ${newValue}`,
        settingName: setting.settingName,
      };
    }).filter(Boolean);
  }, [modifiedSettings, settings]);

  return {
    // State
    settings,
    loading,
    saving,
    modifiedSettings,
    toast,
    setToast,
    availableModels,
    hasChanges,
    modifiedCount,
    modifiedSettingsList,
    // Actions
    fetchSettings,
    fetchActiveSessionsCount,
    getCurrentValue,
    isBinaryValue,
    handleValueChange,
    handleSaveAll,
    handleCancel,
    handleDeleteAllAnalytics,
  };
}
