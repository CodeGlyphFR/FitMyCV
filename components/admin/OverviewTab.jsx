'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { KPICard } from './KPICard';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export function OverviewTab({ period }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, [period]);

  async function fetchSummary() {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/summary?period=${period}`);
      const data = await res.json();
      setSummary(data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !summary) {
    return <div className="p-8 text-center">Chargement...</div>;
  }

  const { kpis, topFeatures } = summary;

  // Prepare data for charts
  const featureData = topFeatures.map(f => ({
    name: f.featureName.replace('_', ' '),
    usage: f.usageCount,
  }));

  return (
    <div className="space-y-6">
      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Utilisateurs actifs"
          value={kpis.activeUsers}
          subtitle={`Sur ${kpis.totalUsers} au total`}
        />
        <KPICard
          title="CVs générés"
          value={kpis.cvGenerated}
          subtitle="Avec IA"
        />
        <KPICard
          title="CVs exportés"
          value={kpis.cvExported}
          subtitle="En PDF"
        />
        <KPICard
          title="Taux de conversion"
          value={`${kpis.conversionRate}%`}
          subtitle="Génération → Export"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Sessions"
          value={kpis.totalSessions}
          subtitle={`${Math.round(kpis.avgSessionDuration / 60)} min en moyenne`}
        />
        <KPICard
          title="Événements"
          value={kpis.totalEvents}
          subtitle="Total trackés"
        />
        <KPICard
          title="Erreurs"
          value={kpis.errorCount}
          subtitle={kpis.totalEvents > 0 ? `${((kpis.errorCount / kpis.totalEvents) * 100).toFixed(2)}% du total` : ''}
        />
        <KPICard
          title="Durée session moy."
          value={`${Math.round(kpis.avgSessionDuration / 60)}m`}
          subtitle={`${kpis.avgSessionDuration}s exactement`}
        />
      </div>

      {/* Top Features Chart */}
      <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
        <h3 className="text-lg font-semibold text-white mb-4">Top 5 Features</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={featureData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="usage" fill="#3B82F6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Analysis Level Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4">Répartition des features</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={featureData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => entry.name}
                outerRadius={80}
                fill="#8884d8"
                dataKey="usage"
              >
                {featureData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4">Statistiques générales</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-white/10">
              <span className="text-white/60">Utilisateurs totaux</span>
              <span className="font-semibold text-white">{kpis.totalUsers}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-white/10">
              <span className="text-white/60">Utilisateurs actifs</span>
              <span className="font-semibold text-white">{kpis.activeUsers}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-white/10">
              <span className="text-white/60">CVs générés</span>
              <span className="font-semibold text-white">{kpis.cvGenerated}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-white/10">
              <span className="text-white/60">CVs exportés</span>
              <span className="font-semibold text-white">{kpis.cvExported}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-white/60">Taux de conversion</span>
              <span className="font-semibold text-green-400">{kpis.conversionRate}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
