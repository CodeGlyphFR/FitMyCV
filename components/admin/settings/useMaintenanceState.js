'use client';

import { useState, useCallback } from 'react';

/**
 * Hook for managing maintenance mode state
 */
export function useMaintenanceState({ settings, fetchSettings, fetchActiveSessionsCount, setToast }) {
  const [showMaintenanceConfirm, setShowMaintenanceConfirm] = useState(false);
  const [maintenanceInfo, setMaintenanceInfo] = useState(null);
  const [pendingMaintenanceSetting, setPendingMaintenanceSetting] = useState(null);

  // Handle maintenance toggle with confirmation
  const handleMaintenanceChange = useCallback(async (settingId, newValue) => {
    const setting = settings.find((s) => s.id === settingId);

    // Activation: show confirmation modal
    if (setting?.settingName === 'maintenance_enabled' && newValue === '1') {
      const sessionInfo = await fetchActiveSessionsCount();
      setMaintenanceInfo(sessionInfo);
      setPendingMaintenanceSetting({ settingId, newValue });
      setShowMaintenanceConfirm(true);
      return true; // Handled
    }

    // Deactivation: apply directly
    if (setting?.settingName === 'maintenance_enabled' && newValue === '0') {
      try {
        const res = await fetch(`/api/admin/settings/${settingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: newValue }),
        });
        if (res.ok) {
          setToast({
            type: 'success',
            message: 'Mode maintenance désactivé. Le site est de nouveau accessible.',
          });
          await fetchSettings();
        } else {
          setToast({ type: 'error', message: 'Erreur lors de la désactivation du mode maintenance' });
        }
      } catch (error) {
        console.error('Error disabling maintenance mode:', error);
        setToast({ type: 'error', message: 'Erreur lors de la désactivation du mode maintenance' });
      }
      return true; // Handled
    }

    return false; // Not a maintenance setting
  }, [settings, fetchActiveSessionsCount, fetchSettings, setToast]);

  // Confirm maintenance toggle
  const confirmMaintenanceToggle = useCallback(async () => {
    if (pendingMaintenanceSetting) {
      try {
        const res = await fetch(`/api/admin/settings/${pendingMaintenanceSetting.settingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: pendingMaintenanceSetting.newValue }),
        });
        if (res.ok) {
          setToast({
            type: 'success',
            message: `Mode maintenance activé ! ${maintenanceInfo?.recentActiveUsers || 0} utilisateurs seront déconnectés.`,
          });
          await fetchSettings();
        } else {
          setToast({ type: 'error', message: "Erreur lors de l'activation du mode maintenance" });
        }
      } catch (error) {
        console.error('Error enabling maintenance mode:', error);
        setToast({ type: 'error', message: "Erreur lors de l'activation du mode maintenance" });
      }
    }
    setShowMaintenanceConfirm(false);
    setPendingMaintenanceSetting(null);
    setMaintenanceInfo(null);
  }, [pendingMaintenanceSetting, maintenanceInfo, fetchSettings, setToast]);

  // Cancel maintenance toggle
  const cancelMaintenanceToggle = useCallback(() => {
    setShowMaintenanceConfirm(false);
    setPendingMaintenanceSetting(null);
    setMaintenanceInfo(null);
  }, []);

  return {
    showMaintenanceConfirm,
    maintenanceInfo,
    handleMaintenanceChange,
    confirmMaintenanceToggle,
    cancelMaintenanceToggle,
  };
}
