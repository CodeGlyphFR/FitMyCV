'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function ErrorsTab({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchErrors();
  }, [period]);

  async function fetchErrors() {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/errors?period=${period}`);
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching errors:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !data) {
    return <div className="p-8 text-center">Chargement...</div>;
  }

  const { statistics, errorsByType, commonErrors, recentErrors } = data;

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
          <h4 className="text-sm font-medium text-white/60">Total erreurs</h4>
          <p className="text-3xl font-bold text-red-400 mt-2">{statistics.totalErrors}</p>
        </div>
        <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
          <h4 className="text-sm font-medium text-white/60">Taux d'erreur</h4>
          <p className="text-3xl font-bold text-red-400 mt-2">{statistics.errorRate}%</p>
        </div>
      </div>

      {/* Errors by type */}
      {errorsByType.length > 0 && (
        <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4">Erreurs par type</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={errorsByType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#EF4444" name="Nombre d'erreurs" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Common errors */}
      {commonErrors.length > 0 && (
        <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg border border-white/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white">Erreurs fréquentes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Message d'erreur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Occurrences
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Types
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Dernière occurrence
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {commonErrors.map((error, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-sm text-white max-w-md">
                      <code className="text-red-400">{error.message}</code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                      <span className="px-2 py-1 bg-red-500/20 text-red-300 border border-red-400/30 rounded font-semibold">
                        {error.count}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-white/80">
                      <div className="flex flex-wrap gap-1">
                        {error.types.map(type => (
                          <span key={type} className="px-2 py-1 bg-white/10 text-white/70 rounded text-xs border border-white/20">
                            {type}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                      {new Date(error.lastOccurrence).toLocaleString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent errors */}
      <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg border border-white/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Erreurs récentes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                  Message
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {recentErrors.map((error) => (
                <tr key={error.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    {error.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                    {error.user?.email || 'Anonyme'}
                  </td>
                  <td className="px-6 py-4 text-sm text-red-400 max-w-md truncate">
                    {error.error}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                    {new Date(error.timestamp).toLocaleString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {recentErrors.length === 0 && (
        <div className="text-center text-white/60 py-8 bg-white/10 backdrop-blur-xl rounded-lg">
          Aucune erreur trouvée 🎉
        </div>
      )}
    </div>
  );
}
