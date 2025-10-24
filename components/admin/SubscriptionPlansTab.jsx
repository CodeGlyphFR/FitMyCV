'use client';

import { useState, useEffect } from 'react';
import { KPICard } from './KPICard';
import { CustomSelect } from './CustomSelect';
import { Toast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import { ToggleSwitch } from './ToggleSwitch';

// Macro-features pour la gestion des abonnements
// Chaque macro-feature regroupe plusieurs micro-features de tracking OpenAI
const MACRO_FEATURES = {
  gpt_cv_generation: {
    name: 'Génération de CV (GPT)',
    icon: '🤖',
    description: 'Bouton GPT - Adaptation CV, Analyse offre, Modèle CV (URL + PDF)',
    microFeatures: [
      'generate_cv_url',
      'generate_cv_pdf',
      'extract_job_offer_url',
      'extract_job_offer_pdf',
      'create_template_cv_url',
      'create_template_cv_pdf'
    ],
    hasAnalysisLevels: true,
    isAIFeature: true
  },
  import_pdf: {
    name: 'Import PDF',
    icon: '📄',
    description: 'Import de CV depuis PDF',
    microFeatures: ['import_pdf', 'first_import_pdf', 'import_cv'],
    hasAnalysisLevels: false,
    isAIFeature: true
  },
  translate_cv: {
    name: 'Traduction',
    icon: '🌐',
    description: 'Traduction de CV',
    microFeatures: ['translate_cv'],
    hasAnalysisLevels: false,
    isAIFeature: true
  },
  match_score: {
    name: 'Score de correspondance',
    icon: '🎯',
    description: 'Calcul du score de match avec l\'offre',
    microFeatures: ['match_score'],
    hasAnalysisLevels: false,
    isAIFeature: true
  },
  optimize_cv: {
    name: 'Optimisation CV',
    icon: '✨',
    description: 'Optimisation automatique du CV',
    microFeatures: ['optimize_cv'],
    hasAnalysisLevels: false,
    isAIFeature: true
  },
  generate_from_job_title: {
    name: 'Barre de recherche',
    icon: '🔍',
    description: 'Génération depuis un titre de poste',
    microFeatures: ['generate_from_job_title'],
    hasAnalysisLevels: false,
    isAIFeature: true
  },
  export_cv: {
    name: 'Export PDF',
    icon: '📥',
    description: 'Export du CV en PDF',
    microFeatures: ['export_cv'],
    hasAnalysisLevels: false,
    isAIFeature: false
  },
  edit_cv: {
    name: 'Édition CV',
    icon: '✏️',
    description: 'Mode édition du CV',
    microFeatures: ['edit_cv'],
    hasAnalysisLevels: false,
    isAIFeature: false
  },
  create_cv_manual: {
    name: 'Création manuelle',
    icon: '✍️',
    description: 'Création manuelle de CV (bouton +)',
    microFeatures: ['create_cv_manual'],
    hasAnalysisLevels: false,
    isAIFeature: false
  }
};

// Features IA (avec mode Token)
const AI_FEATURES = Object.entries(MACRO_FEATURES)
  .filter(([_, config]) => config.isAIFeature)
  .map(([key]) => key);

// Features avec niveaux d'analyse
const ANALYSIS_LEVEL_FEATURES = Object.entries(MACRO_FEATURES)
  .filter(([_, config]) => config.hasAnalysisLevels)
  .map(([key]) => key);

export function SubscriptionPlansTab({ refreshKey }) {
  const [plans, setPlans] = useState([]);
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Modals Plans
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  // Modals Packs
  const [showCreatePackModal, setShowCreatePackModal] = useState(false);
  const [showEditPackModal, setShowEditPackModal] = useState(false);
  const [selectedPack, setSelectedPack] = useState(null);

  // Toast et Confirm
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Formulaire Plans
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priceMonthly: '0',
    priceYearly: '0',
    yearlyDiscountPercent: '0',
    priceCurrency: 'EUR',
    maxCvCount: -1,
  });
  const [featureLimits, setFeatureLimits] = useState({});

  // Formulaire Packs
  const [packFormData, setPackFormData] = useState({
    name: '',
    description: '',
    creditAmount: 0,
    price: '0',
    priceCurrency: 'EUR',
    isActive: true,
  });

  useEffect(() => {
    fetchPlans();
    fetchPacks();
  }, [refreshKey]);

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
      setToast({ type: 'error', message: `Erreur: ${error.message}` });
    } finally {
      setLoading(false);
    }
  }

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
      setToast({ type: 'error', message: `Erreur: ${error.message}` });
    }
  }

  // Ouvrir modal de création
  function openCreateModal() {
    setFormData({
      name: '',
      description: '',
      priceMonthly: '0',
      priceYearly: '0',
      yearlyDiscountPercent: '0',
      priceCurrency: 'EUR',
      maxCvCount: -1,
    });

    // Initialiser les features avec des valeurs par défaut
    const defaultFeatures = {};
    Object.keys(MACRO_FEATURES).forEach((featureName) => {
      const config = MACRO_FEATURES[featureName];
      defaultFeatures[featureName] = {
        isEnabled: true,
        usageLimit: -1,
        allowedAnalysisLevels: config.hasAnalysisLevels
          ? ['rapid', 'medium', 'deep']
          : null,
      };
    });
    setFeatureLimits(defaultFeatures);

    setShowCreateModal(true);
  }

  // Ouvrir modal d'édition
  function openEditModal(plan) {
    setSelectedPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      yearlyDiscountPercent: plan.yearlyDiscountPercent,
      priceCurrency: plan.priceCurrency,
      maxCvCount: plan.maxCvCount,
    });

    // Charger les features existantes
    const existingFeatures = {};
    plan.featureLimits.forEach((fl) => {
      existingFeatures[fl.featureName] = {
        isEnabled: fl.isEnabled,
        usageLimit: fl.usageLimit,
        allowedAnalysisLevels: fl.allowedAnalysisLevels
          ? JSON.parse(fl.allowedAnalysisLevels)
          : null,
      };
    });

    // Ajouter les features manquantes avec des valeurs par défaut
    Object.keys(MACRO_FEATURES).forEach((featureName) => {
      if (!existingFeatures[featureName]) {
        const config = MACRO_FEATURES[featureName];
        existingFeatures[featureName] = {
          isEnabled: true,
          usageLimit: -1,
          allowedAnalysisLevels: config.hasAnalysisLevels
            ? ['rapid', 'medium', 'deep']
            : null,
        };
      }
    });

    setFeatureLimits(existingFeatures);
    setShowEditModal(true);
  }

  // Créer un plan
  async function handleCreatePlan() {
    if (updating) return;

    // Validation
    if (!formData.name.trim()) {
      setToast({ type: 'error', message: 'Nom du plan requis' });
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
          yearlyDiscountPercent: parseFloat(formData.yearlyDiscountPercent) || 0,
          featureLimits: Object.entries(featureLimits).map(([featureName, config]) => ({
            featureName,
            isEnabled: config.isEnabled,
            usageLimit: config.usageLimit,
            allowedAnalysisLevels: config.allowedAnalysisLevels,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Erreur lors de la création du plan');
      }

      setToast({ type: 'success', message: 'Plan créé avec succès' });
      setShowCreateModal(false);
      await fetchPlans();
    } catch (error) {
      console.error('Error creating plan:', error);
      setToast({ type: 'error', message: error.message });
    } finally {
      setUpdating(false);
    }
  }

  // Modifier un plan
  async function handleUpdatePlan() {
    if (updating || !selectedPlan) return;

    // Validation
    if (!formData.name.trim()) {
      setToast({ type: 'error', message: 'Nom du plan requis' });
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
          yearlyDiscountPercent: parseFloat(formData.yearlyDiscountPercent) || 0,
          featureLimits: Object.entries(featureLimits).map(([featureName, config]) => ({
            featureName,
            isEnabled: config.isEnabled,
            usageLimit: config.usageLimit,
            allowedAnalysisLevels: config.allowedAnalysisLevels,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Erreur lors de la mise à jour du plan');
      }

      setToast({ type: 'success', message: 'Plan mis à jour avec succès' });
      setShowEditModal(false);
      setSelectedPlan(null);
      await fetchPlans();
    } catch (error) {
      console.error('Error updating plan:', error);
      setToast({ type: 'error', message: error.message });
    } finally {
      setUpdating(false);
    }
  }

  // Supprimer un plan
  function handleDeletePlan(plan) {
    if (updating) return;

    setConfirmDialog({
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

          setToast({ type: 'success', message: 'Plan supprimé avec succès' });
          await fetchPlans();
        } catch (error) {
          console.error('Error deleting plan:', error);
          setToast({ type: 'error', message: error.message });
        } finally {
          setUpdating(false);
        }
      },
    });
  }

  // ========== CREDIT PACKS FUNCTIONS ==========

  // Ouvrir modal de création de pack
  function openCreatePackModal() {
    setPackFormData({
      name: '',
      description: '',
      creditAmount: 10,
      price: '5',
      priceCurrency: 'EUR',
      isActive: true,
    });
    setShowCreatePackModal(true);
  }

  // Ouvrir modal d'édition de pack
  function openEditPackModal(pack) {
    setSelectedPack(pack);
    setPackFormData({
      name: pack.name,
      description: pack.description || '',
      creditAmount: pack.creditAmount,
      price: pack.price,
      priceCurrency: pack.priceCurrency,
      isActive: pack.isActive,
    });
    setShowEditPackModal(true);
  }

  // Créer un pack
  async function handleCreatePack() {
    if (updating) return;

    // Validation
    if (!packFormData.name.trim()) {
      setToast({ type: 'error', message: 'Nom du pack requis' });
      return;
    }

    if (packFormData.creditAmount <= 0) {
      setToast({ type: 'error', message: 'Le nombre de crédits doit être supérieur à 0' });
      return;
    }

    try {
      setUpdating(true);

      const response = await fetch('/api/admin/credit-packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...packFormData,
          price: parseFloat(packFormData.price) || 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Erreur lors de la création du pack');
      }

      setToast({ type: 'success', message: 'Pack créé avec succès' });
      setShowCreatePackModal(false);
      await fetchPacks();
    } catch (error) {
      console.error('Error creating pack:', error);
      setToast({ type: 'error', message: error.message });
    } finally {
      setUpdating(false);
    }
  }

  // Modifier un pack
  async function handleUpdatePack() {
    if (updating || !selectedPack) return;

    // Validation
    if (!packFormData.name.trim()) {
      setToast({ type: 'error', message: 'Nom du pack requis' });
      return;
    }

    if (packFormData.creditAmount <= 0) {
      setToast({ type: 'error', message: 'Le nombre de crédits doit être supérieur à 0' });
      return;
    }

    try {
      setUpdating(true);

      const response = await fetch(`/api/admin/credit-packs/${selectedPack.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...packFormData,
          price: parseFloat(packFormData.price) || 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Erreur lors de la mise à jour du pack');
      }

      setToast({ type: 'success', message: 'Pack mis à jour avec succès' });
      setShowEditPackModal(false);
      setSelectedPack(null);
      await fetchPacks();
    } catch (error) {
      console.error('Error updating pack:', error);
      setToast({ type: 'error', message: error.message });
    } finally {
      setUpdating(false);
    }
  }

  // Supprimer un pack
  function handleDeletePack(pack) {
    if (updating) return;

    setConfirmDialog({
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

          setToast({ type: 'success', message: 'Pack supprimé avec succès' });
          await fetchPacks();
        } catch (error) {
          console.error('Error deleting pack:', error);
          setToast({ type: 'error', message: error.message });
        } finally {
          setUpdating(false);
        }
      },
    });
  }

  if (loading && plans.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white/60">Chargement des plans d'abonnement...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* KPI Cards - Plans & Packs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* KPI Plans */}
        <KPICard
          icon="💳"
          label="Plans disponibles"
          value={plans.length}
          subtitle="au total"
          description="Nombre total de plans d'abonnement configurés"
        />
        <KPICard
          icon="💰"
          label="Plan le plus cher"
          value={
            plans.length > 0
              ? `${Math.max(...plans.map((p) => p.priceMonthly)).toFixed(2)} €`
              : '-'
          }
          subtitle="par mois"
          description="Tarif mensuel le plus élevé parmi les plans disponibles"
        />
        <KPICard
          icon="🎁"
          label="Plans gratuits"
          value={plans.filter((p) => p.priceMonthly === 0).length}
          subtitle="disponibles"
          description="Nombre de plans avec un tarif gratuit"
        />

        {/* KPI Packs */}
        <KPICard
          icon="🎫"
          label="Packs disponibles"
          value={packs.length}
          subtitle="au total"
          description="Nombre total de packs de crédits configurés"
        />
        <KPICard
          icon="💵"
          label="Pack le plus cher"
          value={
            packs.length > 0
              ? `${Math.max(...packs.map((p) => p.price)).toFixed(2)} €`
              : '-'
          }
          subtitle="prix maximum"
          description="Prix le plus élevé parmi les packs disponibles"
        />
        <KPICard
          icon="⚡"
          label="Crédits moyens/pack"
          value={
            packs.length > 0
              ? Math.round(packs.reduce((sum, p) => sum + p.creditAmount, 0) / packs.length)
              : 0
          }
          subtitle="crédits"
          description="Nombre moyen de crédits par pack"
        />
      </div>

      {/* Bouton créer plan */}
      <div className="flex justify-end">
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Créer un plan
        </button>
      </div>

      {/* Titre Section Plans */}
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <span>💳</span> Plans d'abonnement
      </h2>

      {/* Liste des plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const enabledFeatures = plan.featureLimits.filter((fl) => fl.isEnabled).length;
          const unlimitedCvs = plan.maxCvCount === -1;

          return (
            <div
              key={plan.id}
              className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6 hover:border-white/30 hover:bg-white/10 transition-all flex flex-col"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-sm text-white/60 mt-1">{plan.description}</p>
                  )}
                </div>
                <div className="text-2xl">💳</div>
              </div>

              {/* Prix */}
              <div className="mb-4 pb-4 border-b border-white/10">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">
                    {plan.priceMonthly.toFixed(2)}
                  </span>
                  <span className="text-white/60">{plan.priceCurrency}/mois</span>
                </div>
                {plan.yearlyDiscountPercent > 0 && (
                  <div className="text-sm text-green-400 mt-1">
                    ou {plan.priceYearly.toFixed(2)} {plan.priceCurrency}/an (-
                    {plan.yearlyDiscountPercent.toFixed(0)}%)
                  </div>
                )}
              </div>

              {/* Limitations */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">CV maximum</span>
                  <span className="text-white font-medium">
                    {unlimitedCvs ? 'Illimité' : plan.maxCvCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Features activées</span>
                  <span className="text-white font-medium">
                    {enabledFeatures} / {Object.keys(MACRO_FEATURES).length}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-auto">
                <button
                  onClick={() => openEditModal(plan)}
                  disabled={updating}
                  className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Éditer
                </button>
                <button
                  onClick={() => handleDeletePlan(plan)}
                  disabled={updating}
                  className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Supprimer
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========== CREDIT PACKS SECTION ========== */}
      <div className="mt-12 pt-8 border-t border-white/20">
        {/* Titre Section Packs */}
        <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
          <span>🎫</span> Packs de crédits
        </h2>

        {/* Bouton créer pack */}
        <div className="flex justify-end mb-6">
          <button
            onClick={openCreatePackModal}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Créer un pack
          </button>
        </div>

        {/* Liste des packs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packs.map((pack) => (
            <div
              key={pack.id}
              className={`bg-white/5 backdrop-blur-xl rounded-lg border p-6 hover:border-white/30 hover:bg-white/10 transition-all flex flex-col ${
                pack.isActive ? 'border-white/10' : 'border-red-500/30 opacity-60'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{pack.name}</h3>
                  {pack.description && (
                    <p className="text-sm text-white/60 mt-1">{pack.description}</p>
                  )}
                  {!pack.isActive && (
                    <span className="inline-block mt-2 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
                      Désactivé
                    </span>
                  )}
                </div>
                <div className="text-2xl">🎫</div>
              </div>

              {/* Prix et Crédits */}
              <div className="mb-4 pb-4 border-b border-white/10">
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-bold text-white">
                    {pack.price.toFixed(2)}
                  </span>
                  <span className="text-white/60">{pack.priceCurrency}</span>
                </div>
                <div className="text-sm text-green-400">
                  {pack.creditAmount} crédits
                </div>
                <div className="text-xs text-white/40 mt-1">
                  {(pack.price / pack.creditAmount).toFixed(2)} {pack.priceCurrency}/crédit
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-auto">
                <button
                  onClick={() => openEditPackModal(pack)}
                  disabled={updating}
                  className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Éditer
                </button>
                <button
                  onClick={() => handleDeletePack(pack)}
                  disabled={updating}
                  className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Créer Plan */}
      {showCreateModal && (
        <PlanModal
          title="Créer un plan d'abonnement"
          formData={formData}
          setFormData={setFormData}
          featureLimits={featureLimits}
          setFeatureLimits={setFeatureLimits}
          onSave={handleCreatePlan}
          onCancel={() => setShowCreateModal(false)}
          updating={updating}
        />
      )}

      {/* Modal Éditer Plan */}
      {showEditModal && selectedPlan && (
        <PlanModal
          title={`Éditer le plan "${selectedPlan.name}"`}
          formData={formData}
          setFormData={setFormData}
          featureLimits={featureLimits}
          setFeatureLimits={setFeatureLimits}
          onSave={handleUpdatePlan}
          onCancel={() => {
            setShowEditModal(false);
            setSelectedPlan(null);
          }}
          updating={updating}
        />
      )}

      {/* Modal Créer Pack */}
      {showCreatePackModal && (
        <PackModal
          title="Créer un pack de crédits"
          formData={packFormData}
          setFormData={setPackFormData}
          onSave={handleCreatePack}
          onCancel={() => setShowCreatePackModal(false)}
          updating={updating}
        />
      )}

      {/* Modal Éditer Pack */}
      {showEditPackModal && selectedPack && (
        <PackModal
          title={`Éditer le pack "${selectedPack.name}"`}
          formData={packFormData}
          setFormData={setPackFormData}
          onSave={handleUpdatePack}
          onCancel={() => {
            setShowEditPackModal(false);
            setSelectedPack(null);
          }}
          updating={updating}
        />
      )}

      {/* Toast et Confirm Dialog */}
      <Toast toast={toast} onClose={() => setToast(null)} />
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}

// Composant Modal pour créer/éditer un plan
function PlanModal({ title, formData, setFormData, featureLimits, setFeatureLimits, onSave, onCancel, updating }) {
  // Calculer le prix annuel estimé en temps réel
  const priceMonthly = parseFloat(formData.priceMonthly) || 0;
  const discountPercent = parseFloat(formData.yearlyDiscountPercent) || 0;
  const estimatedYearlyPrice = priceMonthly * 12 * (1 - discountPercent / 100);

  // Appliquer la réduction calculée au prix annuel
  function applyCalculatedDiscount() {
    setFormData({ ...formData, priceYearly: estimatedYearlyPrice.toString() });
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-[9999] p-4 pt-32 overflow-y-auto">
      <div className="bg-gray-900 border border-white/20 rounded-lg p-6 max-w-4xl w-full my-8">
        <h3 className="text-xl font-bold text-white mb-6">{title}</h3>

        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 scrollbar-hide">
          {/* Section: Informations générales */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-white border-b border-white/10 pb-2">
              Informations générales
            </h4>

            <div>
              <label className="text-white/60 text-sm mb-2 block">Nom du plan *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-none focus:border-blue-400/50 transition"
                placeholder="Gratuit, Pro, Premium..."
              />
            </div>

            <div>
              <label className="text-white/60 text-sm mb-2 block">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-none focus:border-blue-400/50 transition resize-none"
                placeholder="Description du plan..."
                rows={3}
              />
            </div>

            {/* Grille des prix - 2 lignes */}
            <div className="space-y-3">
              {/* Ligne 1: Prix mensuel, Réduction, Devise */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-white/60 text-sm mb-2 block">Prix mensuel *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.priceMonthly}
                    onChange={(e) => setFormData({ ...formData, priceMonthly: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-none focus:border-blue-400/50 transition"
                  />
                </div>

                <div>
                  <label className="text-white/60 text-sm mb-2 block flex items-center gap-1">
                    Réduction annuelle (%) *
                    <span className="text-xs text-white/40" title="Pourcentage de réduction pour l'abonnement annuel">ℹ️</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.yearlyDiscountPercent}
                    onChange={(e) => setFormData({ ...formData, yearlyDiscountPercent: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-none focus:border-blue-400/50 transition"
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

              {/* Ligne 2: Prix annuel estimé + Bouton Appliquer */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="text-white/60 text-sm mb-2 block">Prix annuel estimé (calculé automatiquement)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={estimatedYearlyPrice.toFixed(2)}
                    disabled
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/60 text-sm cursor-not-allowed"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={applyCalculatedDiscount}
                    className="w-full px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition text-sm border border-green-500/30"
                    title="Appliquer le prix calculé comme prix annuel officiel"
                  >
                    Appliquer
                  </button>
                </div>
              </div>

              <div className="text-xs text-white/40 bg-white/5 p-3 rounded border border-white/10">
                ℹ️ Le prix annuel estimé est calculé automatiquement : <strong>prix mensuel × 12 × (1 - réduction%)</strong>.
                Cliquez sur "Appliquer" pour l'utiliser comme prix annuel officiel.
              </div>
            </div>
          </div>

          {/* Section: Limitations globales */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-white border-b border-white/10 pb-2">
              Limitations globales
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/60 text-sm mb-2 block">
                  Nombre max de CV (-1 = illimité) *
                </label>
                <input
                  type="number"
                  min="-1"
                  value={formData.maxCvCount}
                  onChange={(e) => setFormData({ ...formData, maxCvCount: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-none focus:border-blue-400/50 transition"
                />
              </div>

            </div>
          </div>

          {/* Section: Features (Macro-features) */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-white border-b border-white/10 pb-2">
              Configuration des features
            </h4>

            <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
              <div className="overflow-x-auto scrollbar-hide">
                <table className="min-w-full divide-y divide-white/10">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">
                        Feature
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-white/60 uppercase">
                        Activée
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-white/60 uppercase">
                        Limite
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-white/60 uppercase">
                        Niveaux d'analyse
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {Object.entries(MACRO_FEATURES).map(([featureName, config]) => {
                      const limit = featureLimits[featureName] || {
                        isEnabled: true,
                        usageLimit: -1,
                        allowedAnalysisLevels: null,
                      };

                      const isAIFeature = AI_FEATURES.includes(featureName);
                      const hasAnalysisLevels = ANALYSIS_LEVEL_FEATURES.includes(featureName);

                      return (
                        <tr key={featureName} className="hover:bg-white/5 transition">
                          {/* Feature name */}
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-white">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{config.icon}</span>
                              <div>
                                <div className="font-medium">{config.name}</div>
                                {config.description && (
                                  <div className="text-xs text-white/40">{config.description}</div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Activée */}
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center">
                              <ToggleSwitch
                                enabled={limit.isEnabled}
                                onChange={(enabled) =>
                                  setFeatureLimits({
                                    ...featureLimits,
                                    [featureName]: { ...limit, isEnabled: enabled },
                                  })
                                }
                              />
                            </div>
                          </td>

                          {/* Limite */}
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="-1"
                              value={limit.usageLimit}
                              onChange={(e) =>
                                setFeatureLimits({
                                  ...featureLimits,
                                  [featureName]: {
                                    ...limit,
                                    usageLimit: parseInt(e.target.value, 10) || 0,
                                  },
                                })
                              }
                              disabled={!limit.isEnabled}
                              className="w-24 mx-auto block px-3 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm text-center focus:outline-none focus:border-blue-400/50 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/5"
                            />
                          </td>

                          {/* Niveaux d'analyse */}
                          <td className="px-4 py-3">
                            {hasAnalysisLevels && (
                              <div className="flex gap-2 justify-center items-center flex-wrap">
                                {['rapid', 'medium', 'deep'].map((level) => {
                                  const isChecked = limit.allowedAnalysisLevels?.includes(level) || false;
                                  return (
                                    <label
                                      key={level}
                                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition ${
                                        !limit.isEnabled
                                          ? 'opacity-50 cursor-not-allowed'
                                          : isChecked
                                          ? 'bg-blue-500/20 text-blue-400 border border-blue-400/30'
                                          : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          const currentLevels = limit.allowedAnalysisLevels || [];
                                          const newLevels = e.target.checked
                                            ? [...currentLevels, level]
                                            : currentLevels.filter((l) => l !== level);

                                          setFeatureLimits({
                                            ...featureLimits,
                                            [featureName]: {
                                              ...limit,
                                              allowedAnalysisLevels: newLevels.length > 0 ? newLevels : null,
                                            },
                                          });
                                        }}
                                        disabled={!limit.isEnabled}
                                        className="w-3 h-3"
                                      />
                                      <span className="capitalize">{level}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
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
            className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updating ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Composant Modal pour créer/éditer un pack de crédits
function PackModal({ title, formData, setFormData, onSave, onCancel, updating }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-[9999] p-4 pt-32 overflow-y-auto">
      <div className="bg-gray-900 border border-white/20 rounded-lg p-6 max-w-2xl w-full my-8">
        <h3 className="text-xl font-bold text-white mb-6">{title}</h3>

        <div className="space-y-6">
          {/* Nom du pack */}
          <div>
            <label className="text-white/60 text-sm mb-2 block">Nom du pack *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-none focus:border-blue-400/50 transition"
              placeholder="Pack Starter, Pack Pro..."
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-white/60 text-sm mb-2 block">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-none focus:border-blue-400/50 transition resize-none"
              placeholder="Description du pack..."
              rows={3}
            />
          </div>

          {/* Nombre de crédits */}
          <div>
            <label className="text-white/60 text-sm mb-2 block">Nombre de crédits *</label>
            <input
              type="number"
              min="1"
              value={formData.creditAmount}
              onChange={(e) => setFormData({ ...formData, creditAmount: parseInt(e.target.value, 10) || 0 })}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-none focus:border-blue-400/50 transition"
            />
          </div>

          {/* Prix et Devise */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white/60 text-sm mb-2 block">Prix *</label>
              <input
                type="text"
                inputMode="decimal"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-none focus:border-blue-400/50 transition"
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

          {/* Prix unitaire calculé */}
          {formData.creditAmount > 0 && formData.price > 0 && (
            <div className="text-sm text-white/40 bg-white/5 p-3 rounded border border-white/10">
              Prix par crédit : <strong className="text-white/60">{(formData.price / formData.creditAmount).toFixed(2)} {formData.priceCurrency}</strong>
            </div>
          )}

          {/* Statut actif */}
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
