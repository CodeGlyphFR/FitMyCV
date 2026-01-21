'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { FEATURE_CONFIG, getFeatureConfig } from '@/lib/analytics/featureConfig';
import { KPICard } from './KPICard';

export function FeaturesTab({ period, userId, refreshKey, isInitialLoad }) {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    fetchFeatures();
  }, [period, userId, refreshKey]);

  async function fetchFeatures() {
    // Only show loader if no data yet (initial load)
    if (features.length === 0) {
      setLoading(true);
    }
    try {
      const url = `/api/analytics/features?period=${period}${userId ? `&userId=${userId}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setFeatures(data.features || []);
    } catch (error) {
      console.error('Error fetching features:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading && features.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white/60">Chargement des features...</p>
        </div>
      </div>
    );
  }

  // Calculate KPIs
  const totalUsage = features.reduce((sum, f) => sum + f.totalUsage, 0);
  const totalUsers = Math.max(...features.map(f => f.userCount), 0);
  const mostPopular = features.length > 0
    ? features.reduce((prev, current) => (prev.totalUsage > current.totalUsage ? prev : current))
    : null;
  const avgDuration = features.length > 0
    ? features.reduce((sum, f) => sum + (f.avgDuration || 0), 0) / features.filter(f => f.avgDuration > 0).length
    : 0;

  // Prepare chart data
  const barChartData = features
    .map(f => {
      const config = getFeatureConfig(f.featureName);
      return {
        name: config.name,
        fullName: f.featureName,
        usage: f.totalUsage,
        users: f.userCount,
        avgDuration: f.avgDuration,
        icon: config.icon,
        fill: config.colors.solid
      };
    })
    .sort((a, b) => b.usage - a.usage);

  // Custom tooltip for bar chart
  const CustomBarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const usagePercent = totalUsage > 0 ? ((data.usage / totalUsage) * 100).toFixed(1) : 0;

      return (
        <div className="bg-black/95 backdrop-blur-xl border border-white/20 rounded-lg p-4 shadow-2xl">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/20">
            <span className="text-2xl">{data.icon}</span>
            <div>
              <p className="text-white font-semibold">{data.name}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center gap-6">
              <span className="text-sm text-blue-300">Utilisations totales</span>
              <span className="text-white font-bold">{data.usage}</span>
            </div>

            <div className="flex justify-between items-center gap-6">
              <span className="text-sm text-green-300">Utilisateurs uniques</span>
              <span className="text-white font-bold">{data.users}</span>
            </div>

            <div className="flex justify-between items-center gap-6">
              <span className="text-sm text-purple-300">Part du total</span>
              <span className="text-white font-bold">{usagePercent}%</span>
            </div>

            {data.avgDuration > 0 && (
              <div className="flex justify-between items-center gap-6">
                <span className="text-sm text-orange-300">Durée moyenne</span>
                <span className="text-white font-bold">{(data.avgDuration / 1000).toFixed(1)}s</span>
              </div>
            )}

            <div className="flex justify-between items-center gap-6 pt-2 border-t border-white/10">
              <span className="text-xs text-white/40">Usage/Utilisateur</span>
              <span className="text-white/80 text-sm">{data.users > 0 ? (data.usage / data.users).toFixed(1) : '-'}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const pieChartData = features
    .filter(f => f.totalUsage > 0)
    .map(f => {
      const config = getFeatureConfig(f.featureName);
      return {
        name: config.name,
        value: f.totalUsage,
        color: config.colors.solid
      };
    })
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon="📊"
          label="Total Utilisations"
          value={totalUsage}
          subtitle="Toutes features"
          description="Nombre total d'utilisations de toutes les fonctionnalités combinées sur la période"
        />
        <KPICard
          icon="👥"
          label="Utilisateurs"
          value={totalUsers}
          subtitle="Actifs"
          description="Nombre maximum d'utilisateurs uniques ayant utilisé au moins une feature"
        />
        <KPICard
          icon={mostPopular ? getFeatureConfig(mostPopular.featureName).icon : '⭐'}
          label="Plus populaire"
          value={mostPopular ? getFeatureConfig(mostPopular.featureName).name : '-'}
          subtitle={mostPopular ? `${mostPopular.totalUsage} fois` : 'N/A'}
          description="Feature la plus utilisée sur la période, avec son nombre total d'utilisations"
        />
        <KPICard
          icon="⏱️"
          label="Durée moy."
          value={avgDuration > 0 ? `${Math.round(avgDuration / 1000)}s` : '-'}
          subtitle="Par utilisation"
          description="Temps moyen d'exécution des features qui trackent leur durée"
        />
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Usage Comparison */}
        <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4">📈 Comparaison des features</h3>
          <ResponsiveContainer width="100%" height={Math.max(300, barChartData.length * 40)}>
            <BarChart data={barChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                type="number"
                stroke="rgba(255,255,255,0.6)"
                tick={{ fill: 'rgba(255,255,255,0.6)' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={150}
                stroke="rgba(255,255,255,0.6)"
                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                interval={0}
              />
              <Tooltip content={<CustomBarTooltip />} />
              <Bar dataKey="usage" name="Utilisations" radius={[0, 4, 4, 0]} isAnimationActive={isInitialLoad}>
                {barChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Distribution */}
        <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4">🥧 Répartition de l'utilisation</h3>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={pieChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                isAnimationActive={isInitialLoad}
              >
                {pieChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.9)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                itemStyle={{
                  color: '#fff'
                }}
                formatter={(value, name) => [value, name]}
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

      {/* Feature Cards */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">🎯 Détail par feature</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features
            .sort((a, b) => b.totalUsage - a.totalUsage)
            .map((feature) => {
              const config = getFeatureConfig(feature.featureName);
              const usagePercent = totalUsage > 0 ? (feature.totalUsage / totalUsage) * 100 : 0;
              const popularityStars = usagePercent > 50 ? '⭐⭐⭐' : usagePercent > 25 ? '⭐⭐' : usagePercent > 10 ? '⭐' : '';

              return (
                <div
                  key={feature.featureName}
                  className="bg-white/5 backdrop-blur-xl rounded-lg shadow-lg p-5 border border-white/10 hover:border-white/30 hover:bg-white/10 transition-all duration-300 hover:-translate-y-1"
                  style={{
                    borderLeftWidth: '4px',
                    borderLeftColor: config.colors.from
                  }}
                >
                  {/* Header with icon and name */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{config.icon}</div>
                      <div>
                        <h4 className="text-white font-semibold">{config.name}</h4>
                      </div>
                    </div>
                    {popularityStars && (
                      <div className="text-lg">{popularityStars}</div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/60">Utilisations</span>
                      <span className="text-lg font-bold text-white">{feature.totalUsage}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/60">Utilisateurs</span>
                      <span className="text-lg font-bold text-white">{feature.userCount}</span>
                    </div>

                    {feature.avgDuration > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-white/60">Durée moy.</span>
                        <span className="text-sm font-medium text-white">{(feature.avgDuration / 1000).toFixed(1)}s</span>
                      </div>
                    )}

                    {/* Usage Progress Bar */}
                    <div className="pt-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-white/40">Part d'utilisation</span>
                        <span className="text-xs text-white/60">{usagePercent.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${usagePercent}%`,
                            background: `linear-gradient(to right, ${config.colors.from}, ${config.colors.to})`
                          }}
                        />
                      </div>
                    </div>

                    {/* Last Used */}
                    <div className="pt-2 flex items-center gap-2 text-xs text-white/40">
                      <span>📅</span>
                      <span>Dernier: {new Date(feature.lastUsedAt).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Optional Table (collapsible) */}
      <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg border border-white/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">📋 Vue détaillée (tableau)</h3>
          <button
            onClick={() => setShowTable(!showTable)}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors"
          >
            {showTable ? 'Masquer' : 'Afficher'}
          </button>
        </div>

        {showTable && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Feature
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Utilisation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Utilisateurs
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Durée moy.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Durée totale
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Dernière utilisation
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {features
                  .sort((a, b) => b.totalUsage - a.totalUsage)
                  .map((feature) => {
                    const config = getFeatureConfig(feature.featureName);
                    return (
                      <tr key={feature.featureName} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                          <div className="flex items-center gap-2">
                            <span>{config.icon}</span>
                            <span>{config.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                          {feature.totalUsage}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                          {feature.userCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                          {feature.avgDuration > 0 ? `${(feature.avgDuration / 1000).toFixed(1)}s` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                          {feature.totalDuration > 0 ? `${Math.round(feature.totalDuration / 1000)}s` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                          {new Date(feature.lastUsedAt).toLocaleDateString('fr-FR')}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
