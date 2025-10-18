'use client';

import { useState } from 'react';
import { CustomSelect } from './CustomSelect';
import { Toast } from './Toast';

export function ExportsTab({ userId }) {
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState('json');
  const [dataType, setDataType] = useState('events');
  const [period, setPeriod] = useState('30d');
  const [toast, setToast] = useState(null);

  async function handleExport() {
    setExporting(true);
    try {
      // Fetch data based on type
      const userParam = userId ? `&userId=${userId}` : '';
      let url = '';
      switch (dataType) {
        case 'events':
          url = `/api/analytics/events?period=${period}&limit=10000${userParam}`;
          break;
        case 'features':
          url = `/api/analytics/features${userId ? `?userId=${userId}` : ''}`;
          break;
        case 'sessions':
          url = `/api/analytics/sessions?period=${period}&limit=10000${userParam}`;
          break;
        case 'errors':
          url = `/api/analytics/errors?period=${period}&limit=10000${userParam}`;
          break;
        default:
          url = `/api/analytics/summary?period=${period}${userParam}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      // Export based on format
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${dataType}-${period}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'csv') {
        // Convert to CSV
        let csv = '';

        if (dataType === 'events' && data.events) {
          const events = data.events;
          if (events.length > 0) {
            // Headers
            const headers = ['ID', 'Type', 'Category', 'User ID', 'User Email', 'Timestamp', 'Status', 'Error'];
            csv = headers.join(',') + '\n';

            // Rows
            events.forEach(e => {
              const row = [
                e.id,
                e.type,
                e.category,
                e.userId || '',
                e.user?.email || '',
                new Date(e.timestamp).toISOString(),
                e.status || '',
                (e.error || '').replace(/,/g, ';'),
              ];
              csv += row.join(',') + '\n';
            });
          }
        } else if (dataType === 'features' && data.features) {
          const headers = ['Feature', 'Total Usage', 'User Count', 'Avg Duration', 'Last Used'];
          csv = headers.join(',') + '\n';

          data.features.forEach(f => {
            const row = [
              f.featureName,
              f.totalUsage,
              f.userCount,
              f.avgDuration,
              new Date(f.lastUsedAt).toISOString(),
            ];
            csv += row.join(',') + '\n';
          });
        }

        if (csv) {
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `analytics-${dataType}-${period}-${new Date().toISOString().split('T')[0]}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }

      setToast({ type: 'success', message: 'Export réussi !' });
    } catch (error) {
      console.error('Error exporting:', error);
      setToast({ type: 'error', message: 'Erreur lors de l\'export' });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
        <h3 className="text-lg font-semibold text-white mb-4">Export des données</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              Type de données
            </label>
            <CustomSelect
              value={dataType}
              onChange={(e) => setDataType(e.target.value)}
              options={[
                { value: 'events', label: 'Événements' },
                { value: 'features', label: 'Features' },
                { value: 'sessions', label: 'Sessions' },
                { value: 'errors', label: 'Erreurs' },
                { value: 'summary', label: 'Résumé' },
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              Période
            </label>
            <CustomSelect
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              options={[
                { value: '24h', label: 'Dernières 24h' },
                { value: '7d', label: '7 derniers jours' },
                { value: '30d', label: '30 derniers jours' },
                { value: 'all', label: 'Tout' },
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              Format
            </label>
            <CustomSelect
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              options={[
                { value: 'json', label: 'JSON' },
                { value: 'csv', label: 'CSV' },
              ]}
            />
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-6 py-3 bg-blue-500/20 text-blue-300 rounded-lg border border-blue-400/30 hover:bg-blue-500/30 transition backdrop-blur-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? 'Export en cours...' : 'Exporter les données'}
        </button>
      </div>

      {/* API Documentation */}
      <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
        <h3 className="text-lg font-semibold text-white mb-4">Documentation API</h3>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-white mb-2">GET /api/analytics/summary</h4>
            <p className="text-sm text-white/60 mb-2">Vue d'ensemble des KPIs</p>
            <code className="block bg-black/20 p-3 rounded text-sm text-white/80">
              ?period=24h|7d|30d|all
            </code>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-2">GET /api/analytics/events</h4>
            <p className="text-sm text-white/60 mb-2">Liste des événements avec filtres</p>
            <code className="block bg-black/20 p-3 rounded text-sm text-white/80">
              ?userId=xxx&type=CV_GENERATED&limit=100&offset=0
            </code>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-2">GET /api/analytics/features</h4>
            <p className="text-sm text-white/60 mb-2">Statistiques d'usage des features</p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-2">GET /api/analytics/sessions</h4>
            <p className="text-sm text-white/60 mb-2">Statistiques de sessions</p>
            <code className="block bg-black/20 p-3 rounded text-sm text-white/80">
              ?period=30d&limit=50
            </code>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-2">GET /api/analytics/users/[userId]/summary</h4>
            <p className="text-sm text-white/60 mb-2">Stats détaillées d'un utilisateur</p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-2">GET /api/analytics/errors</h4>
            <p className="text-sm text-white/60 mb-2">Analyse des erreurs</p>
            <code className="block bg-black/20 p-3 rounded text-sm text-white/80">
              ?period=7d&limit=100
            </code>
          </div>
        </div>
      </div>

      {/* Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
