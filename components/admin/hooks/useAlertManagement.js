import { useState, useEffect } from 'react';

/**
 * Hook pour gérer le CRUD des alertes OpenAI
 */
export function useAlertManagement({ alerts, setAlerts, fetchAlerts, onToast, onConfirm }) {
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [alertsFilter, setAlertsFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [selectedAlertForEdit, setSelectedAlertForEdit] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Refresh alerts when form is shown
  useEffect(() => {
    if (showAlertForm) {
      fetchAlerts();
    }
  }, [showAlertForm, fetchAlerts]);

  const handleDeleteAlert = (id) => {
    onConfirm({
      title: 'Supprimer cette alerte ?',
      message: 'Cette action est irréversible.',
      type: 'danger',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/admin/openai-alerts?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
          });

          if (!response.ok) throw new Error('Failed to delete alert');
          await fetchAlerts();
          onToast({ type: 'success', message: 'Alerte supprimée avec succès' });
        } catch (err) {
          console.error('Error deleting alert:', err);
          onToast({ type: 'error', message: 'Erreur lors de la suppression de l\'alerte' });
        }
      }
    });
  };

  const handleEditAlert = (alert) => {
    setSelectedAlertForEdit(alert);
    setShowEditModal(true);
  };

  const handleCreateAlert = () => {
    setSelectedAlertForEdit(null);
    setShowEditModal(true);
  };

  const handleSaveAlertFromModal = async (alertData) => {
    try {
      const payload = {
        ...(alertData.id && { id: alertData.id }),
        type: alertData.type,
        threshold: alertData.threshold,
        enabled: alertData.enabled,
        name: alertData.name,
        description: alertData.description || null,
      };

      const response = await fetch('/api/admin/openai-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save alert');
      }

      await fetchAlerts();
      setShowEditModal(false);
      setSelectedAlertForEdit(null);

      const successMessage = alertData.id
        ? 'Alerte mise à jour avec succès'
        : 'Alerte créée avec succès';
      onToast({ type: 'success', message: successMessage });
    } catch (err) {
      console.error('Error saving alert:', err);
      throw err;
    }
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedAlertForEdit(null);
  };

  // Filter alerts based on current filter
  const filteredAlerts = alerts.filter(alert => {
    if (alertsFilter === 'active') return alert.enabled;
    if (alertsFilter === 'inactive') return !alert.enabled;
    return true;
  });

  return {
    showAlertForm,
    setShowAlertForm,
    alertsFilter,
    setAlertsFilter,
    selectedAlertForEdit,
    showEditModal,
    filteredAlerts,
    handleDeleteAlert,
    handleEditAlert,
    handleCreateAlert,
    handleSaveAlertFromModal,
    handleCloseEditModal,
  };
}
