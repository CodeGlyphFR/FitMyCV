'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw } from 'lucide-react';

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
    sent: 'Envoyé',
    failed: 'Échec',
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
 * EmailHistorySection - Section Historique avec filtres améliorés
 */
export function EmailHistorySection({ refreshKey }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [templateFilter, setTemplateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [templates, setTemplates] = useState([]);

  // Fetch available templates for filter
  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      const res = await fetch('/api/admin/email-templates');
      if (!res.ok) return;
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  }

  const fetchLogs = async (page = 1) => {
    try {
      setLoading(true);

      const params = new URLSearchParams({ page: page.toString(), limit: '20' });
      if (templateFilter) params.append('template', templateFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

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

  const handleSearch = () => {
    fetchLogs(1);
  };

  const handlePageChange = (newPage) => {
    fetchLogs(newPage);
  };

  const handleRefresh = () => {
    fetchLogs(pagination.page);
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Rechercher par email..."
              className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-violet-500/50 text-sm"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-white/40" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500/50"
            >
              <option value="">Tous les statuts</option>
              <option value="sent">Envoyés</option>
              <option value="failed">Échecs</option>
            </select>
          </div>

          {/* Template Filter */}
          <select
            value={templateFilter}
            onChange={(e) => setTemplateFilter(e.target.value)}
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500/50"
          >
            <option value="">Tous les templates</option>
            {templates.map((t) => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white transition-colors"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/60">
          {pagination.total} résultat{pagination.total > 1 ? 's' : ''}
        </span>
        {(statusFilter || templateFilter || searchQuery) && (
          <button
            onClick={() => {
              setStatusFilter('');
              setTemplateFilter('');
              setSearchQuery('');
            }}
            className="text-violet-400 hover:text-violet-300 text-sm"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-white/50">
              <div className="text-4xl mb-3">📭</div>
              <p>Aucun email trouvé</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-white/50 uppercase tracking-wider border-b border-white/10">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Destinataire</th>
                  <th className="px-4 py-3">Template</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-sm text-white/80 whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-white/80">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[200px]">{log.recipientEmail}</span>
                        {log.isTestEmail && (
                          <span className="px-1.5 py-0.5 text-xs bg-sky-500/20 text-sky-400 rounded flex-shrink-0">
                            Test
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-white/60">
                      <span className="truncate max-w-[150px] block">{log.templateName}</span>
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
                          {log.error.length > 40 ? `${log.error.slice(0, 40)}...` : log.error}
                        </span>
                      ) : log.providerId ? (
                        <span className="text-white/40 text-xs font-mono">
                          {log.providerId.length > 20 ? `${log.providerId.slice(0, 20)}...` : log.providerId}
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
                Précédent
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
    </div>
  );
}

export default EmailHistorySection;
