import { useState, useEffect } from 'react';
import { getDefaultFeatureLimits, loadFeatureLimitsFromPlan } from '@/lib/subscription/macroFeatures';

const INITIAL_PLAN_FORM = {
  name: '',
  description: '',
  priceMonthly: '0',
  priceYearly: '0',
  yearlyDiscountPercent: '0',
  priceCurrency: 'EUR',
  maxCvCount: -1,
  isFree: false,
  tier: 0,
  isPopular: false,
};

/**
 * Hook for managing subscription plans CRUD operations
 */
export function usePlansManagement({ onToast, onConfirm }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  // Form state
  const [formData, setFormData] = useState(INITIAL_PLAN_FORM);
  const [featureLimits, setFeatureLimits] = useState({});

  // Plan costs
  const [planCosts, setPlanCosts] = useState({});
  const [costsLoading, setCostsLoading] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(null);

  // Fetch plans on mount
  useEffect(() => {
    fetchPlans();
  }, []);

  // Fetch costs when plans change
  useEffect(() => {
    if (plans.length > 0) {
      fetchPlanCosts();
    }
  }, [plans]);

  async function fetchPlans() {
    try {
      if (plans.length === 0) {
        setLoading(true);
      }

      const response = await fetch('/api/admin/subscription-plans');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Failed to fetch plans');
      }

      const data = await response.json();
      setPlans(data.plans || []);
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
      onToast({ type: 'error', message: `Erreur: ${error.message}` });
    } finally {
      setLoading(false);
    }
  }

  async function fetchPlanCosts() {
    try {
      setCostsLoading(true);
      const response = await fetch('/api/admin/plan-costs');
      if (!response.ok) {
        console.warn('[usePlansManagement] Failed to fetch plan costs');
        return;
      }

      const data = await response.json();
      if (data.success && data.data) {
        const costsMap = {};
        data.data.costs.forEach((cost) => {
          costsMap[cost.plan] = cost;
        });
        setPlanCosts(costsMap);
        setExchangeRate(data.data.exchangeRate);
      }
    } catch (error) {
      console.error('[usePlansManagement] Error fetching plan costs:', error);
    } finally {
      setCostsLoading(false);
    }
  }

  function openCreateModal() {
    setFormData(INITIAL_PLAN_FORM);
    setFeatureLimits(getDefaultFeatureLimits());
    setShowCreateModal(true);
  }

  function openEditModal(plan) {
    setSelectedPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      yearlyDiscountPercent: plan.yearlyDiscountPercent,
      priceCurrency: plan.priceCurrency,
      isFree: plan.isFree || false,
      tier: plan.tier || 0,
      isPopular: plan.isPopular || false,
    });
    setFeatureLimits(loadFeatureLimitsFromPlan(plan));
    setShowEditModal(true);
  }

  async function handleCreatePlan() {
    if (updating) return;

    if (formData.tier === undefined || formData.tier < 0) {
      onToast({ type: 'error', message: 'Niveau (tier) requis' });
      return;
    }

    try {
      setUpdating(true);

      const response = await fetch('/api/admin/subscription-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          priceMonthly: parseFloat(formData.priceMonthly) || 0,
          priceYearly: parseFloat(formData.priceYearly) || 0,
          featureLimits: Object.entries(featureLimits).map(([featureName, config]) => ({
            featureName,
            isEnabled: config.isEnabled,
            usageLimit: config.usageLimit,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Erreur lors de la création du plan');
      }

      onToast({ type: 'success', message: 'Plan créé avec succès' });
      setShowCreateModal(false);
      await fetchPlans();
    } catch (error) {
      console.error('Error creating plan:', error);
      onToast({ type: 'error', message: error.message });
    } finally {
      setUpdating(false);
    }
  }

  async function handleUpdatePlan() {
    if (updating || !selectedPlan) return;

    if (formData.tier === undefined || formData.tier < 0) {
      onToast({ type: 'error', message: 'Niveau (tier) requis' });
      return;
    }

    try {
      setUpdating(true);

      const response = await fetch(`/api/admin/subscription-plans/${selectedPlan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          priceMonthly: parseFloat(formData.priceMonthly) || 0,
          priceYearly: parseFloat(formData.priceYearly) || 0,
          featureLimits: Object.entries(featureLimits).map(([featureName, config]) => ({
            featureName,
            isEnabled: config.isEnabled,
            usageLimit: config.usageLimit,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Erreur lors de la mise à jour du plan');
      }

      onToast({ type: 'success', message: 'Plan mis à jour avec succès' });
      setShowEditModal(false);
      setSelectedPlan(null);
      await fetchPlans();
    } catch (error) {
      console.error('Error updating plan:', error);
      onToast({ type: 'error', message: error.message });
    } finally {
      setUpdating(false);
    }
  }

  function handleDeletePlan(plan) {
    if (updating) return;

    onConfirm({
      title: 'Supprimer ce plan d\'abonnement ?',
      message: `Êtes-vous sûr de vouloir supprimer le plan "${plan.name}" ? Cette action est irréversible.`,
      type: 'danger',
      confirmText: 'Supprimer définitivement',
      cancelText: 'Annuler',
      onConfirm: async () => {
        try {
          setUpdating(true);

          const response = await fetch(`/api/admin/subscription-plans/${plan.id}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
            throw new Error(errorData.error || 'Erreur lors de la suppression du plan');
          }

          onToast({ type: 'success', message: 'Plan supprimé avec succès' });
          await fetchPlans();
        } catch (error) {
          console.error('Error deleting plan:', error);
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
    setSelectedPlan(null);
  }

  return {
    // State
    plans,
    loading,
    updating,
    planCosts,
    costsLoading,
    exchangeRate,

    // Modals
    showCreateModal,
    showEditModal,
    selectedPlan,

    // Form
    formData,
    setFormData,
    featureLimits,
    setFeatureLimits,

    // Actions
    fetchPlans,
    openCreateModal,
    openEditModal,
    handleCreatePlan,
    handleUpdatePlan,
    handleDeletePlan,
    closeCreateModal,
    closeEditModal,
  };
}
