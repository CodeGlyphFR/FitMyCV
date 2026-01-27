'use client';

import { useState, useEffect } from 'react';

/**
 * Section affichant les coûts de génération de CV groupés par tâche
 * avec détails au survol (input/cached/output tokens par subtask)
 */
export function CvGenerationCostsSection({ period, refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  useEffect(() => {
    fetchData();
  }, [period, refreshKey]);

  const fetchData = async () => {
    try {
      if (!data) {
        setLoading(true);
      }
      const url = new URL('/api/analytics/cv-generation-costs', window.location.origin);
      url.searchParams.set('period', period);
      url.searchParams.set('limit', '20');

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      console.error('Error fetching CV generation costs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(value);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('fr-FR').format(value);
  };

  const formatDuration = (ms) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
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

  const getSubtaskTypeLabel = (type) => {
    const labels = {
      'extraction': 'Extraction offre',
      'classify': 'Classification',
      'batch_experience': 'Expériences',
      'batch_project': 'Projets',
      'batch_extras': 'Extras',
      'batch_skills': 'Compétences',
      'batch_summary': 'Résumé',
      'recompose': 'Recomposition',
      'recompose_languages': 'Langues',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: { label: 'Terminé', className: 'bg-green-500/20 text-green-400' },
      running: { label: 'En cours', className: 'bg-blue-500/20 text-blue-400' },
      pending: { label: 'En attente', className: 'bg-yellow-500/20 text-yellow-400' },
      failed: { label: 'Échoué', className: 'bg-red-500/20 text-red-400' },
    };
    const config = statusConfig[status] || { label: status, className: 'bg-gray-500/20 text-gray-400' };
    return (
      <span className={`px-2 py-0.5 text-xs rounded ${config.className}`}>
        {config.label}
      </span>
    );
  };

  if (loading && !data) {
    return (
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Coûts de génération CV</h3>
        <div className="text-white/60 text-center py-4">Chargement...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Coûts de génération CV</h3>
        <div className="text-red-400 text-center py-4">Erreur: {error}</div>
      </div>
    );
  }

  // Filtrer les generations qui ont des donnees valides (au moins 1 subtask avec des tokens)
  const validGenerations = data?.generations?.filter(gen =>
    gen.subtasks && gen.subtasks.length > 0 && gen.totals.totalTokens > 0
  ) || [];

  if (!data || validGenerations.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Coûts de génération CV</h3>
        <div className="text-white/60 text-center py-4">Aucune génération de CV sur cette période</div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        Coûts de génération CV
        <span className="ml-2 text-sm font-normal text-white/60">
          ({validGenerations.length} génération{validGenerations.length > 1 ? 's' : ''})
        </span>
      </h3>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-white/60 text-xs mb-1">Coût total</div>
          <div className="text-white font-semibold">{formatCurrency(data.totals.totalCost)}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-white/60 text-xs mb-1">Coût moyen/gén.</div>
          <div className="text-white font-semibold">{formatCurrency(data.totals.avgCostPerGeneration)}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-white/60 text-xs mb-1">Durée totale</div>
          <div className="text-white font-semibold">{formatDuration(data.totals.totalDurationMs)}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-white/60 text-xs mb-1">Durée moyenne</div>
          <div className="text-white font-semibold">{formatDuration(data.totals.avgDurationPerGeneration)}</div>
        </div>
      </div>

      {/* Generations List - Limited to ~3 visible with scroll */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
        {validGenerations.map((gen) => (
          <div
            key={gen.taskId}
            className="border border-white/10 rounded-lg overflow-hidden"
          >
            {/* Main row - clickable to expand */}
            <div
              className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 cursor-pointer transition"
              onClick={() => setExpandedTaskId(expandedTaskId === gen.taskId ? null : gen.taskId)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-white/40 text-lg">
                  {expandedTaskId === gen.taskId ? '▼' : '▶'}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium truncate">
                      {gen.user?.email || 'Utilisateur inconnu'}
                    </span>
                    {getStatusBadge(gen.status)}
                  </div>
                  <div className="text-white/60 text-xs">
                    {formatDate(gen.createdAt)} • {gen.totalOffers} offre(s)
                  </div>
                </div>
              </div>

              {/* Quick stats */}
              <div className="flex items-center gap-4 text-sm">
                <div className="text-right">
                  <div className="text-white font-semibold">{formatCurrency(gen.totals.estimatedCost)}</div>
                  <div className="text-white/60 text-xs">{formatNumber(gen.totals.totalTokens)} tokens</div>
                </div>
                <div className="text-right">
                  <div className="text-white/80">{formatDuration(gen.totals.durationMs)}</div>
                  <div className="text-white/60 text-xs">{gen.totals.subtaskCount} subtasks</div>
                </div>
              </div>
            </div>

            {/* Expanded details - Individual subtasks */}
            {expandedTaskId === gen.taskId && (() => {
              const validSubtasks = gen.subtasks.filter(s => s.promptTokens > 0 || s.completionTokens > 0);
              return (
              <div className="border-t border-white/10 p-4 bg-black/20">
                <h4 className="text-white/80 text-sm font-medium mb-2">
                  {validSubtasks.length} subtask{validSubtasks.length > 1 ? 's' : ''}
                </h4>
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-black/80">
                      <tr className="text-left text-white/60 border-b border-white/10">
                        <th className="pb-1">Type</th>
                        <th className="pb-1">Index</th>
                        <th className="pb-1">Modèle</th>
                        <th className="pb-1 text-right">Input</th>
                        <th className="pb-1 text-right">Cache</th>
                        <th className="pb-1 text-right">Output</th>
                        <th className="pb-1 text-right">Coût</th>
                        <th className="pb-1 text-right">Durée</th>
                        <th className="pb-1">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validSubtasks.map((subtask) => {
                        const inputTokens = subtask.promptTokens - subtask.cachedTokens;
                        return (
                          <tr key={subtask.id} className="border-b border-white/5 text-white/70">
                            <td className="py-1">{getSubtaskTypeLabel(subtask.type)}</td>
                            <td className="py-1 text-white/40">{subtask.itemIndex ?? '-'}</td>
                            <td className="py-1 text-white/50 text-[10px]">{subtask.modelUsed || '-'}</td>
                            <td className="py-1 text-right text-cyan-400/70">{formatNumber(inputTokens)}</td>
                            <td className="py-1 text-right text-indigo-400/70">{formatNumber(subtask.cachedTokens)}</td>
                            <td className="py-1 text-right text-purple-400/70">{formatNumber(subtask.completionTokens)}</td>
                            <td className="py-1 text-right text-green-400/70">{formatCurrency(subtask.estimatedCost)}</td>
                            <td className="py-1 text-right text-white/50">{formatDuration(subtask.durationMs)}</td>
                            <td className="py-1">{getStatusBadge(subtask.status)}</td>
                          </tr>
                        );
                      })}
                      {/* Total row */}
                      <tr className="text-white font-medium border-t border-white/20">
                        <td className="py-1">Total</td>
                        <td className="py-1"></td>
                        <td className="py-1"></td>
                        <td className="py-1 text-right text-cyan-400">
                          {formatNumber(gen.totals.promptTokens - gen.totals.cachedTokens)}
                        </td>
                        <td className="py-1 text-right text-indigo-400">
                          {formatNumber(gen.totals.cachedTokens)}
                        </td>
                        <td className="py-1 text-right text-purple-400">
                          {formatNumber(gen.totals.completionTokens)}
                        </td>
                        <td className="py-1 text-right text-green-400 font-semibold">
                          {formatCurrency(gen.totals.estimatedCost)}
                        </td>
                        <td className="py-1 text-right">
                          {formatDuration(gen.totals.durationMs)}
                        </td>
                        <td className="py-1"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}
