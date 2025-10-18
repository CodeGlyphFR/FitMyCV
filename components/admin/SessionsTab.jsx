'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function SessionsTab({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, [period]);

  async function fetchSessions() {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/sessions?period=${period}`);
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !data) {
    return <div className="p-8 text-center">Chargement...</div>;
  }

  const { statistics, recentSessions } = data;

  // Distribution des durées pour le graphique
  const durationDistribution = recentSessions
    .filter(s => s.duration)
    .map(s => ({
      duration: Math.round(s.duration / 60000), // en minutes
    }))
    .reduce((acc, s) => {
      const bucket = Math.floor(s.duration / 5) * 5; // buckets de 5 minutes
      const label = `${bucket}-${bucket + 5}min`;
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});

  const distributionData = Object.entries(durationDistribution).map(([label, count]) => ({
    range: label,
    count,
  }));

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
          <h4 className="text-sm font-medium text-white/60">Sessions totales</h4>
          <p className="text-3xl font-bold text-white mt-2">{statistics.totalSessions}</p>
          <p className="text-sm text-white/50 mt-1">{statistics.completedSessions} terminées</p>
        </div>
        <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
          <h4 className="text-sm font-medium text-white/60">Durée moyenne</h4>
          <p className="text-3xl font-bold text-white mt-2">{Math.round(statistics.avgDuration / 60)}m</p>
          <p className="text-sm text-white/50 mt-1">Médiane: {Math.round(statistics.medianDuration / 60)}m</p>
        </div>
        <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
          <h4 className="text-sm font-medium text-white/60">Engagement moyen</h4>
          <p className="text-3xl font-bold text-white mt-2">{statistics.avgEventsPerSession.toFixed(1)}</p>
          <p className="text-sm text-white/50 mt-1">événements/session</p>
        </div>
      </div>

      {/* Duration Distribution */}
      {distributionData.length > 0 && (
        <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4">Distribution des durées</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={distributionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#3B82F6" name="Nombre de sessions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Sessions Table */}
      <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg border border-white/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Sessions récentes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                  Début
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                  Durée
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                  Événements
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                  Pages vues
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                  Statut
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {recentSessions.map((session) => (
                <tr key={session.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                    {session.user?.name || session.user?.email || 'Anonyme'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                    {new Date(session.startedAt).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                    {session.duration
                      ? `${Math.round(session.duration / 60000)}m ${Math.round((session.duration % 60000) / 1000)}s`
                      : 'En cours'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                    {session.eventsCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                    {session.pagesViewed}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {session.endedAt ? (
                      <span className="px-2 py-1 bg-green-500/20 text-green-300 border border-green-400/30 rounded text-xs">
                        Terminée
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded text-xs">
                        Active
                      </span>
                    )}
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
