'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { KPICard } from './KPICard';

const ERROR_SEVERITY = {
  CRITICAL: { color: '#EF4444', label: 'Critique', icon: '🔴' },
  HIGH: { color: '#F59E0B', label: 'Élevée', icon: '🟠' },
  MEDIUM: { color: '#FBBF24', label: 'Moyenne', icon: '🟡' },
  LOW: { color: '#3B82F6', label: 'Faible', icon: '🔵' }
};

const PIE_COLORS = ['#EF4444', '#F59E0B', '#FBBF24', '#3B82F6', '#8B5CF6', '#EC4899'];

export function ErrorsTab({ period, userId, refreshKey, isInitialLoad }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRecentTable, setShowRecentTable] = useState(false);

  useEffect(() => {
    fetchErrors();
  }, [period, userId, refreshKey]);

  async function fetchErrors() {
    setLoading(true);
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

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-red-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white/60">Analyse des erreurs...</p>
        </div>
      </div>
    );
  }

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  className="bg-white/5 backdrop-blur-xl rounded-lg shadow-lg p-5 border border-white/10 hover:border-red-400/50 hover:bg-white/10 transition-all duration-300"
                  style={{
                    borderLeftWidth: '4px',
                    borderLeftColor: severityConfig.color
                  }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{severityConfig.icon}</span>
                      <div>
                        <span className="text-xs font-medium" style={{ color: severityConfig.color }}>
                          {severityConfig.label}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-red-500/20 text-red-300 border border-red-400/30 rounded text-sm font-bold">
                      {error.count}
                    </span>
                  </div>

                  {/* Error Message */}
                  <div className="mb-3">
                    <code className="text-xs text-red-300 line-clamp-2 block">
                      {error.message}
                    </code>
                  </div>

                  {/* Stats */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-white/40">Part du total</span>
                      <span className="text-white/80 font-medium">{errorPercent}%</span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${errorPercent}%`,
                          backgroundColor: severityConfig.color
                        }}
                      />
                    </div>

                    {/* Types */}
                    {error.types && error.types.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-2 border-t border-white/10">
                        {error.types.slice(0, 3).map((type, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-white/10 text-white/60 rounded text-xs border border-white/20"
                          >
                            {type.replace(/_/g, ' ')}
                          </span>
                        ))}
                        {error.types.length > 3 && (
                          <span className="text-xs text-white/40">+{error.types.length - 3}</span>
                        )}
                      </div>
                    )}

                    {/* Last occurrence */}
                    <div className="flex items-center gap-2 text-xs text-white/40 pt-1">
                      <span>🕐</span>
                      <span>{new Date(error.lastOccurrence).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                    </div>
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
          <div className="overflow-x-auto">
            {recentErrors.length > 0 ? (
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Sévérité
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Utilisateur
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Message d'erreur
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Date & Heure
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {recentErrors.map((error) => {
                    // Determine severity based on error type or message
                    const isCritical = error.type.includes('FAILED') || error.error?.toLowerCase().includes('critical');
                    const severity = isCritical ? ERROR_SEVERITY.CRITICAL : ERROR_SEVERITY.MEDIUM;

                    return (
                      <tr key={error.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{severity.icon}</span>
                            <span
                              className="text-xs font-medium"
                              style={{ color: severity.color }}
                            >
                              {severity.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                          <span className="px-2 py-1 bg-white/10 text-white/70 rounded text-xs border border-white/20">
                            {error.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                          {error.user?.name || error.user?.email || 'Anonyme'}
                        </td>
                        <td className="px-6 py-4 text-sm max-w-md">
                          <code className="text-red-300 text-xs block truncate">
                            {error.error || 'N/A'}
                          </code>
                          {error.metadata && (
                            <div className="text-xs text-white/40 mt-1">
                              Metadata disponible
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                          {new Date(error.timestamp).toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
    </div>
  );
}
