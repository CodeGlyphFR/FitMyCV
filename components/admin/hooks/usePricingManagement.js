import { useState } from 'react';

const INITIAL_PRICING_FORM = {
  modelName: '',
  inputPricePerMToken: '',
  outputPricePerMToken: '',
  cachePricePerMToken: '',
  inputPricePerMTokenPriority: '',
  outputPricePerMTokenPriority: '',
  cachePricePerMTokenPriority: '',
  description: '',
  isActive: true,
};

/**
 * Hook pour gérer le CRUD des tarifs OpenAI
 */
export function usePricingManagement({ pricings, setPricings, isPriorityMode, setIsPriorityMode, fetchPricings, onToast, onConfirm }) {
  const [showPricing, setShowPricing] = useState(false);
  const [editingPricing, setEditingPricing] = useState(null);
  const [pricingForm, setPricingForm] = useState(INITIAL_PRICING_FORM);
  const [priorityModeLoading, setPriorityModeLoading] = useState(false);

  const togglePriorityMode = async (newValue) => {
    try {
      setPriorityModeLoading(true);
      const response = await fetch('/api/admin/openai-pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPriorityMode: newValue }),
      });

      if (!response.ok) throw new Error('Failed to toggle priority mode');

      setIsPriorityMode(newValue);
      onToast({ type: 'success', message: `Mode ${newValue ? 'Priority' : 'Standard'} activé` });
    } catch (err) {
      console.error('Error toggling priority mode:', err);
      onToast({ type: 'error', message: 'Erreur lors du changement de mode' });
    } finally {
      setPriorityModeLoading(false);
    }
  };

  const handleSavePricing = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        modelName: pricingForm.modelName,
        inputPricePerMToken: parseFloat(pricingForm.inputPricePerMToken),
        outputPricePerMToken: parseFloat(pricingForm.outputPricePerMToken),
        cachePricePerMToken: pricingForm.cachePricePerMToken ? parseFloat(pricingForm.cachePricePerMToken) : 0,
        inputPricePerMTokenPriority: pricingForm.inputPricePerMTokenPriority ? parseFloat(pricingForm.inputPricePerMTokenPriority) : null,
        outputPricePerMTokenPriority: pricingForm.outputPricePerMTokenPriority ? parseFloat(pricingForm.outputPricePerMTokenPriority) : null,
        cachePricePerMTokenPriority: pricingForm.cachePricePerMTokenPriority ? parseFloat(pricingForm.cachePricePerMTokenPriority) : null,
        description: pricingForm.description || null,
        isActive: pricingForm.isActive,
      };

      const response = await fetch('/api/admin/openai-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to save pricing');

      await fetchPricings();
      resetForm();
      onToast({ type: 'success', message: 'Tarif sauvegardé avec succès' });
    } catch (err) {
      console.error('Error saving pricing:', err);
      onToast({ type: 'error', message: 'Erreur lors de la sauvegarde du tarif' });
    }
  };

  const handleDeletePricing = (modelName) => {
    onConfirm({
      title: 'Supprimer ce tarif ?',
      message: `Êtes-vous sûr de vouloir supprimer le tarif pour ${modelName} ?`,
      type: 'danger',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/admin/openai-pricing?modelName=${encodeURIComponent(modelName)}`, {
            method: 'DELETE',
          });

          if (!response.ok) throw new Error('Failed to delete pricing');
          await fetchPricings();
          onToast({ type: 'success', message: 'Tarif supprimé avec succès' });
        } catch (err) {
          console.error('Error deleting pricing:', err);
          onToast({ type: 'error', message: 'Erreur lors de la suppression du tarif' });
        }
      }
    });
  };

  const handleEditPricing = (pricing) => {
    setEditingPricing(pricing.modelName);
    setPricingForm({
      modelName: pricing.modelName,
      inputPricePerMToken: pricing.inputPricePerMToken.toString(),
      outputPricePerMToken: pricing.outputPricePerMToken.toString(),
      cachePricePerMToken: pricing.cachePricePerMToken?.toString() || '0',
      inputPricePerMTokenPriority: pricing.inputPricePerMTokenPriority?.toString() || '',
      outputPricePerMTokenPriority: pricing.outputPricePerMTokenPriority?.toString() || '',
      cachePricePerMTokenPriority: pricing.cachePricePerMTokenPriority?.toString() || '',
      description: pricing.description || '',
      isActive: pricing.isActive,
    });
  };

  const resetForm = () => {
    setEditingPricing(null);
    setPricingForm(INITIAL_PRICING_FORM);
  };

  return {
    showPricing,
    setShowPricing,
    editingPricing,
    pricingForm,
    setPricingForm,
    priorityModeLoading,
    togglePriorityMode,
    handleSavePricing,
    handleDeletePricing,
    handleEditPricing,
    resetForm,
  };
}
