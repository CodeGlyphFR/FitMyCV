'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { FEATURE_CONFIG } from '@/lib/analytics/featureConfig';
import { KPICard } from './KPICard';

export function OverviewTab({ period, userId, refreshKey, isInitialLoad }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, [period, userId, refreshKey]);

  async function fetchSummary() {
    setLoading(true);
    try {
      const url = `/api/analytics/summary?period=${period}${userId ? `&userId=${userId}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setSummary(data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white/60">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const { kpis, topFeatures, timeline } = summary;

  // Calculate average values to determine bar order (descending)
  const avgValues = {
    cvCreated: 0,
    cvTranslated: 0,
    cvDeleted: 0,
    activeUsers: 0,
  };

  if (timeline && timeline.length > 0) {
    timeline.forEach(day => {
      avgValues.cvCreated += day.cvCreated || 0;
      avgValues.cvTranslated += day.cvTranslated || 0;
      avgValues.cvDeleted += day.cvDeleted || 0;
      avgValues.activeUsers += day.activeUsers || 0;
    });
    Object.keys(avgValues).forEach(key => {
      avgValues[key] /= timeline.length;
    });
  }

  // Sort bars by average value (descending)
  const sortedBars = [
    { key: 'cvCreated', label: 'CVs Créés', color: '#3B82F6', avg: avgValues.cvCreated },
    { key: 'cvTranslated', label: 'CVs Traduits', color: '#A855F7', avg: avgValues.cvTranslated },
    { key: 'cvDeleted', label: 'CVs Supprimés', color: '#EF4444', avg: avgValues.cvDeleted },
    { key: 'activeUsers', label: 'Utilisateurs Actifs', color: '#10B981', avg: avgValues.activeUsers },
  ].sort((a, b) => b.avg - a.avg).filter(bar => bar.avg > 0); // Remove bars that are always 0

  // Calculate health status
  const getHealthStatus = (score) => {
    if (score >= 90) return { label: 'Excellent', color: 'green', icon: '✅', gradient: 'from-green-500/20 to-green-600/10', border: 'border-green-400/30' };
    if (score >= 70) return { label: 'Bon', color: 'blue', icon: '👍', gradient: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-400/30' };
    if (score >= 50) return { label: 'Moyen', color: 'yellow', icon: '⚠️', gradient: 'from-yellow-500/20 to-yellow-600/10', border: 'border-yellow-400/30' };
    return { label: 'Critique', color: 'red', icon: '❌', gradient: 'from-red-500/20 to-red-600/10', border: 'border-red-400/30' };
  };

  const healthStatus = getHealthStatus(kpis.healthScore);

  // Prepare feature data for chart
  const featureData = topFeatures.map(f => {
    const config = FEATURE_CONFIG[f.featureName] || { icon: '📌', name: f.featureName, colors: { solid: '#6B7280' } };
    return {
      name: config.name,
      icon: config.icon,
      usage: f.usageCount,
      fill: config.colors.solid,
    };
  });

  return (
    <div className="space-y-6">
      {/* Section 1: Main KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          icon="👥"
          label="Utilisateurs inscrits"
          value={kpis.totalUsers}
          subtitle="inscrits au total"
          description="Nombre total d'utilisateurs inscrits sur la plateforme depuis le début"
        />
        <KPICard
          icon="📄"
          label="Total CVs"
          value={kpis.totalCvs}
          subtitle="CVs créés au total"
          description="Nombre total de CV créés par tous les utilisateurs depuis le début"
        />
        <KPICard
          icon="🤖"
          label="CVs Générés IA"
          value={kpis.cvGenerated}
          subtitle={`${((kpis.cvGenerated / kpis.totalCvs) * 100).toFixed(1)}% du total`}
          description="Nombre de CV créés ou modifiés via l'intelligence artificielle (génération, import, optimisation, traduction)"
        />
        <KPICard
          icon="📈"
          label="Taux de Conversion"
          value={`${kpis.conversionRate}%`}
          subtitle="Génération → Export"
          description="Pourcentage d'utilisateurs ayant exporté un CV après l'avoir généré avec l'IA"
        />
        <KPICard
          icon={healthStatus.icon}
          label="Santé du Système"
          value={kpis.healthScore}
          subtitle={healthStatus.label}
          description="Score de santé global du système basé sur les erreurs, la performance et l'utilisation des features"
        />
      </div>

      {/* Section 2: Timeline Chart */}
      {timeline && timeline.length > 0 && (
        <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4">📊 Évolution sur 14 jours</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.6)"
                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.6)"
                tick={{ fill: 'rgba(255,255,255,0.6)' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.9)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Legend />
              {sortedBars.map(bar => (
                <Bar
                  key={bar.key}
                  dataKey={bar.key}
                  name={bar.label}
                  fill={bar.color}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={isInitialLoad}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Section 3: Features & Top 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Features Chart */}
        <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4">🎯 Top Features</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={featureData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="name"
                stroke="rgba(255,255,255,0.6)"
                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                angle={-15}
                textAnchor="end"
                height={80}
              />
              <YAxis
                stroke="rgba(255,255,255,0.6)"
                tick={{ fill: 'rgba(255,255,255,0.6)' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.9)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
                formatter={(value, name, props) => {
                  return [
                    <span key="value" style={{ color: '#fff', fontWeight: 'bold' }}>
                      {value} {value > 1 ? 'utilisations' : 'utilisation'}
                    </span>,
                    <span key="label" style={{ color: '#60A5FA' }}>
                      {props.payload.icon} {props.payload.name}
                    </span>
                  ];
                }}
                labelFormatter={(label) => ''}
              />
              <Bar dataKey="usage" radius={[8, 8, 0, 0]} isAnimationActive={isInitialLoad}>
                {featureData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top 3 Features Cards */}
        <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4">⭐ Top 3 Features</h3>
          <div className="space-y-3">
            {featureData.slice(0, 3).map((feature, idx) => {
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div
                  key={idx}
                  className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-all"
                  style={{ borderLeftWidth: '4px', borderLeftColor: feature.fill }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{medals[idx]}</span>
                      <span className="text-2xl">{feature.icon}</span>
                      <div>
                        <p className="font-semibold text-white">{feature.name}</p>
                        <p className="text-xs text-white/60">{feature.usage} utilisations</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-white">{feature.usage}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section 4: System Health Summary */}
      <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
        <h3 className="text-lg font-semibold text-white mb-4">💚 Santé du Système</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Health Score */}
          <div className="text-center">
            <div className="text-6xl mb-2">{healthStatus.icon}</div>
            <p className="text-3xl font-bold text-white">{kpis.healthScore}</p>
            <p className="text-sm text-white/60 mt-1">{healthStatus.label}</p>
          </div>

          {/* Error Stats */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-white/60">Taux d'erreur</span>
              <span className="font-semibold text-orange-400">{kpis.errorRate}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60">Total erreurs</span>
              <span className="font-semibold text-red-400">{kpis.errorCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60">Taux succès jobs</span>
              <span className="font-semibold text-green-400">{kpis.jobSuccessRate}%</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col justify-center gap-2">
            {kpis.healthScore < 70 && (
              <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-3">
                <p className="text-sm text-yellow-200">⚠️ Attention requise</p>
                <p className="text-xs text-yellow-300/60 mt-1">Consultez l'onglet Erreurs</p>
              </div>
            )}
            {kpis.errorCount > 10 && (
              <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-3">
                <p className="text-sm text-red-200">🚨 Erreurs critiques détectées</p>
                <p className="text-xs text-red-300/60 mt-1">{kpis.errorCount} erreurs à traiter</p>
              </div>
            )}
            {kpis.healthScore >= 90 && (
              <div className="bg-green-500/20 border border-green-400/30 rounded-lg p-3">
                <p className="text-sm text-green-200">✅ Système en excellent état</p>
                <p className="text-xs text-green-300/60 mt-1">Aucune action requise</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
