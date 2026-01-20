import { useState, useEffect } from 'react';

const INITIAL_PACK_FORM = {
  creditAmount: 0,
  price: '0',
  priceCurrency: 'EUR',
  isActive: true,
};

/**
 * Hook for managing credit packs CRUD operations
 */
export function usePacksManagement({ onToast, onConfirm }) {
  const [packs, setPacks] = useState([]);
  const [updating, setUpdating] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPack, setSelectedPack] = useState(null);

  // Form state
  const [formData, setFormData] = useState(INITIAL_PACK_FORM);

  // Fetch packs on mount
  useEffect(() => {
    fetchPacks();
  }, []);

  async function fetchPacks() {
    try {
      const response = await fetch('/api/admin/credit-packs');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Failed to fetch packs');
      }

      const data = await response.json();
      setPacks(data.packs || []);
    } catch (error) {
      console.error('Error fetching credit packs:', error);
      onToast({ type: 'error', message: `Erreur: ${error.message}` });
    }
  }

  function openCreateModal() {
    setFormData({
      creditAmount: 10,
      price: '5',
      priceCurrency: 'EUR',
      isActive: true,
    });
    setShowCreateModal(true);
  }

  function openEditModal(pack) {
    setSelectedPack(pack);
    setFormData({
      creditAmount: pack.creditAmount,
      price: pack.price,
      priceCurrency: pack.priceCurrency,
      isActive: pack.isActive,
    });
    setShowEditModal(true);
  }

  async function handleCreatePack() {
    if (updating) return;

    if (formData.creditAmount <= 0) {
      onToast({ type: 'error', message: 'Le nombre de crédits doit être supérieur à 0' });
      return;
    }

    try {
      setUpdating(true);

      const response = await fetch('/api/admin/credit-packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditAmount: formData.creditAmount,
          price: parseFloat(formData.price) || 0,
          priceCurrency: formData.priceCurrency,
          isActive: formData.isActive,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Erreur lors de la création du pack');
      }

      onToast({ type: 'success', message: 'Pack créé avec succès' });
      setShowCreateModal(false);
      await fetchPacks();
    } catch (error) {
      console.error('Error creating pack:', error);
      onToast({ type: 'error', message: error.message });
    } finally {
      setUpdating(false);
    }
  }

  async function handleUpdatePack() {
    if (updating || !selectedPack) return;

    if (formData.creditAmount <= 0) {
      onToast({ type: 'error', message: 'Le nombre de crédits doit être supérieur à 0' });
      return;
    }

    try {
      setUpdating(true);

      const response = await fetch(`/api/admin/credit-packs/${selectedPack.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditAmount: formData.creditAmount,
          price: parseFloat(formData.price) || 0,
          priceCurrency: formData.priceCurrency,
          isActive: formData.isActive,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Erreur lors de la mise à jour du pack');
      }

      onToast({ type: 'success', message: 'Pack mis à jour avec succès' });
      setShowEditModal(false);
      setSelectedPack(null);
      await fetchPacks();
    } catch (error) {
      console.error('Error updating pack:', error);
      onToast({ type: 'error', message: error.message });
    } finally {
      setUpdating(false);
    }
  }

  function handleDeletePack(pack) {
    if (updating) return;

    onConfirm({
      title: 'Supprimer ce pack de crédits ?',
      message: `Êtes-vous sûr de vouloir supprimer le pack "${pack.name}" ? Cette action est irréversible.`,
      type: 'danger',
      confirmText: 'Supprimer définitivement',
      cancelText: 'Annuler',
      onConfirm: async () => {
        try {
          setUpdating(true);

          const response = await fetch(`/api/admin/credit-packs/${pack.id}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
            throw new Error(errorData.error || 'Erreur lors de la suppression du pack');
          }

          onToast({ type: 'success', message: 'Pack supprimé avec succès' });
          await fetchPacks();
        } catch (error) {
          console.error('Error deleting pack:', error);
          onToast({ type: 'error', message: error.message });
        } finally {
          setUpdating(false);
        }
      },
    });
  }

  function closeCreateModal() {
    setShowCreateModal(false);
  }

  function closeEditModal() {
    setShowEditModal(false);
    setSelectedPack(null);
  }

  return {
    // State
    packs,
    updating,

    // Modals
    showCreateModal,
    showEditModal,
    selectedPack,

    // Form
    formData,
    setFormData,

    // Actions
    fetchPacks,
    openCreateModal,
    openEditModal,
    handleCreatePack,
    handleUpdatePack,
    handleDeletePack,
    closeCreateModal,
    closeEditModal,
  };
}
