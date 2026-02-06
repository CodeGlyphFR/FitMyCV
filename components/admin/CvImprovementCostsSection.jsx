'use client';

import { useState, useEffect } from 'react';

/**
 * Section affichant les coûts d'amélioration de CV groupés par session
 * avec détails au survol (input/cached/output tokens par feature)
 */
export function CvImprovementCostsSection({ period, refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSessionId, setExpandedSessionId] = useState(null);

  useEffect(() => {
    fetchData();
  }, [period, refreshKey]);

  const fetchData = async () => {
    try {
      if (!data) {
        setLoading(true);
      }
      const url = new URL('/api/analytics/cv-improvement-costs', window.location.origin);
      url.searchParams.set('period', period);
      url.searchParams.set('limit', '20');

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      console.error('Error fetching CV improvement costs:', err);
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

  const getFeatureLabel = (feature) => {
    const labels = {
      'optimize_cv': 'Legacy (v1)',
      'cv_improvement_classify': 'Classification',
      'cv_improvement_classify': 'Classification',
      'cv_improvement_preprocess': 'Préparation',
      'cv_improvement_experience': 'Expériences',
      'cv_improvement_project': 'Projets',
      'cv_improvement_extras': 'Extras',
      'cv_improvement_languages': 'Langues',
      'cv_improvement_summary': 'Résumé',
    };
    return labels[feature] || feature;
  };

  const getPipelineVersionBadge = (version) => {
    if (version === 2) {
      return (
        <span className="px-2 py-0.5 text-xs rounded bg-purple-500/20 text-purple-400">
          Pipeline v2
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs rounded bg-gray-500/20 text-gray-400">
        Legacy v1
      </span>
    );
  };

  if (loading && !data) {
    return (
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Coûts d'amélioration CV</h3>
        <div className="text-white/60 text-center py-4">Chargement...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Coûts d'amélioration CV</h3>
        <div className="text-red-400 text-center py-4">Erreur: {error}</div>
      </div>
    );
  }

  // Filtrer les sessions qui ont des données valides
  const validSessions = data?.sessions?.filter(session =>
    session.calls && session.calls.length > 0 && session.totals.totalTokens > 0
  ) || [];

  if (!data || validSessions.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Coûts d'amélioration CV</h3>
        <div className="text-white/60 text-center py-4">Aucune amélioration de CV sur cette période</div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        Coûts d'amélioration CV
        <span className="ml-2 text-sm font-normal text-white/60">
          ({validSessions.length} session{validSessions.length > 1 ? 's' : ''})
        </span>
      </h3>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-white/60 text-xs mb-1">Coût total</div>
          <div className="text-white font-semibold">{formatCurrency(data.totals.totalCost)}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-white/60 text-xs mb-1">Coût moyen/session</div>
          <div className="text-white font-semibold">{formatCurrency(data.totals.avgCostPerSession)}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-white/60 text-xs mb-1">Durée totale</div>
          <div className="text-white font-semibold">{formatDuration(data.totals.totalDurationMs)}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-white/60 text-xs mb-1">Pipeline v2</div>
          <div className="text-purple-400 font-semibold">{data.totals.v2Sessions} sessions</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-white/60 text-xs mb-1">Legacy v1</div>
          <div className="text-gray-400 font-semibold">{data.totals.v1Sessions} sessions</div>
        </div>
      </div>

      {/* Sessions List - Limited to ~3 visible with scroll */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
        {validSessions.map((session) => (
          <div
            key={session.sessionId}
            className="border border-white/10 rounded-lg overflow-hidden"
          >
            {/* Main row - clickable to expand */}
            <div
              className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 cursor-pointer transition"
              onClick={() => setExpandedSessionId(expandedSessionId === session.sessionId ? null : session.sessionId)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-white/40 text-lg">
                  {expandedSessionId === session.sessionId ? '▼' : '▶'}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium truncate">
                      {session.user?.email || 'Utilisateur inconnu'}
                    </span>
                    {getPipelineVersionBadge(session.pipelineVersion)}
                  </div>
                  <div className="text-white/60 text-xs">
                    {formatDate(session.startedAt)} • {session.totals.callCount} appel(s)
                  </div>
                </div>
              </div>

              {/* Quick stats */}
              <div className="flex items-center gap-4 text-sm">
                <div className="text-right">
                  <div className="text-white font-semibold">{formatCurrency(session.totals.estimatedCost)}</div>
                  <div className="text-white/60 text-xs">{formatNumber(session.totals.totalTokens)} tokens</div>
                </div>
                <div className="text-right">
                  <div className="text-white/80">{formatDuration(session.totals.durationMs)}</div>
                  <div className="text-white/60 text-xs">{session.featureSummary.length} features</div>
                </div>
              </div>
            </div>

            {/* Expanded details - Individual calls */}
            {expandedSessionId === session.sessionId && (() => {
              const validCalls = session.calls.filter(c => c.promptTokens > 0 || c.completionTokens > 0);
              return (
              <div className="border-t border-white/10 p-4 bg-black/20">
                <h4 className="text-white/80 text-sm font-medium mb-2">
                  {validCalls.length} appel{validCalls.length > 1 ? 's' : ''} OpenAI
                </h4>
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-black/80">
                      <tr className="text-left text-white/60 border-b border-white/10">
                        <th className="pb-1">Feature</th>
                        <th className="pb-1">Modèle</th>
                        <th className="pb-1 text-right">Input</th>
                        <th className="pb-1 text-right">Cache</th>
                        <th className="pb-1 text-right">Output</th>
                        <th className="pb-1 text-right">Coût</th>
                        <th className="pb-1 text-right">Durée</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validCalls.map((call) => {
                        const inputTokens = call.promptTokens - call.cachedTokens;
                        return (
                          <tr key={call.id} className="border-b border-white/5 text-white/70">
                            <td className="py-1">{getFeatureLabel(call.featureName)}</td>
                            <td className="py-1 text-white/50 text-[10px]">{call.model || '-'}</td>
                            <td className="py-1 text-right text-cyan-400/70">{formatNumber(inputTokens)}</td>
                            <td className="py-1 text-right text-indigo-400/70">{formatNumber(call.cachedTokens)}</td>
                            <td className="py-1 text-right text-purple-400/70">{formatNumber(call.completionTokens)}</td>
                            <td className="py-1 text-right text-green-400/70">{formatCurrency(call.estimatedCost)}</td>
                            <td className="py-1 text-right text-white/50">{formatDuration(call.duration)}</td>
                          </tr>
                        );
                      })}
                      {/* Total row */}
                      <tr className="text-white font-medium border-t border-white/20">
                        <td className="py-1">Total</td>
                        <td className="py-1"></td>
                        <td className="py-1 text-right text-cyan-400">
                          {formatNumber(session.totals.promptTokens - session.totals.cachedTokens)}
                        </td>
                        <td className="py-1 text-right text-indigo-400">
                          {formatNumber(session.totals.cachedTokens)}
                        </td>
                        <td className="py-1 text-right text-purple-400">
                          {formatNumber(session.totals.completionTokens)}
                        </td>
                        <td className="py-1 text-right text-green-400 font-semibold">
                          {formatCurrency(session.totals.estimatedCost)}
                        </td>
                        <td className="py-1 text-right">
                          {formatDuration(session.totals.durationMs)}
                        </td>
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
