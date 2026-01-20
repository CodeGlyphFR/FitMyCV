'use client';

import React, { useState, useEffect } from 'react';
import { KPICard } from './KPICard';
import { Toast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import EditAlertModal from './EditAlertModal';
import { CvGenerationCostsSection } from './CvGenerationCostsSection';
import { CvImprovementCostsSection } from './CvImprovementCostsSection';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';
import {
  useScrollChaining,
  useOpenAICostsData,
  usePricingManagement,
  useAlertManagement,
} from './hooks';

// Constants
const ALERT_TYPE_LABELS = {
  user_daily: 'Utilisateur - Journalier',
  user_monthly: 'Utilisateur - Mensuel',
  global_daily: 'Global - Journalier',
  global_monthly: 'Global - Mensuel',
  feature_daily: 'Feature - Journalier',
};

// Utility functions
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

export function OpenAICostsTab({ period, userId, refreshKey, isInitialLoad, triggeredAlerts }) {
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Data hook
  const {
    data,
    loading,
    error,
    pricings,
    setPricings,
    isPriorityMode,
    setIsPriorityMode,
    fetchPricings,
    balance,
    balanceLoading,
    alerts,
    setAlerts,
    fetchAlerts,
    groupedChartData,
    groupedFeatureData,
    correctedTotalCost,
    correctedTotalCalls,
    stableTopFeature,
  } = useOpenAICostsData({ period, userId, refreshKey });

  // Pricing management hook
  const {
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
    resetForm: resetPricingForm,
  } = usePricingManagement({
    pricings,
    setPricings,
    isPriorityMode,
    setIsPriorityMode,
    fetchPricings,
    onToast: setToast,
    onConfirm: setConfirmDialog,
  });

  // Alert management hook
  const {
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
  } = useAlertManagement({
    alerts,
    setAlerts,
    fetchAlerts,
    onToast: setToast,
    onConfirm: setConfirmDialog,
  });

  // Scroll chaining prevention
  const pricingScrollRef = useScrollChaining(showPricing);
  const alertsScrollRef = useScrollChaining(showAlertForm);

  // Refresh pricings when panel is shown
  useEffect(() => {
    if (showPricing) {
      fetchPricings();
    }
  }, [showPricing, fetchPricings]);

  // Loading state
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white/60">Chargement des données...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-400">Erreur : {error}</div>
      </div>
    );
  }

  if (!data) return null;

  // Computed values
  const avgCostPerCall = correctedTotalCalls > 0 ? correctedTotalCost / correctedTotalCalls : 0;
  const topFeatureLabel = stableTopFeature.name || stableTopFeature.feature || 'N/A';

  // Balance subtitle with color
  const getBalanceSubtitle = () => {
    if (balanceLoading) {
      return { text: 'Chargement du solde...', color: 'text-white/60' };
    }
    if (balance === null || balance === undefined) {
      return null;
    }
    const balanceText = `Solde: ${formatCurrency(balance)}`;
    if (balance < 5) {
      return { text: balanceText, color: 'text-red-400' };
    } else if (balance < 10) {
      return { text: balanceText, color: 'text-orange-400' };
    } else {
      return { text: balanceText, color: 'text-green-400' };
    }
  };

  const balanceSubtitle = getBalanceSubtitle();

  // Custom tooltip for bar chart
  const renderBarChartTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;

    const chartData = payload[0].payload;

    if (chartData.isGrouped) {
      return (
        <div className="bg-black/95 backdrop-blur-xl border border-white/20 rounded-lg p-3 shadow-2xl">
          <p className="text-white font-semibold mb-2">{chartData.name}</p>
          <div className="space-y-1">
            <div className="border-b border-white/10 pb-1 mb-1">
              <p className="text-xs text-white/60 mb-1">Détail des tokens:</p>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-cyan-300">Input:</span>
                <span className="text-white text-xs">{formatNumber(chartData.lastPromptTokens - chartData.lastCachedTokens)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-indigo-300">Cache:</span>
                <span className="text-white text-xs">{formatNumber(chartData.lastCachedTokens)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-purple-300">Output:</span>
                <span className="text-white text-xs">{formatNumber(chartData.lastCompletionTokens)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-white/80 font-medium">Total:</span>
              <span className="text-white text-sm font-medium">{formatNumber(chartData.lastTokens)} tokens</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-green-300 font-medium">Coût:</span>
              <span className="text-white font-bold">{formatCurrency(chartData.lastCost)}</span>
            </div>
            <div className="border-t border-white/10 pt-1 mt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-orange-300">Durée:</span>
                <span className="text-white text-xs">{formatDuration(chartData.lastDuration)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-yellow-300">Date:</span>
                <span className="text-white text-xs">{formatDate(chartData.lastCallDate)}</span>
              </div>
              {chartData.subtaskCount && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/60">Phases:</span>
                  <span className="text-white text-xs">{chartData.subtaskCount} subtasks</span>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Non-grouped feature tooltip
    const pricing = pricings.find(p => p.modelName === chartData.lastModel);
    let inputCost = 0, cachedCost = 0, outputCost = 0;

    if (pricing) {
      const nonCachedTokens = chartData.lastPromptTokens - chartData.lastCachedTokens;
      inputCost = (nonCachedTokens / 1_000_000) * pricing.inputPricePerMToken;
      cachedCost = (chartData.lastCachedTokens / 1_000_000) * pricing.cachePricePerMToken;
      outputCost = (chartData.lastCompletionTokens / 1_000_000) * pricing.outputPricePerMToken;
    }

    return (
      <div className="bg-black/95 backdrop-blur-xl border border-white/20 rounded-lg p-3 shadow-2xl">
        <p className="text-white font-semibold mb-2">{chartData.name}</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-blue-300">Modèle:</span>
            <span className="text-white text-sm">{chartData.lastModel}</span>
          </div>
          <div className="border-t border-white/10 pt-1 mt-1">
            <p className="text-xs text-white/60 mb-1">Détail des tokens:</p>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-cyan-300">Input:</span>
              <span className="text-white text-xs">{formatNumber(chartData.lastPromptTokens - chartData.lastCachedTokens)} ({formatCurrency(inputCost)})</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-indigo-300">Cache:</span>
              <span className="text-white text-xs">{formatNumber(chartData.lastCachedTokens)} ({formatCurrency(cachedCost)})</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-purple-300">Output:</span>
              <span className="text-white text-xs">{formatNumber(chartData.lastCompletionTokens)} ({formatCurrency(outputCost)})</span>
            </div>
          </div>
          <div className="border-t border-white/10 pt-1 mt-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-white/80 font-medium">Total:</span>
              <span className="text-white text-sm font-medium">{formatNumber(chartData.lastTokens)} tokens</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-green-300 font-medium">Coût:</span>
              <span className="text-white font-bold">{formatCurrency(chartData.lastCost)}</span>
            </div>
          </div>
          <div className="border-t border-white/10 pt-1 mt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-orange-300">Durée:</span>
              <span className="text-white text-xs">{formatDuration(chartData.lastDuration)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-yellow-300">Date:</span>
              <span className="text-white text-xs">{formatDate(chartData.lastCallDate)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
          subtitle={formatCurrency(stableTopFeature.cost)}
          description="La feature qui a généré le plus de coûts OpenAI sur la période"
        />
      </div>

      {/* Last Cost Comparison Chart */}
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Comparaison des derniers coûts par feature</h3>
        <ResponsiveContainer width="100%" height={Math.max(300, groupedChartData.length * 40)}>
          <BarChart data={groupedChartData} layout="vertical">
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
              interval={0}
            />
            <Tooltip content={renderBarChartTooltip} />
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

      {/* CV Improvement Costs Section */}
      <CvImprovementCostsSection period={period} refreshKey={refreshKey} />

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
            <div className="flex items-center justify-between">
              <h4 className="text-white font-semibold">Gestion des tarifs OpenAI</h4>
              <div className="flex items-center gap-3">
                <span className={`text-sm ${!isPriorityMode ? 'text-green-400 font-medium' : 'text-white/60'}`}>
                  Standard
                </span>
                <button
                  onClick={() => togglePriorityMode(!isPriorityMode)}
                  disabled={priorityModeLoading}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isPriorityMode ? 'bg-orange-500' : 'bg-green-500'
                  } ${priorityModeLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isPriorityMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className={`text-sm ${isPriorityMode ? 'text-orange-400 font-medium' : 'text-white/60'}`}>
                  Priority
                </span>
                {isPriorityMode && (
                  <span className="text-xs text-orange-400/70">(+70% coût)</span>
                )}
              </div>
            </div>

            {/* Pricing Form */}
            <form onSubmit={handleSavePricing} className="space-y-3">
              <div className="p-3 bg-green-500/10 rounded border border-green-500/20">
                <div className="text-green-400 text-sm font-medium mb-2">Tarifs Standard</div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
                    <label className="text-white/60 text-sm">Input ($/MTok)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={pricingForm.inputPricePerMToken}
                      onChange={(e) => setPricingForm({ ...pricingForm, inputPricePerMToken: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-sm text-white text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-white/60 text-sm">Cache ($/MTok)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={pricingForm.cachePricePerMToken}
                      onChange={(e) => setPricingForm({ ...pricingForm, cachePricePerMToken: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-sm text-white text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-white/60 text-sm">Output ($/MTok)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={pricingForm.outputPricePerMToken}
                      onChange={(e) => setPricingForm({ ...pricingForm, outputPricePerMToken: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-sm text-white text-sm"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-orange-500/10 rounded border border-orange-500/20">
                <div className="text-orange-400 text-sm font-medium mb-2">Tarifs Priority <span className="text-orange-400/60">(optionnel)</span></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-white/60 text-sm">Input ($/MTok)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={pricingForm.inputPricePerMTokenPriority}
                      onChange={(e) => setPricingForm({ ...pricingForm, inputPricePerMTokenPriority: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-sm text-white text-sm"
                      placeholder="Non défini"
                    />
                  </div>
                  <div>
                    <label className="text-white/60 text-sm">Cache ($/MTok)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={pricingForm.cachePricePerMTokenPriority}
                      onChange={(e) => setPricingForm({ ...pricingForm, cachePricePerMTokenPriority: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-sm text-white text-sm"
                      placeholder="Non défini"
                    />
                  </div>
                  <div>
                    <label className="text-white/60 text-sm">Output ($/MTok)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={pricingForm.outputPricePerMTokenPriority}
                      onChange={(e) => setPricingForm({ ...pricingForm, outputPricePerMTokenPriority: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-sm text-white text-sm"
                      placeholder="Non défini"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <label className="text-white/60 text-sm">Description</label>
                  <input
                    type="text"
                    value={pricingForm.description}
                    onChange={(e) => setPricingForm({ ...pricingForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-sm text-white text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    checked={pricingForm.isActive}
                    onChange={(e) => setPricingForm({ ...pricingForm, isActive: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label className="text-white/60 text-sm">Actif</label>
                </div>
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
                    onClick={resetPricingForm}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-sm text-sm transition"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </form>

            {/* Pricing List */}
            <div ref={pricingScrollRef} className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar [overscroll-behavior:contain]">
              {pricings.length === 0 ? (
                <div className="text-center py-4 text-white/60 text-sm">
                  Aucun tarif configuré
                </div>
              ) : (
                pricings.map((pricing) => {
                  const hasPriority = pricing.inputPricePerMTokenPriority != null;
                  return (
                    <div key={pricing.modelName} className="p-3 bg-white/5 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-white font-medium">{pricing.modelName}</div>
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
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className={`p-2 rounded ${!isPriorityMode ? 'bg-green-500/10 border border-green-500/30' : 'bg-white/5'}`}>
                          <div className="text-green-400 text-xs mb-1">Standard {!isPriorityMode && '(actif)'}</div>
                          <div className="text-white/80">
                            In: ${pricing.inputPricePerMToken} • Cache: ${pricing.cachePricePerMToken} • Out: ${pricing.outputPricePerMToken}
                          </div>
                        </div>
                        <div className={`p-2 rounded ${isPriorityMode ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-white/5'}`}>
                          <div className="text-orange-400 text-xs mb-1">Priority {isPriorityMode && '(actif)'}</div>
                          {hasPriority ? (
                            <div className="text-white/80">
                              In: ${pricing.inputPricePerMTokenPriority} • Cache: ${pricing.cachePricePerMTokenPriority || 0} • Out: ${pricing.outputPricePerMTokenPriority}
                            </div>
                          ) : (
                            <div className="text-white/40 italic">Non défini</div>
                          )}
                        </div>
                      </div>
                      {pricing.description && (
                        <div className="text-white/50 text-xs mt-2">{pricing.description}</div>
                      )}
                    </div>
                  );
                })
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
                      <tr className={`border-b border-white/5 text-white ${feature.isGrouped ? 'bg-emerald-500/5' : ''}`}>
                        <td className="py-3">
                          <span className="font-medium">{feature.name}</span>
                          {feature.isGrouped && (
                            <span className="ml-2 text-xs text-emerald-400/60">(groupé)</span>
                          )}
                        </td>
                        <td className="py-3 text-right text-white/80">{formatNumber(feature.calls)}</td>
                        <td className="py-3 text-right text-white/80">{formatNumber(feature.tokens)}</td>
                        <td className="py-3 text-right font-medium">{formatCurrency(feature.cost)}</td>
                        <td className="py-3 text-right text-white/80">{formatCurrency(avgCost)}</td>
                        <td className="py-3 text-right text-white/60">{percentage}%</td>
                      </tr>
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
                            <td className="py-2 text-right text-sm">{formatNumber(levelData.calls)}</td>
                            <td className="py-2 text-right text-sm">{formatNumber(levelData.tokens)}</td>
                            <td className="py-2 text-right text-sm">{formatCurrency(levelData.cost)}</td>
                            <td className="py-2 text-right text-sm">{formatCurrency(levelAvgCost)}</td>
                            <td className="py-2 text-right text-sm">{levelPercentage}%</td>
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
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: 'white' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Users and Models */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                        <td className="py-3 text-right text-white/80">{formatNumber(user.totalCalls)}</td>
                        <td className="py-3 text-right text-white/80">{formatNumber(user.totalTokens)}</td>
                        <td className="py-3 text-right font-medium">{formatCurrency(user.totalCost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
              onClick={handleCreateAlert}
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

        {/* Alert List */}
        <div className="space-y-2 mb-4">
          {filteredAlerts.map((alert) => (
            <div key={alert.id} className="flex items-center justify-between p-3 bg-white/5 rounded-sm border border-white/10">
              <div className="flex-1">
                <div className="text-white font-medium">{alert.name}</div>
                <div className="text-white/60 text-sm">
                  {ALERT_TYPE_LABELS[alert.type]} • Seuil: ${alert.threshold}
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
          {filteredAlerts.length === 0 && (
            <div className="text-center text-white/40 py-4">
              Aucune alerte {alertsFilter === 'active' ? 'active' : alertsFilter === 'inactive' ? 'inactive' : ''}
            </div>
          )}
        </div>

        {/* Alert Guide */}
        {showAlertForm && (
          <div ref={alertsScrollRef} className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
            <h4 className="text-white font-semibold mb-2">Guide d'utilisation des alertes</h4>
            <div className="text-white/70 text-sm space-y-2">
              <p>• <strong>Utilisateur - Journalier</strong> : Alerte si un utilisateur dépasse le seuil par jour</p>
              <p>• <strong>Utilisateur - Mensuel</strong> : Alerte si un utilisateur dépasse le seuil par mois (hybride Stripe/calendrier)</p>
              <p>• <strong>Global - Journalier</strong> : Alerte si le total global dépasse le seuil par jour</p>
              <p>• <strong>Global - Mensuel</strong> : Alerte si le total global dépasse le seuil par mois</p>
              <p>• <strong>Feature - Journalier</strong> : Alerte si une feature dépasse le seuil par jour</p>
              <p className="mt-3 text-emerald-400">Cliquez sur "Éditer" pour modifier une alerte existante</p>
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
        alertTypeLabels={ALERT_TYPE_LABELS}
      />
    </div>
  );
}
