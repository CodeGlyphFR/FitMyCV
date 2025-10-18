'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function FeaturesTab() {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeatures();
  }, []);

  async function fetchFeatures() {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics/features');
      const data = await res.json();
      setFeatures(data.features);
    } catch (error) {
      console.error('Error fetching features:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Chargement...</div>;
  }

  const chartData = features.map(f => ({
    name: f.featureName.replace(/_/g, ' '),
    usage: f.totalUsage,
    users: f.userCount,
  }));

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
        <h3 className="text-lg font-semibold text-white mb-4">Usage des features</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={150} />
            <Tooltip />
            <Legend />
            <Bar dataKey="usage" fill="#3B82F6" name="Utilisation totale" />
            <Bar dataKey="users" fill="#10B981" name="Utilisateurs uniques" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg border border-white/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Détails des features</h3>
        </div>
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
                  Analyse levels
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                  Dernière utilisation
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {features.map((feature) => (
                <tr key={feature.featureName} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    {feature.featureName.replace(/_/g, ' ')}
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
                    {feature.analysisLevelBreakdown ? (
                      <div className="flex gap-2">
                        {Object.entries(feature.analysisLevelBreakdown).map(([level, count]) => (
                          <span key={level} className="px-2 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded text-xs">
                            {level}: {count}
                          </span>
                        ))}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                    {new Date(feature.lastUsedAt).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
