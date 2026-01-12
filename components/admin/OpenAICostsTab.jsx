'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { KPICard } from './KPICard';
import { CustomSelect } from './CustomSelect';
import { Toast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import EditAlertModal from './EditAlertModal';
import { CvGenerationCostsSection } from './CvGenerationCostsSection';
import { getFeatureConfig } from '@/lib/analytics/featureConfig';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';

export function OpenAICostsTab({ period, userId, refreshKey, isInitialLoad, triggeredAlerts }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPricing, setShowPricing] = useState(false);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [alertsFilter, setAlertsFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [stableTopFeature, setStableTopFeature] = useState({ feature: 'N/A', name: 'N/A', cost: 0 });
  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [lastGenerationCost, setLastGenerationCost] = useState(null); // Cout reel de la derniere generation CV
  const [cvGenerationTotals, setCvGenerationTotals] = useState(null); // Totaux des couts de generation CV sur la periode
  const pricingScrollRef = useRef(null);
  const alertsScrollRef = useRef(null);

  // Pricing management state
  const [pricings, setPricings] = useState([]);
  const [editingPricing, setEditingPricing] = useState(null);
  const [pricingForm, setPricingForm] = useState({
    modelName: '',
    inputPricePerMToken: '',
    outputPricePerMToken: '',
    cachePricePerMToken: '',
    description: '',
    isActive: true,
  });

  // Alerts management state
  const [alerts, setAlerts] = useState([]);
  const [selectedAlertForEdit, setSelectedAlertForEdit] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchData();
    fetchPricings(); // Fetch pricing data for tooltip calculations
    fetchBalance(); // Fetch OpenAI account balance
    fetchAlerts(); // Fetch alerts on mount
    fetchLastGenerationCost(); // Fetch real cost of last CV generation
  }, [period, userId, refreshKey]);

  useEffect(() => {
    if (showPricing) {
      fetchPricings();
    }
  }, [showPricing]);

  useEffect(() => {
    if (showAlertForm) {
      fetchAlerts(); // Refresh alerts when form is shown
    }
  }, [showAlertForm]);

  // Empêcher le scroll chaining pour la liste de pricing
  useEffect(() => {
    const scrollContainer = pricingScrollRef.current;
    if (!showPricing || !scrollContainer) return;

    function preventScrollChaining(e) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const isAtTop = scrollTop <= 1;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

      // Bloquer seulement aux limites
      if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    scrollContainer.addEventListener('wheel', preventScrollChaining, { passive: false });

    return () => {
      scrollContainer.removeEventListener('wheel', preventScrollChaining);
    };
  }, [showPricing]);

  // Empêcher le scroll chaining pour la liste d'alertes
  useEffect(() => {
    const scrollContainer = alertsScrollRef.current;
    if (!showAlertForm || !scrollContainer) return;

    function preventScrollChaining(e) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const isAtTop = scrollTop <= 1;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

      // Bloquer seulement aux limites
      if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    scrollContainer.addEventListener('wheel', preventScrollChaining, { passive: false });

    return () => {
      scrollContainer.removeEventListener('wheel', preventScrollChaining);
    };
  }, [showAlertForm]);

  // Données groupées pour le graphique "Comparaison des derniers coûts"
  // Note: placé ici (avant les early returns) pour respecter les règles des hooks
  const groupedChartData = useMemo(() => {
    if (!data?.byFeature) return [];

    // Regrouper les features cv_pipeline_v2_* en une seule "Génération de CV"
    const pipelineFeatures = data.byFeature.filter(f => f.feature.startsWith('cv_pipeline_v2_'));
    const otherFeatures = data.byFeature.filter(f => !f.feature.startsWith('cv_pipeline_v2_'));

    const chartData = [];

    // Ajouter "Génération de CV" si des features du pipeline existent
    // Utiliser lastGenerationCost (API cv-generation-costs) pour les vraies donnees de la derniere generation
    if (pipelineFeatures.length > 0) {
      // Utiliser les donnees reelles de la derniere generation si disponibles
      // Sinon, fallback sur les donnees agregees (moins precises)
      const useRealData = lastGenerationCost !== null;

      chartData.push({
        name: 'Génération de CV',
        lastCost: useRealData ? lastGenerationCost.cost : pipelineFeatures.reduce((sum, f) => sum + (f.lastCost || 0), 0),
        lastModel: 'Multiple',
        lastPromptTokens: useRealData ? lastGenerationCost.promptTokens : pipelineFeatures.reduce((sum, f) => sum + (f.lastPromptTokens || 0), 0),
        lastCachedTokens: useRealData ? lastGenerationCost.cachedTokens : pipelineFeatures.reduce((sum, f) => sum + (f.lastCachedTokens || 0), 0),
        lastCompletionTokens: useRealData ? lastGenerationCost.completionTokens : pipelineFeatures.reduce((sum, f) => sum + (f.lastCompletionTokens || 0), 0),
        lastTokens: useRealData ? lastGenerationCost.totalTokens : pipelineFeatures.reduce((sum, f) => sum + (f.lastTokens || 0), 0),
        lastCallDate: useRealData ? lastGenerationCost.createdAt : pipelineFeatures.reduce((latest, f) => {
          if (!f.lastCallDate) return latest;
          if (!latest) return f.lastCallDate;
          return new Date(f.lastCallDate) > new Date(latest) ? f.lastCallDate : latest;
        }, null),
        lastDuration: useRealData ? lastGenerationCost.durationMs : pipelineFeatures.reduce((sum, f) => sum + (f.lastDuration || 0), 0),
        fill: '#10B981', // Vert emeraude
        isGrouped: true,
        subtaskCount: useRealData ? lastGenerationCost.subtaskCount : pipelineFeatures.length,
      });
    }

    // Ajouter les autres features
    otherFeatures.forEach((feature) => {
      const featureConfig = getFeatureConfig(feature.feature);
      chartData.push({
        name: featureConfig.name || 'Feature non configurée',
        lastCost: feature.lastCost || 0,
        lastModel: feature.lastModel || 'N/A',
        lastPromptTokens: feature.lastPromptTokens || 0,
        lastCachedTokens: feature.lastCachedTokens || 0,
        lastCompletionTokens: feature.lastCompletionTokens || 0,
        lastTokens: feature.lastTokens || 0,
        lastCallDate: feature.lastCallDate || null,
        lastDuration: feature.lastDuration || null,
        fill: featureConfig.colors?.solid || '#6B7280',
        isGrouped: false,
      });
    });

    // Trier par coût décroissant
    return chartData.sort((a, b) => (b.lastCost || 0) - (a.lastCost || 0));
  }, [data?.byFeature, lastGenerationCost]);

  // Données groupées pour le tableau "Répartition par feature" et le pie chart
  // Utilise cvGenerationTotals (API cv-generation-costs) comme source de verite pour les couts CV
  const groupedFeatureData = useMemo(() => {
    if (!data?.byFeature) return [];

    // Filtrer les features cv_pipeline_v2_* (on les remplace par cvGenerationTotals)
    const otherFeatures = data.byFeature.filter(f => !f.feature.startsWith('cv_pipeline_v2_'));

    const result = [];

    // Ajouter "Génération de CV" si on a des donnees de l'API cv-generation-costs
    // Note: "calls" = nombre de generations (pas le nombre de subtasks)
    if (cvGenerationTotals && cvGenerationTotals.totalCost > 0) {
      result.push({
        feature: 'cv_generation_grouped',
        name: 'Génération de CV',
        calls: cvGenerationTotals.generationCount, // Nombre de generations, pas de subtasks
        tokens: cvGenerationTotals.totalTokens,
        cost: cvGenerationTotals.totalCost,
        color: '#10B981', // Vert emeraude
        isGrouped: true,
      });
    }

    // Ajouter les autres features
    otherFeatures.forEach((feature) => {
      const featureConfig = getFeatureConfig(feature.feature);
      result.push({
        feature: feature.feature,
        name: featureConfig.name || 'Feature non configurée',
        calls: feature.calls || 0,
        tokens: feature.tokens || 0,
        cost: feature.cost || 0,
        color: featureConfig.colors?.solid || '#6B7280',
        isGrouped: false,
        levelBreakdown: feature.levelBreakdown,
      });
    });

    // Trier par coût décroissant
    return result.sort((a, b) => (b.cost || 0) - (a.cost || 0));
  }, [data?.byFeature, cvGenerationTotals]);

  // Calculer le cout total corrige (exclut cv_pipeline_v2_* de OpenAIUsage, utilise cvGenerationTotals)
  const correctedTotalCost = useMemo(() => {
    if (!data?.byFeature) return 0;

    // Cout des features non-pipeline depuis OpenAIUsage
    const otherFeaturesCost = data.byFeature
      .filter(f => !f.feature.startsWith('cv_pipeline_v2_'))
      .reduce((sum, f) => sum + (f.cost || 0), 0);

    // Ajouter le cout CV depuis cvGenerationTotals (source de verite)
    const cvCost = cvGenerationTotals?.totalCost || 0;

    return otherFeaturesCost + cvCost;
  }, [data?.byFeature, cvGenerationTotals]);

  // Calculer le nombre total d'appels corrige
  const correctedTotalCalls = useMemo(() => {
    if (!data?.byFeature) return 0;

    const otherFeaturesCalls = data.byFeature
      .filter(f => !f.feature.startsWith('cv_pipeline_v2_'))
      .reduce((sum, f) => sum + (f.calls || 0), 0);

    const cvCalls = cvGenerationTotals?.totalCalls || 0;

    return otherFeaturesCalls + cvCalls;
  }, [data?.byFeature, cvGenerationTotals]);

  // Stabiliser la top feature pour éviter les scintillements lors des refreshes
  // Utilise groupedFeatureData pour prendre en compte le regroupement "Génération de CV"
  // Note: placé après les useMemo pour éviter l'erreur "Cannot access before initialization"
  useEffect(() => {
    if (groupedFeatureData && groupedFeatureData.length > 0) {
      // groupedFeatureData est déjà trié par coût décroissant
      const newTopFeature = groupedFeatureData[0];

      // Ne mettre à jour que si la feature change réellement (pas juste un re-order temporaire)
      if (newTopFeature.feature !== stableTopFeature.feature ||
          Math.abs(newTopFeature.cost - stableTopFeature.cost) > 0.01) {
        setStableTopFeature({
          feature: newTopFeature.feature,
          name: newTopFeature.name,
          cost: newTopFeature.cost,
        });
      }
    }
  }, [groupedFeatureData, stableTopFeature.feature, stableTopFeature.cost]);

  const fetchData = async () => {
    try {
      // Only show loader if no data yet (initial load)
      if (!data) {
        setLoading(true);
      }
      const url = new URL('/api/analytics/openai-usage', window.location.origin);
      url.searchParams.set('period', period);
      if (userId) {
        url.searchParams.set('userId', userId);
      }
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      console.error('Error fetching OpenAI usage data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPricings = async () => {
    try {
      const response = await fetch('/api/admin/openai-pricing');
      if (!response.ok) throw new Error('Failed to fetch pricings');
      const result = await response.json();
      setPricings(result.pricings || []);
    } catch (err) {
      console.error('Error fetching pricings:', err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/admin/openai-alerts');
      if (!response.ok) throw new Error('Failed to fetch alerts');
      const result = await response.json();
      setAlerts(result.alerts || []);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  const fetchBalance = async () => {
    try {
      setBalanceLoading(true);
      const response = await fetch('/api/admin/openai-balance');
      if (!response.ok) throw new Error('Failed to fetch balance');
      const result = await response.json();
      setBalance(result.balance);
    } catch (err) {
      console.error('Error fetching balance:', err);
      setBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  };

  const fetchLastGenerationCost = async () => {
    try {
      // Recuperer toutes les generations de la periode pour avoir les totaux corrects
      const url = new URL('/api/analytics/cv-generation-costs', window.location.origin);
      url.searchParams.set('period', period);
      url.searchParams.set('limit', '100'); // Suffisant pour couvrir la periode

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch last generation cost');

      const result = await response.json();

      // Stocker les totaux de la periode (pour la repartition par feature)
      if (result.totals) {
        setCvGenerationTotals({
          totalCost: result.totals.totalCost,
          totalCalls: result.totals.totalSubtasks,
          totalTokens: result.totals.totalPromptTokens + result.totals.totalCompletionTokens,
          generationCount: result.totals.generationCount,
        });
      } else {
        setCvGenerationTotals(null);
      }

      // Si on a au moins une generation, stocker les donnees de la derniere (pour le graphique des derniers couts)
      if (result.generations && result.generations.length > 0) {
        const lastGen = result.generations[0];
        setLastGenerationCost({
          cost: lastGen.totals.estimatedCost,
          promptTokens: lastGen.totals.promptTokens,
          cachedTokens: lastGen.totals.cachedTokens,
          completionTokens: lastGen.totals.completionTokens,
          totalTokens: lastGen.totals.totalTokens,
          durationMs: lastGen.totals.durationMs,
          createdAt: lastGen.createdAt,
          subtaskCount: lastGen.totals.subtaskCount,
        });
      } else {
        setLastGenerationCost(null);
      }
    } catch (err) {
      console.error('Error fetching last generation cost:', err);
      setLastGenerationCost(null);
      setCvGenerationTotals(null);
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
      setEditingPricing(null);
      setPricingForm({
        modelName: '',
        inputPricePerMToken: '',
        outputPricePerMToken: '',
        cachePricePerMToken: '',
        description: '',
        isActive: true,
      });
      setToast({ type: 'success', message: 'Tarif sauvegardé avec succès' });
    } catch (err) {
      console.error('Error saving pricing:', err);
      setToast({ type: 'error', message: 'Erreur lors de la sauvegarde du tarif' });
    }
  };

  const handleDeletePricing = async (modelName) => {
    setConfirmDialog({
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
          setToast({ type: 'success', message: 'Tarif supprimé avec succès' });
        } catch (err) {
          console.error('Error deleting pricing:', err);
          setToast({ type: 'error', message: 'Erreur lors de la suppression du tarif' });
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
      description: pricing.description || '',
      isActive: pricing.isActive,
    });
  };

  const handleDeleteAlert = async (id) => {
    setConfirmDialog({
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
          setToast({ type: 'success', message: 'Alerte supprimée avec succès' });
        } catch (err) {
          console.error('Error deleting alert:', err);
          setToast({ type: 'error', message: 'Erreur lors de la suppression de l\'alerte' });
        }
      }
    });
  };

  const handleEditAlert = (alert) => {
    setSelectedAlertForEdit(alert);
    setShowEditModal(true);
  };

  const handleSaveAlertFromModal = async (alertData) => {
    try {
      // Only include id if it exists (edit mode vs create mode)
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

      // Different success message based on mode
      const successMessage = alertData.id
        ? 'Alerte mise à jour avec succès'
        : 'Alerte créée avec succès';
      setToast({ type: 'success', message: successMessage });
    } catch (err) {
      console.error('Error saving alert:', err);
      // Re-throw for modal to handle
      throw err;
    }
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedAlertForEdit(null);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white/60">Chargement des données...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-400">Erreur : {error}</div>
      </div>
    );
  }

  if (!data) return null;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('fr-FR').format(value);
  };

  const formatAnalysisLevel = (level) => {
    const levelLabels = {
      'rapid': 'Rapide',
      'medium': 'Normal',
      'deep': 'Approffondi',
      'unknown': 'Non spécifié',
    };
    return levelLabels[level] || level;
  };

  // Calculate average cost per call (utilise les valeurs corrigees)
  const avgCostPerCall = correctedTotalCalls > 0 ? correctedTotalCost / correctedTotalCalls : 0;

  // Utiliser la top feature stabilisée pour éviter les scintillements
  const topFeature = stableTopFeature;

  // Utiliser le nom stocké dans stableTopFeature (inclut "Génération de CV" groupé)
  const topFeatureLabel = topFeature.name || topFeature.feature || 'N/A';

  const alertTypeLabels = {
    user_daily: 'Utilisateur - Journalier',
    user_monthly: 'Utilisateur - Mensuel',
    global_daily: 'Global - Journalier',
    global_monthly: 'Global - Mensuel',
    feature_daily: 'Feature - Journalier',
  };

  // Format balance subtitle with color
  const getBalanceSubtitle = () => {
    if (balanceLoading) {
      return { text: 'Chargement du solde...', color: 'text-white/60' };
    }

    // Don't show anything if balance is not available (personal accounts don't have access to billing API)
    if (balance === null || balance === undefined) {
      return null;
    }

    const balanceText = `Solde: ${formatCurrency(balance)}`;

    // Color based on amount
    if (balance < 5) {
      return { text: balanceText, color: 'text-red-400' };
    } else if (balance < 10) {
      return { text: balanceText, color: 'text-orange-400' };
    } else {
      return { text: balanceText, color: 'text-green-400' };
    }
  };

  const balanceSubtitle = getBalanceSubtitle();

  return (
    <div className="space-y-6 pb-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon="💰"
          label="Coût total"
          value={formatCurrency(correctedTotalCost)}
          subtitle={balanceSubtitle?.text}
          subtitleClassName={balanceSubtitle?.color}
          trend={null}
          description="Coût total des appels OpenAI pour la période sélectionnée, incluant tous les modèles et features"
        />
        <KPICard
          icon="🎯"
          label="Total tokens"
          value={formatNumber(data.total.totalTokens)}
          subtitle={`${formatNumber(correctedTotalCalls)} appels`}
          description={`Nombre total de tokens consommés (input + output). Input: ${formatNumber(data.total.promptTokens)} (dont ${formatNumber(data.total.cachedTokens)} en cache), Output: ${formatNumber(data.total.completionTokens)}`}
        />
        <KPICard
          icon="📊"
          label="Coût moyen/appel"
          value={formatCurrency(avgCostPerCall)}
          trend={null}
          description="Coût moyen par appel à l'API OpenAI, calculé en divisant le coût total par le nombre d'appels"
        />
        <KPICard
          icon="⭐"
          label="Feature #1"
          value={topFeatureLabel}
          subtitle={formatCurrency(topFeature.cost)}
          description="La feature qui a généré le plus de coûts OpenAI sur la période"
        />
      </div>

      {/* Last Cost Comparison Chart */}
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Comparaison des derniers coûts par feature</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={groupedChartData}
            layout="vertical"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              type="number"
              stroke="rgba(255,255,255,0.6)"
              tick={{ fill: 'rgba(255,255,255,0.6)' }}
              tickFormatter={(value) => formatCurrency(value)}
              domain={[0, (dataMax) => dataMax * 1.1]}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              stroke="rgba(255,255,255,0.6)"
              tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;

                  const formatDate = (dateStr) => {
                    if (!dateStr) return 'N/A';
                    const date = new Date(dateStr);
                    return new Intl.DateTimeFormat('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(date);
                  };

                  const formatDuration = (ms) => {
                    if (!ms) return 'N/A';
                    if (ms < 1000) return `${ms}ms`;
                    return `${(ms / 1000).toFixed(2)}s`;
                  };

                  // Pour les features groupées (Génération de CV), afficher les totaux
                  if (data.isGrouped) {
                    return (
                      <div className="bg-black/95 backdrop-blur-xl border border-white/20 rounded-lg p-3 shadow-2xl">
                        <p className="text-white font-semibold mb-2">{data.name}</p>

                        {/* Totaux globaux */}
                        <div className="space-y-1">
                          <div className="border-b border-white/10 pb-1 mb-1">
                            <p className="text-xs text-white/60 mb-1">Détail des tokens:</p>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-xs text-cyan-300">Input:</span>
                              <span className="text-white text-xs">{formatNumber(data.lastPromptTokens - data.lastCachedTokens)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-xs text-indigo-300">Cache:</span>
                              <span className="text-white text-xs">{formatNumber(data.lastCachedTokens)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-xs text-purple-300">Output:</span>
                              <span className="text-white text-xs">{formatNumber(data.lastCompletionTokens)}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-white/80 font-medium">Total:</span>
                            <span className="text-white text-sm font-medium">{formatNumber(data.lastTokens)} tokens</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-green-300 font-medium">Coût:</span>
                            <span className="text-white font-bold">{formatCurrency(data.lastCost)}</span>
                          </div>

                          <div className="border-t border-white/10 pt-1 mt-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-orange-300">Durée:</span>
                              <span className="text-white text-xs">{formatDuration(data.lastDuration)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-yellow-300">Date:</span>
                              <span className="text-white text-xs">{formatDate(data.lastCallDate)}</span>
                            </div>
                            {data.subtaskCount && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-white/60">Phases:</span>
                                <span className="text-white text-xs">{data.subtaskCount} subtasks</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Pour les features non groupées, afficher le tooltip classique
                  // Find pricing for this model
                  const pricing = pricings.find(p => p.modelName === data.lastModel);

                  // Calculate individual costs
                  let inputCost = 0;
                  let cachedCost = 0;
                  let outputCost = 0;

                  if (pricing) {
                    const nonCachedTokens = data.lastPromptTokens - data.lastCachedTokens;
                    inputCost = (nonCachedTokens / 1_000_000) * pricing.inputPricePerMToken;
                    cachedCost = (data.lastCachedTokens / 1_000_000) * pricing.cachePricePerMToken;
                    outputCost = (data.lastCompletionTokens / 1_000_000) * pricing.outputPricePerMToken;
                  }

                  return (
                    <div className="bg-black/95 backdrop-blur-xl border border-white/20 rounded-lg p-3 shadow-2xl">
                      <p className="text-white font-semibold mb-2">{data.name}</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-blue-300">Modèle:</span>
                          <span className="text-white text-sm">{data.lastModel}</span>
                        </div>

                        {/* Token breakdown with costs */}
                        <div className="border-t border-white/10 pt-1 mt-1">
                          <p className="text-xs text-white/60 mb-1">Détail des tokens:</p>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs text-cyan-300">Input:</span>
                            <span className="text-white text-xs">{formatNumber(data.lastPromptTokens - data.lastCachedTokens)} ({formatCurrency(inputCost)})</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs text-indigo-300">Cache:</span>
                            <span className="text-white text-xs">{formatNumber(data.lastCachedTokens)} ({formatCurrency(cachedCost)})</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs text-purple-300">Output:</span>
                            <span className="text-white text-xs">{formatNumber(data.lastCompletionTokens)} ({formatCurrency(outputCost)})</span>
                          </div>
                        </div>

                        <div className="border-t border-white/10 pt-1 mt-1">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-white/80 font-medium">Total:</span>
                            <span className="text-white text-sm font-medium">{formatNumber(data.lastTokens)} tokens</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-green-300 font-medium">Coût:</span>
                            <span className="text-white font-bold">{formatCurrency(data.lastCost)}</span>
                          </div>
                        </div>

                        <div className="border-t border-white/10 pt-1 mt-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-orange-300">Durée:</span>
                            <span className="text-white text-xs">{formatDuration(data.lastDuration)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-yellow-300">Date:</span>
                            <span className="text-white text-xs">{formatDate(data.lastCallDate)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="lastCost" radius={[0, 4, 4, 0]} isAnimationActive={isInitialLoad}>
              {groupedChartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <LabelList
                dataKey="lastCost"
                position="right"
                formatter={(value) => formatCurrency(value)}
                style={{ fill: 'rgba(255,255,255,0.9)', fontSize: '12px', fontWeight: '600' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* CV Generation Costs Section */}
      <CvGenerationCostsSection period={period} refreshKey={refreshKey} />

      {/* Feature Breakdown Table */}
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Répartition par feature</h3>
          <button
            onClick={() => setShowPricing(!showPricing)}
            className="px-3 py-1 text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-md transition"
          >
            {showPricing ? 'Masquer' : 'Gérer'} les tarifs
          </button>
        </div>

        {showPricing && (
          <div className="mb-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20 space-y-4">
            <h4 className="text-white font-semibold">Gestion des tarifs OpenAI</h4>

            {/* Pricing Form */}
            <form onSubmit={handleSavePricing} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 text-sm">Nom du modèle</label>
                  <input
                    type="text"
                    value={pricingForm.modelName}
                    onChange={(e) => setPricingForm({ ...pricingForm, modelName: e.target.value })}
                    disabled={editingPricing !== null}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-sm text-white text-sm disabled:opacity-50"
                    required
                  />
                </div>
                <div>
                  <label className="text-white/60 text-sm">Prix input ($/MTok)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pricingForm.inputPricePerMToken}
                    onChange={(e) => setPricingForm({ ...pricingForm, inputPricePerMToken: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-sm text-white text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-white/60 text-sm">Prix output ($/MTok)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pricingForm.outputPricePerMToken}
                    onChange={(e) => setPricingForm({ ...pricingForm, outputPricePerMToken: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-sm text-white text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-white/60 text-sm">Prix cache ($/MTok)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pricingForm.cachePricePerMToken}
                    onChange={(e) => setPricingForm({ ...pricingForm, cachePricePerMToken: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-sm text-white text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-white/60 text-sm">Description</label>
                  <input
                    type="text"
                    value={pricingForm.description}
                    onChange={(e) => setPricingForm({ ...pricingForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-sm text-white text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pricingForm.isActive}
                  onChange={(e) => setPricingForm({ ...pricingForm, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-white/60 text-sm">Actif</label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-sm text-sm transition"
                >
                  {editingPricing ? 'Mettre à jour' : 'Ajouter'}
                </button>
                {editingPricing && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPricing(null);
                      setPricingForm({
                        modelName: '',
                        inputPricePerMToken: '',
                        outputPricePerMToken: '',
                        cachePricePerMToken: '',
                        description: '',
                        isActive: true,
                      });
                    }}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-sm text-sm transition"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </form>

            {/* Pricing List */}
            <div ref={pricingScrollRef} className="space-y-2 max-h-64 overflow-y-auto [overscroll-behavior:contain]">
              {pricings.length === 0 ? (
                <div className="text-center py-4 text-white/60 text-sm">
                  Aucun tarif configuré
                </div>
              ) : (
                pricings.map((pricing) => (
                  <div key={pricing.modelName} className="flex items-center justify-between p-3 bg-white/5 rounded">
                    <div className="flex-1">
                      <div className="text-white font-medium">{pricing.modelName}</div>
                      <div className="text-white/60 text-sm">
                        Input: ${pricing.inputPricePerMToken}/MTok • Output: ${pricing.outputPricePerMToken}/MTok
                        {pricing.cachePricePerMToken > 0 && <span> • Cache: ${pricing.cachePricePerMToken}/MTok</span>}
                        {pricing.description && <span> • {pricing.description}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded ${pricing.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {pricing.isActive ? 'Actif' : 'Inactif'}
                      </span>
                      <button
                        onClick={() => handleEditPricing(pricing)}
                        className="px-2 py-1 text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded"
                      >
                        Éditer
                      </button>
                      <button
                        onClick={() => handleDeletePricing(pricing.modelName)}
                        className="px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Table */}
          <div className="lg:col-span-2 overflow-x-auto">
            <table className="w-full">
            <thead>
              <tr className="text-left text-white/60 text-sm border-b border-white/10">
                <th className="pb-3">Feature</th>
                <th className="pb-3 text-right">Appels</th>
                <th className="pb-3 text-right">Tokens</th>
                <th className="pb-3 text-right">Coût</th>
                <th className="pb-3 text-right">Coût/appel</th>
                <th className="pb-3 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {groupedFeatureData.map((feature, index) => {
                const percentage = correctedTotalCost > 0
                  ? ((feature.cost / correctedTotalCost) * 100).toFixed(1)
                  : 0;
                const avgCost = feature.calls > 0 ? feature.cost / feature.calls : 0;
                const hasLevelBreakdown = feature.levelBreakdown && feature.levelBreakdown.length > 0;

                return (
                  <React.Fragment key={index}>
                    {/* Main feature row */}
                    <tr className={`border-b border-white/5 text-white ${feature.isGrouped ? 'bg-emerald-500/5' : ''}`}>
                      <td className="py-3">
                        <span className="font-medium">{feature.name}</span>
                        {feature.isGrouped && (
                          <span className="ml-2 text-xs text-emerald-400/60">(groupé)</span>
                        )}
                      </td>
                      <td className="py-3 text-right text-white/80">
                        {formatNumber(feature.calls)}
                      </td>
                      <td className="py-3 text-right text-white/80">
                        {formatNumber(feature.tokens)}
                      </td>
                      <td className="py-3 text-right font-medium">
                        {formatCurrency(feature.cost)}
                      </td>
                      <td className="py-3 text-right text-white/80">
                        {formatCurrency(avgCost)}
                      </td>
                      <td className="py-3 text-right text-white/60">
                        {percentage}%
                      </td>
                    </tr>

                    {/* Level breakdown sub-rows */}
                    {hasLevelBreakdown && feature.levelBreakdown.map((levelData, levelIndex) => {
                      const levelPercentage = feature.cost > 0
                        ? ((levelData.cost / feature.cost) * 100).toFixed(1)
                        : 0;
                      const levelAvgCost = levelData.calls > 0 ? levelData.cost / levelData.calls : 0;

                      return (
                        <tr key={`${index}-level-${levelIndex}`} className="border-b border-white/5 text-white/70 bg-white/[0.02]">
                          <td className="py-2 pl-8">
                            <span className="text-sm">└─ {formatAnalysisLevel(levelData.level)}</span>
                          </td>
                          <td className="py-2 text-right text-sm">
                            {formatNumber(levelData.calls)}
                          </td>
                          <td className="py-2 text-right text-sm">
                            {formatNumber(levelData.tokens)}
                          </td>
                          <td className="py-2 text-right text-sm">
                            {formatCurrency(levelData.cost)}
                          </td>
                          <td className="py-2 text-right text-sm">
                            {formatCurrency(levelAvgCost)}
                          </td>
                          <td className="py-2 text-right text-sm">
                            {levelPercentage}%
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          </div>

          {/* Pie Chart */}
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={groupedFeatureData.map((feature) => ({
                    name: feature.name,
                    value: feature.cost,
                    percentage: correctedTotalCost > 0
                      ? ((feature.cost / correctedTotalCost) * 100).toFixed(1)
                      : 0,
                    color: feature.color,
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ percentage }) => `${percentage}%`}
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="value"
                  isAnimationActive={isInitialLoad}
                >
                  {groupedFeatureData.map((feature, index) => (
                    <Cell key={`cell-${index}`} fill={feature.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const pieData = payload[0];
                      return (
                        <div className="bg-black/95 backdrop-blur-xl border border-white/20 rounded-lg p-3 shadow-2xl">
                          <p className="text-white font-semibold mb-2">{pieData.name}</p>
                          <div className="space-y-1">
                            <p className="text-sm text-blue-300">
                              Coût: <span className="font-bold text-white">{formatCurrency(pieData.value)}</span>
                            </p>
                            <p className="text-sm text-green-300">
                              Part: <span className="font-bold text-white">{pieData.payload.percentage}%</span>
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  wrapperStyle={{ color: 'white' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Users and Models - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Users Table */}
        {data.topUsers && data.topUsers.length > 0 && (
          <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Top 10 utilisateurs par coût</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-white/60 text-sm border-b border-white/10">
                    <th className="pb-3">Utilisateur</th>
                    <th className="pb-3 text-right">Appels</th>
                    <th className="pb-3 text-right">Tokens</th>
                    <th className="pb-3 text-right">Coût total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topUsers.map((user, index) => {
                    // Check if user has exceeded any threshold
                    const userAlerts = triggeredAlerts?.triggeredAlerts?.filter(alert =>
                      (alert.type === 'user_daily' || alert.type === 'user_monthly') &&
                      alert.affectedUsers?.some(u => u.email === user.email)
                    ) || [];
                    const hasExceededThreshold = userAlerts.length > 0;

                    return (
                      <tr key={index} className="border-b border-white/5 text-white">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${hasExceededThreshold ? 'text-orange-400' : ''}`}>
                                  {user.email}
                                </span>
                                {hasExceededThreshold && (
                                  <span
                                    className="text-orange-400 cursor-help"
                                    title={`Alerte(s) déclenchée(s): ${userAlerts.map(a => a.name).join(', ')}`}
                                  >
                                    ⚠️
                                  </span>
                                )}
                              </div>
                              {user.name && (
                                <span className="block text-sm text-white/60">{user.name}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-right text-white/80">
                          {formatNumber(user.totalCalls)}
                        </td>
                        <td className="py-3 text-right text-white/80">
                          {formatNumber(user.totalTokens)}
                        </td>
                        <td className="py-3 text-right font-medium">
                          {formatCurrency(user.totalCost)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Models Breakdown */}
        <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Répartition par modèle</h3>
          <div className="space-y-3">
            {data.byModel.map((model, index) => {
              const percentage = data.total.cost > 0
                ? ((model.cost / data.total.cost) * 100).toFixed(1)
                : 0;

              return (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-medium">{model.model}</span>
                      <span className="text-white/60 text-sm">{percentage}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-white font-medium">{formatCurrency(model.cost)}</div>
                    <div className="text-white/60 text-sm">{formatNumber(model.tokens)} tokens</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Alertes de seuils</h3>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelectedAlertForEdit(null);
                setShowEditModal(true);
              }}
              className="px-3 py-1 text-sm bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-md transition"
            >
              + Nouvelle alerte
            </button>
            <button
              onClick={() => setShowAlertForm(!showAlertForm)}
              className="px-3 py-1 text-sm bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-md transition"
            >
              {showAlertForm ? 'Masquer guide' : 'Guide'}
            </button>
          </div>
        </div>

        {/* Filter Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setAlertsFilter('all')}
            className={`px-3 py-1 text-sm rounded-md transition ${
              alertsFilter === 'all'
                ? 'bg-blue-500/30 text-blue-400 border border-blue-400/50'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Toutes ({alerts.length})
          </button>
          <button
            onClick={() => setAlertsFilter('active')}
            className={`px-3 py-1 text-sm rounded-md transition ${
              alertsFilter === 'active'
                ? 'bg-green-500/30 text-green-400 border border-green-400/50'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Actives ({alerts.filter(a => a.enabled).length})
          </button>
          <button
            onClick={() => setAlertsFilter('inactive')}
            className={`px-3 py-1 text-sm rounded-md transition ${
              alertsFilter === 'inactive'
                ? 'bg-gray-500/30 text-gray-400 border border-gray-400/50'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Inactives ({alerts.filter(a => !a.enabled).length})
          </button>
        </div>

        {/* Alert List - Always visible */}
        <div className="space-y-2 mb-4">
          {alerts
            .filter(alert => {
              if (alertsFilter === 'active') return alert.enabled;
              if (alertsFilter === 'inactive') return !alert.enabled;
              return true;
            })
            .map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-3 bg-white/5 rounded-sm border border-white/10">
                <div className="flex-1">
                  <div className="text-white font-medium">{alert.name}</div>
                  <div className="text-white/60 text-sm">
                    {alertTypeLabels[alert.type]} • Seuil: ${alert.threshold}
                    {alert.description && <span> • {alert.description}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded ${alert.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {alert.enabled ? 'Activée' : 'Désactivée'}
                  </span>
                  <button
                    onClick={() => handleEditAlert(alert)}
                    className="px-2 py-1 text-xs bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded"
                  >
                    Éditer
                  </button>
                  <button
                    onClick={() => handleDeleteAlert(alert.id)}
                    className="px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          {alerts.filter(alert => {
            if (alertsFilter === 'active') return alert.enabled;
            if (alertsFilter === 'inactive') return !alert.enabled;
            return true;
          }).length === 0 && (
            <div className="text-center text-white/40 py-4">
              Aucune alerte {alertsFilter === 'active' ? 'active' : alertsFilter === 'inactive' ? 'inactive' : ''}
            </div>
          )}
        </div>

        {/* Alert Configuration Info - Collapsible */}
        {showAlertForm && (
          <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
            <h4 className="text-white font-semibold mb-2">📖 Guide d'utilisation des alertes</h4>
            <div className="text-white/70 text-sm space-y-2">
              <p>• <strong>Utilisateur - Journalier</strong> : Alerte si un utilisateur dépasse le seuil par jour</p>
              <p>• <strong>Utilisateur - Mensuel</strong> : Alerte si un utilisateur dépasse le seuil par mois (hybride Stripe/calendrier)</p>
              <p>• <strong>Global - Journalier</strong> : Alerte si le total global dépasse le seuil par jour</p>
              <p>• <strong>Global - Mensuel</strong> : Alerte si le total global dépasse le seuil par mois</p>
              <p>• <strong>Feature - Journalier</strong> : Alerte si une feature dépasse le seuil par jour</p>
              <p className="mt-3 text-emerald-400">💡 Cliquez sur "Éditer" pour modifier une alerte existante</p>
            </div>
          </div>
        )}
      </div>

      {/* Toast and Confirm Dialog */}
      <Toast toast={toast} onClose={() => setToast(null)} />
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />

      {/* Edit Alert Modal */}
      <EditAlertModal
        open={showEditModal}
        onClose={handleCloseEditModal}
        alert={selectedAlertForEdit}
        onSave={handleSaveAlertFromModal}
        alertTypeLabels={alertTypeLabels}
      />
    </div>
  );
}
