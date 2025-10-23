'use client';

import { useState, useEffect, useRef } from 'react';
import { KPICard } from './KPICard';
import { CustomSelect } from './CustomSelect';
import { Toast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import { getFeatureConfig } from '@/lib/analytics/featureConfig';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';

export function OpenAICostsTab({ period, refreshKey, isInitialLoad }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPricing, setShowPricing] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [stableTopFeature, setStableTopFeature] = useState({ feature: 'N/A', cost: 0 });
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
  const [editingAlert, setEditingAlert] = useState(null);
  const [alertForm, setAlertForm] = useState({
    type: 'user_daily',
    threshold: '',
    enabled: true,
    name: '',
    description: '',
  });

  useEffect(() => {
    fetchData();
    fetchPricings(); // Fetch pricing data for tooltip calculations
  }, [period, refreshKey]);

  useEffect(() => {
    if (showPricing) {
      fetchPricings();
    }
  }, [showPricing]);

  useEffect(() => {
    if (showAlerts) {
      fetchAlerts();
    }
  }, [showAlerts]);

  // Stabiliser la top feature pour éviter les scintillements lors des refreshes
  useEffect(() => {
    if (data?.byFeature && data.byFeature.length > 0) {
      // Trier explicitement par coût TOTAL décroissant pour garantir le bon ordre
      const sortedByTotalCost = [...data.byFeature].sort((a, b) => (b.cost || 0) - (a.cost || 0));
      const newTopFeature = sortedByTotalCost[0];

      // Ne mettre à jour que si la feature change réellement (pas juste un re-order temporaire)
      if (newTopFeature.feature !== stableTopFeature.feature ||
          Math.abs(newTopFeature.cost - stableTopFeature.cost) > 0.01) {
        setStableTopFeature(newTopFeature);
      }
    }
  }, [data?.byFeature, stableTopFeature.feature, stableTopFeature.cost]);

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
    if (!showAlerts || !scrollContainer) return;

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
  }, [showAlerts]);

  const fetchData = async () => {
    try {
      // Only show loader if no data yet (initial load)
      if (!data) {
        setLoading(true);
      }
      const response = await fetch(`/api/analytics/openai-usage?period=${period}`);
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

  const handleSaveAlert = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        id: editingAlert?.id || undefined,
        type: alertForm.type,
        threshold: parseFloat(alertForm.threshold),
        enabled: alertForm.enabled,
        name: alertForm.name,
        description: alertForm.description || null,
      };

      const response = await fetch('/api/admin/openai-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to save alert');

      await fetchAlerts();
      setEditingAlert(null);
      setAlertForm({
        type: 'user_daily',
        threshold: '',
        enabled: true,
        name: '',
        description: '',
      });
      setToast({ type: 'success', message: 'Alerte sauvegardée avec succès' });
    } catch (err) {
      console.error('Error saving alert:', err);
      setToast({ type: 'error', message: 'Erreur lors de la sauvegarde de l\'alerte' });
    }
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
    setEditingAlert(alert);
    setAlertForm({
      type: alert.type,
      threshold: alert.threshold.toString(),
      enabled: alert.enabled,
      name: alert.name,
      description: alert.description || '',
    });
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

  // Calculate average cost per call
  const avgCostPerCall = data.total.calls > 0 ? data.total.cost / data.total.calls : 0;

  // Utiliser la top feature stabilisée pour éviter les scintillements
  const topFeature = stableTopFeature;

  const topFeatureLabel = topFeature.feature !== 'N/A'
    ? (getFeatureConfig(topFeature.feature).name || topFeature.feature)
    : 'N/A';

  const alertTypeLabels = {
    user_daily: 'Utilisateur - Journalier',
    user_monthly: 'Utilisateur - Mensuel',
    global_daily: 'Global - Journalier',
    global_monthly: 'Global - Mensuel',
    feature_daily: 'Feature - Journalier',
  };

  return (
    <div className="space-y-6 pb-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon="💰"
          label="Coût total"
          value={formatCurrency(data.total.cost)}
          trend={null}
          description="Coût total des appels OpenAI pour la période sélectionnée, incluant tous les modèles et features"
        />
        <KPICard
          icon="🎯"
          label="Total tokens"
          value={formatNumber(data.total.totalTokens)}
          subtitle={`${formatNumber(data.total.calls)} appels`}
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
            data={data.byFeature
              .sort((a, b) => (b.lastCost || 0) - (a.lastCost || 0))
              .map((feature) => {
                const featureConfig = getFeatureConfig(feature.feature);
                return {
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
                };
              })}
            layout="vertical"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              type="number"
              stroke="rgba(255,255,255,0.6)"
              tick={{ fill: 'rgba(255,255,255,0.6)' }}
              tickFormatter={(value) => formatCurrency(value)}
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

                  // Find pricing for this model
                  const pricing = pricings.find(p => p.modelName === data.lastModel);

                  // Calculate individual costs
                  let inputCost = 0;
                  let cachedCost = 0;
                  let outputCost = 0;

                  if (pricing) {
                    inputCost = (data.lastPromptTokens / 1_000_000) * pricing.inputPricePerMToken;
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
                            <span className="text-white text-xs">{formatNumber(data.lastPromptTokens)} ({formatCurrency(inputCost)})</span>
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
              {data.byFeature
                .sort((a, b) => (b.lastCost || 0) - (a.lastCost || 0))
                .map((feature, index) => {
                  const featureConfig = getFeatureConfig(feature.feature);
                  return <Cell key={`cell-${index}`} fill={featureConfig.colors?.solid || '#3B82F6'} />;
                })}
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
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm disabled:opacity-50"
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
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm"
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
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm"
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
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-white/60 text-sm">Description</label>
                  <input
                    type="text"
                    value={pricingForm.description}
                    onChange={(e) => setPricingForm({ ...pricingForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm"
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
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition"
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
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded text-sm transition"
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
                <th className="pb-3 text-right">Dernier coût</th>
                <th className="pb-3 text-right">Coût/appel</th>
                <th className="pb-3 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {[...data.byFeature]
                .sort((a, b) => (b.cost || 0) - (a.cost || 0))
                .map((feature, index) => {
                const percentage = data.total.cost > 0
                  ? ((feature.cost / data.total.cost) * 100).toFixed(1)
                  : 0;
                const avgCost = feature.calls > 0 ? feature.cost / feature.calls : 0;
                const featureConfig = getFeatureConfig(feature.feature);
                const featureLabel = featureConfig.name || 'Feature non configurée';
                const hasLevelBreakdown = feature.levelBreakdown && feature.levelBreakdown.length > 0;

                return (
                  <>
                    {/* Main feature row */}
                    <tr key={index} className="border-b border-white/5 text-white">
                      <td className="py-3">
                        <span className="font-medium">{featureLabel}</span>
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
                      <td className="py-3 text-right text-green-400">
                        {formatCurrency(feature.lastCost || 0)}
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
                          <td className="py-2 text-right text-sm text-white/40">
                            —
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
                  </>
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
                  data={data.byFeature.map((feature) => ({
                    name: getFeatureConfig(feature.feature).name || 'Feature non configurée',
                    value: feature.cost,
                    percentage: data.total.cost > 0
                      ? ((feature.cost / data.total.cost) * 100).toFixed(1)
                      : 0,
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
                  {data.byFeature.map((feature, index) => {
                    const featureConfig = getFeatureConfig(feature.feature);
                    const color = featureConfig.colors?.solid || '#6B7280';
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0];
                      return (
                        <div className="bg-black/95 backdrop-blur-xl border border-white/20 rounded-lg p-3 shadow-2xl">
                          <p className="text-white font-semibold mb-2">{data.name}</p>
                          <div className="space-y-1">
                            <p className="text-sm text-blue-300">
                              Coût: <span className="font-bold text-white">{formatCurrency(data.value)}</span>
                            </p>
                            <p className="text-sm text-green-300">
                              Part: <span className="font-bold text-white">{data.payload.percentage}%</span>
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
                  {data.topUsers.map((user, index) => (
                    <tr key={index} className="border-b border-white/5 text-white">
                      <td className="py-3">
                        <div>
                          <span className="font-medium">{user.email}</span>
                          {user.name && (
                            <span className="block text-sm text-white/60">{user.name}</span>
                          )}
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
                  ))}
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
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className="px-3 py-1 text-sm bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-md transition"
          >
            {showAlerts ? 'Masquer' : 'Configurer'}
          </button>
        </div>

        {showAlerts && (
          <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/20 space-y-4">
            <h4 className="text-white font-semibold">Configuration des alertes</h4>

            {/* Alert Form */}
            <form onSubmit={handleSaveAlert} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 text-sm mb-1 block">Type d'alerte</label>
                  <CustomSelect
                    value={alertForm.type}
                    onChange={(value) => setAlertForm({ ...alertForm, type: value })}
                    options={Object.entries(alertTypeLabels).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                  />
                </div>
                <div>
                  <label className="text-white/60 text-sm">Seuil ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={alertForm.threshold}
                    onChange={(e) => setAlertForm({ ...alertForm, threshold: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-white/60 text-sm">Nom de l'alerte</label>
                  <input
                    type="text"
                    value={alertForm.name}
                    onChange={(e) => setAlertForm({ ...alertForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-white/60 text-sm">Description</label>
                  <input
                    type="text"
                    value={alertForm.description}
                    onChange={(e) => setAlertForm({ ...alertForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={alertForm.enabled}
                  onChange={(e) => setAlertForm({ ...alertForm, enabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-white/60 text-sm">Activée</label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm transition"
                >
                  {editingAlert ? 'Mettre à jour' : 'Ajouter'}
                </button>
                {editingAlert && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAlert(null);
                      setAlertForm({
                        type: 'user_daily',
                        threshold: '',
                        enabled: true,
                        name: '',
                        description: '',
                      });
                    }}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded text-sm transition"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </form>

            {/* Alert List */}
            <div ref={alertsScrollRef} className="space-y-2 max-h-64 overflow-y-auto [overscroll-behavior:contain]">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3 bg-white/5 rounded">
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
            </div>
          </div>
        )}
      </div>

      {/* Toast and Confirm Dialog */}
      <Toast toast={toast} onClose={() => setToast(null)} />
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
