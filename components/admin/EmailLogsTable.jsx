'use client';

import { useState, useEffect } from 'react';

/**
 * Format date for display
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Status badge component
 */
function StatusBadge({ status }) {
  const styles = {
    sent: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    test: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  };

  const labels = {
    sent: 'Envoye',
    failed: 'Echec',
    test: 'Test',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${styles[status] || styles.sent}`}>
      {labels[status] || status}
    </span>
  );
}

/**
 * Provider badge component
 */
function ProviderBadge({ provider }) {
  const styles = {
    smtp: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    resend: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    unknown: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  const labels = {
    smtp: 'SMTP',
    resend: 'Resend',
    unknown: '?',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${styles[provider] || styles.unknown}`}>
      {labels[provider] || provider || '?'}
    </span>
  );
}

/**
 * EmailLogsTable - Table des logs d'emails envoyes
 *
 * @param {Object} props
 * @param {string} props.templateFilter - Filtrer par nom de template (optionnel)
 * @param {number} props.refreshKey - Cle pour forcer le refresh
 * @param {number} props.limit - Nombre de logs a afficher (default: 10)
 */
export function EmailLogsTable({ templateFilter, refreshKey, limit = 10 }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState('');

  const fetchLogs = async (page = 1) => {
    try {
      setLoading(true);

      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (templateFilter) params.append('template', templateFilter);
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`/api/admin/email-logs?${params}`);
      if (!res.ok) throw new Error('Failed to fetch logs');

      const data = await res.json();
      setLogs(data.logs || []);
      setPagination(data.pagination || { page: 1, total: 0, totalPages: 1 });
    } catch (error) {
      console.error('Error fetching email logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [templateFilter, statusFilter, refreshKey]);

  const handlePageChange = (newPage) => {
    fetchLogs(newPage);
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
      {/* Header with filters */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">
          Historique des envois
          {pagination.total > 0 && (
            <span className="ml-2 text-white/50">({pagination.total})</span>
          )}
        </h3>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:outline-hidden focus:border-emerald-500/50"
        >
          <option value="">Tous les statuts</option>
          <option value="sent">Envoyes</option>
          <option value="failed">Echecs</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-white/50">
            Aucun email envoye
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-white/50 uppercase tracking-wider">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Destinataire</th>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-sm text-white/80">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-white/80">
                    <div className="flex items-center gap-2">
                      {log.recipientEmail}
                      {log.isTestEmail && (
                        <span className="px-1.5 py-0.5 text-xs bg-sky-500/20 text-sky-400 rounded">
                          Test
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-white/60">
                    {log.templateName}
                  </td>
                  <td className="px-4 py-3">
                    <ProviderBadge provider={log.provider} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {log.error ? (
                      <span className="text-red-400 text-xs" title={log.error}>
                        {log.error.length > 30 ? `${log.error.slice(0, 30)}...` : log.error}
                      </span>
                    ) : log.providerId ? (
                      <span className="text-white/40 text-xs font-mono">
                        {log.providerId.length > 16 ? `${log.providerId.slice(0, 16)}...` : log.providerId}
                      </span>
                    ) : (
                      <span className="text-white/30">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
          <span className="text-sm text-white/50">
            Page {pagination.page} sur {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1 text-sm bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
            >
              Precedent
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 text-sm bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmailLogsTable;
