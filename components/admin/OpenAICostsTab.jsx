'use client';

import { useState, useEffect } from 'react';
import { KPICard } from './KPICard';

export function OpenAICostsTab({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPricing, setShowPricing] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

  // Pricing management state
  const [pricings, setPricings] = useState([]);
  const [editingPricing, setEditingPricing] = useState(null);
  const [pricingForm, setPricingForm] = useState({
    modelName: '',
    inputPricePerMToken: '',
    outputPricePerMToken: '',
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
  }, [period]);

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

  const fetchData = async () => {
    try {
      setLoading(true);
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
        description: '',
        isActive: true,
      });
    } catch (err) {
      console.error('Error saving pricing:', err);
      alert('Erreur lors de la sauvegarde du tarif');
    }
  };

  const handleDeletePricing = async (modelName) => {
    if (!confirm(`Supprimer le tarif pour ${modelName} ?`)) return;

    try {
      const response = await fetch(`/api/admin/openai-pricing?modelName=${encodeURIComponent(modelName)}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete pricing');
      await fetchPricings();
    } catch (err) {
      console.error('Error deleting pricing:', err);
      alert('Erreur lors de la suppression du tarif');
    }
  };

  const handleEditPricing = (pricing) => {
    setEditingPricing(pricing.modelName);
    setPricingForm({
      modelName: pricing.modelName,
      inputPricePerMToken: pricing.inputPricePerMToken.toString(),
      outputPricePerMToken: pricing.outputPricePerMToken.toString(),
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
    } catch (err) {
      console.error('Error saving alert:', err);
      alert('Erreur lors de la sauvegarde de l\'alerte');
    }
  };

  const handleDeleteAlert = async (id) => {
    if (!confirm('Supprimer cette alerte ?')) return;

    try {
      const response = await fetch(`/api/admin/openai-alerts?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete alert');
      await fetchAlerts();
    } catch (err) {
      console.error('Error deleting alert:', err);
      alert('Erreur lors de la suppression de l\'alerte');
    }
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

  if (loading) {
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

  // Calculate average cost per call
  const avgCostPerCall = data.total.calls > 0 ? data.total.cost / data.total.calls : 0;

  // Find most expensive feature
  const topFeature = data.byFeature[0] || { feature: 'N/A', cost: 0 };

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
        />
        <KPICard
          icon="🎯"
          label="Total tokens"
          value={formatNumber(data.total.totalTokens)}
          subtitle={`${formatNumber(data.total.calls)} appels`}
        />
        <KPICard
          icon="📊"
          label="Coût moyen/appel"
          value={formatCurrency(avgCostPerCall)}
          trend={null}
        />
        <KPICard
          icon="⭐"
          label="Feature #1"
          value={topFeature.feature}
          subtitle={formatCurrency(topFeature.cost)}
        />
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
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pricings.map((pricing) => (
                <div key={pricing.modelName} className="flex items-center justify-between p-3 bg-white/5 rounded">
                  <div className="flex-1">
                    <div className="text-white font-medium">{pricing.modelName}</div>
                    <div className="text-white/60 text-sm">
                      Input: ${pricing.inputPricePerMToken}/MTok • Output: ${pricing.outputPricePerMToken}/MTok
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
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-white/60 text-sm border-b border-white/10">
                <th className="pb-3">Feature</th>
                <th className="pb-3 text-right">Appels</th>
                <th className="pb-3 text-right">Tokens</th>
                <th className="pb-3 text-right">Coût</th>
                <th className="pb-3 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {data.byFeature.map((feature, index) => {
                const percentage = data.total.cost > 0
                  ? ((feature.cost / data.total.cost) * 100).toFixed(1)
                  : 0;

                return (
                  <tr key={index} className="border-b border-white/5 text-white">
                    <td className="py-3">
                      <span className="font-medium">{feature.feature}</span>
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
                    <td className="py-3 text-right text-white/60">
                      {percentage}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

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
                  <label className="text-white/60 text-sm">Type d'alerte</label>
                  <select
                    value={alertForm.type}
                    onChange={(e) => setAlertForm({ ...alertForm, type: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm"
                    required
                  >
                    {Object.entries(alertTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
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
            <div className="space-y-2 max-h-64 overflow-y-auto">
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
    </div>
  );
}
