'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { KPICard } from './KPICard';
import { Toast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';

const ERROR_SEVERITY = {
  CRITICAL: { color: '#EF4444', label: 'Critique', icon: '🔴' },
  HIGH: { color: '#F59E0B', label: 'Élevée', icon: '🟠' },
  MEDIUM: { color: '#FBBF24', label: 'Moyenne', icon: '🟡' },
  LOW: { color: '#3B82F6', label: 'Faible', icon: '🔵' }
};

const PIE_COLORS = ['#EF4444', '#F59E0B', '#FBBF24', '#3B82F6', '#8B5CF6', '#EC4899'];

const METADATA_LABELS = {
  featureName: 'Fonctionnalité',
  taskId: 'Task ID',
  offerId: 'Offre ID',
  failedPhase: 'Phase échouée',
  failedStep: 'Étape échouée',
  retryCount: 'Tentatives',
  sourceType: 'Type source',
};

export function ErrorsTab({ period, userId, refreshKey, isInitialLoad }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRecentTable, setShowRecentTable] = useState(false);
  const [expandedErrorId, setExpandedErrorId] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  useEffect(() => {
    fetchErrors();
  }, [period, userId, refreshKey]);

  async function fetchErrors() {
    // Only show loader if no data yet (initial load)
    if (!data) {
      setLoading(true);
    }
    try {
      const url = `/api/analytics/errors?period=${period}${userId ? `&userId=${userId}` : ''}`;
      const res = await fetch(url);
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching errors:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteError = (errorId) => {
    setConfirmDialog({
      title: 'Supprimer cette erreur ?',
      message: 'Cette action est irréversible.',
      type: 'danger',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/analytics/errors?id=${encodeURIComponent(errorId)}`, {
            method: 'DELETE',
          });
          if (!response.ok) throw new Error('Failed to delete error');
          setToast({ type: 'success', message: 'Erreur supprimée avec succès' });
          if (expandedErrorId === errorId) setExpandedErrorId(null);
          await fetchErrors();
        } catch (err) {
          console.error('Error deleting error:', err);
          setToast({ type: 'error', message: 'Erreur lors de la suppression' });
        }
      }
    });
  };

  const handlePurgeErrors = () => {
    setConfirmDialog({
      title: 'Purger toutes les erreurs ?',
      message: `Cette action supprimera les ${statistics.totalErrors} erreur(s) de la période sélectionnée. Cette action est irréversible.`,
      type: 'danger',
      confirmText: 'Tout purger',
      cancelText: 'Annuler',
      onConfirm: async () => {
        try {
          const url = `/api/analytics/errors?clearAll=true&period=${period}${userId ? `&userId=${userId}` : ''}`;
          const response = await fetch(url, { method: 'DELETE' });
          if (!response.ok) throw new Error('Failed to purge errors');
          const result = await response.json();
          setToast({ type: 'success', message: `${result.deleted} erreur(s) supprimée(s)` });
          setExpandedErrorId(null);
          await fetchErrors();
        } catch (err) {
          console.error('Error purging errors:', err);
          setToast({ type: 'error', message: 'Erreur lors de la purge' });
        }
      }
    });
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-red-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white/60">Analyse des erreurs...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { statistics, errorsByType, commonErrors, recentErrors } = data;

  // Calculate additional metrics
  const criticalErrors = commonErrors.filter(e => e.count >= 5).length;
  const mostFrequentError = commonErrors.length > 0 ? commonErrors[0] : null;
  const uniqueErrorTypes = errorsByType.length;
  const healthScore = statistics.totalErrors === 0 ? 100 : Math.max(0, 100 - statistics.errorRate * 10);

  // Status based on health score
  const getHealthStatus = (score) => {
    if (score >= 90) return { label: 'Excellent', color: 'green', icon: '✅' };
    if (score >= 70) return { label: 'Bon', color: 'blue', icon: '👍' };
    if (score >= 50) return { label: 'Moyen', color: 'yellow', icon: '⚠️' };
    return { label: 'Critique', color: 'red', icon: '❌' };
  };

  const healthStatus = getHealthStatus(healthScore);

  // Prepare chart data
  const pieChartData = errorsByType.map(e => ({
    name: e.type.replace(/_/g, ' '),
    value: e.count
  }));

  const renderErrorDetails = (error) => {
    const meta = error.metadata || {};
    const { stackTrace, ...otherMeta } = meta;

    return (
      <div className="border-t border-white/10 mt-3 pt-3 space-y-4">
        {/* Full error message */}
        <div>
          <h4 className="text-xs font-semibold text-white/60 uppercase mb-1">Message complet</h4>
          <code className="text-sm text-red-300 whitespace-pre-wrap break-all block">
            {error.error || 'N/A'}
          </code>
        </div>

        {/* Stack Trace */}
        {stackTrace && (
          <div>
            <h4 className="text-xs font-semibold text-white/60 uppercase mb-1">Stack Trace</h4>
            <pre className="text-xs text-green-300/80 bg-black/40 rounded-lg p-4 overflow-x-auto max-h-64 overflow-y-auto custom-scrollbar border border-white/10 font-mono">
              {stackTrace}
            </pre>
          </div>
        )}

        {/* Metadata */}
        {Object.keys(otherMeta).length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-white/60 uppercase mb-2">Metadata</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {Object.entries(otherMeta).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10">
                  <span className="text-xs text-white/50 shrink-0">{METADATA_LABELS[key] || key} :</span>
                  <span className="text-xs text-white/90 break-all">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Extra info row */}
        <div className="flex flex-wrap gap-4 text-xs text-white/50 pt-2 border-t border-white/10">
          {error.category && (
            <span>Catégorie : <span className="text-white/80">{error.category}</span></span>
          )}
          <span>Device ID : <span className="text-white/80">{error.deviceId || 'N/A'}</span></span>
          {error.duration != null && (
            <span>Durée : <span className="text-white/80">{(error.duration / 1000).toFixed(2)}s</span></span>
          )}
          {error.user && (
            <span>Utilisateur : <span className="text-white/80">{error.user.name || 'N/A'} ({error.user.email}) — {error.user.id}</span></span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon="❌"
          label="Total Erreurs"
          value={statistics.totalErrors}
          subtitle="Sur la période"
          description="Nombre total d'erreurs enregistrées sur la période sélectionnée, tous types confondus"
        />
        <KPICard
          icon="📊"
          label="Taux d'Erreur"
          value={`${statistics.errorRate}%`}
          subtitle="Erreurs / Total événements"
          description="Pourcentage d'événements ayant généré une erreur par rapport au total d'événements trackés"
        />
        <KPICard
          icon={healthStatus.icon}
          label="Santé du Système"
          value={Math.round(healthScore)}
          subtitle={healthStatus.label}
          description="Score de santé calculé en fonction du taux d'erreur (100 = aucune erreur, 0 = critique)"
        />
        <KPICard
          icon="🏷️"
          label="Types d'Erreurs"
          value={uniqueErrorTypes}
          subtitle="Types différents"
          description="Nombre de types d'erreurs uniques détectés, utile pour identifier la diversité des problèmes"
        />
      </div>

      {/* Purge button */}
      {statistics.totalErrors > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handlePurgeErrors}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-400/30 rounded-lg text-sm transition-colors"
          >
            Purger les erreurs ({statistics.totalErrors})
          </button>
        </div>
      )}

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Errors by Type */}
        {errorsByType.length > 0 && (
          <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
            <h3 className="text-lg font-semibold text-white mb-4">📊 Erreurs par type</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={errorsByType} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  type="number"
                  stroke="rgba(255,255,255,0.6)"
                  tick={{ fill: 'rgba(255,255,255,0.6)' }}
                />
                <YAxis
                  type="category"
                  dataKey="type"
                  width={150}
                  stroke="rgba(255,255,255,0.6)"
                  tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="count" fill="#EF4444" name="Nombre d'erreurs" radius={[0, 4, 4, 0]} isAnimationActive={isInitialLoad} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pie Chart - Distribution */}
        {pieChartData.length > 0 && (
          <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
            <h3 className="text-lg font-semibold text-white mb-4">🥧 Distribution des erreurs</h3>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  isAnimationActive={isInitialLoad}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Critical Errors Cards */}
      {commonErrors.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">🚨 Erreurs critiques & fréquentes</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {commonErrors.slice(0, 6).map((error, idx) => {
              const severity = error.count >= 10 ? 'CRITICAL'
                : error.count >= 5 ? 'HIGH'
                : error.count >= 3 ? 'MEDIUM'
                : 'LOW';
              const severityConfig = ERROR_SEVERITY[severity];
              const errorPercent = statistics.totalErrors > 0 ? ((error.count / statistics.totalErrors) * 100).toFixed(1) : 0;

              return (
                <div
                  key={idx}
                  className="bg-white/5 rounded-lg p-3 border border-white/10 hover:bg-white/10 transition-all"
                  style={{ borderLeftWidth: '4px', borderLeftColor: severityConfig.color }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{severityConfig.icon}</span>
                      <span className="text-xs font-medium" style={{ color: severityConfig.color }}>
                        {severityConfig.label}
                      </span>
                    </div>
                    <span className="px-1.5 py-0.5 bg-red-500/20 text-red-300 border border-red-400/30 rounded-sm text-xs font-bold">
                      {error.count}
                    </span>
                  </div>
                  <code className="text-xs text-red-300 line-clamp-1 block mb-2">{error.message}</code>
                  <div className="flex items-center justify-between text-xs text-white/40">
                    <span>{errorPercent}% du total</span>
                    <span>🕐 {new Date(error.lastOccurrence).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                    })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Errors Table (collapsible) */}
      <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg border border-white/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">📋 Erreurs récentes (détails)</h3>
          <button
            onClick={() => setShowRecentTable(!showRecentTable)}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors"
          >
            {showRecentTable ? 'Masquer' : 'Afficher'}
          </button>
        </div>

        {showRecentTable && (
          <div className="p-4">
            {recentErrors.length > 0 ? (
              <div className="space-y-2">
                {recentErrors.map((error) => {
                  const isCritical = error.type.includes('FAILED') || error.error?.toLowerCase().includes('critical');
                  const severity = isCritical ? ERROR_SEVERITY.CRITICAL : ERROR_SEVERITY.MEDIUM;
                  const isExpanded = expandedErrorId === error.id;

                  return (
                    <div
                      key={error.id}
                      className={`p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition cursor-pointer ${isExpanded ? 'bg-white/10' : ''}`}
                      onClick={() => setExpandedErrorId(isExpanded ? null : error.id)}
                    >
                      {/* Ligne 1 : sévérité + type + date + supprimer */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base" title={severity.label}>{severity.icon}</span>
                        <span className="text-xs font-medium" style={{ color: severity.color }}>{severity.label}</span>
                        <span className="px-1.5 py-0.5 bg-white/10 text-white/70 rounded-sm text-xs border border-white/20">
                          {error.type}
                        </span>
                        <span className="text-xs text-white/50">
                          {new Date(error.timestamp).toLocaleString('fr-FR', {
                            day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteError(error.id);
                          }}
                          className="ml-auto p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-400/30 rounded transition-colors shrink-0"
                          title="Supprimer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      {/* Ligne 2 : utilisateur */}
                      <div className="text-sm text-white/80 mt-1">
                        {error.user?.name || error.user?.email || 'Anonyme'}
                      </div>
                      {/* Ligne 3 : message */}
                      <code className="line-clamp-2 text-red-300 text-xs block mt-1">
                        {error.error || 'N/A'}
                      </code>
                      {/* Hint détails */}
                      {error.metadata && (
                        <div className="text-xs text-white/40 mt-1">
                          {isExpanded ? '▼ Détails affichés' : '▶ Cliquer pour voir les détails'}
                        </div>
                      )}
                      {/* Panel détails expandable */}
                      {isExpanded && renderErrorDetails(error)}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-white/60 py-8">
                Aucune erreur trouvée 🎉
              </div>
            )}
          </div>
        )}
      </div>

      {/* No Errors State */}
      {recentErrors.length === 0 && statistics.totalErrors === 0 && (
        <div className="text-center py-12 bg-gradient-to-br from-green-500/20 to-green-600/10 backdrop-blur-xl rounded-lg border border-green-400/30">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-2xl font-bold text-white mb-2">Système Sain !</h3>
          <p className="text-green-300/80">Aucune erreur détectée sur la période sélectionnée</p>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
