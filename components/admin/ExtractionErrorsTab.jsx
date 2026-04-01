'use client';

import { useState, useEffect } from 'react';
import { KPICard } from './KPICard';
import { Toast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';

// Labels lisibles pour les erreurs connues
const ERROR_LABELS = {
  'taskQueue.errors.noJobOfferDetected': 'Aucune offre détectée',
  'taskQueue.errors.jobOfferExpired': 'Offre expirée ou supprimée',
  'taskQueue.errors.networkError': 'Erreur réseau / antibot',
  'errors.api.openai.gptNoContent': 'Extraction IA échouée',
};

function parseErrorMessage(raw) {
  if (!raw) return 'Erreur inconnue';
  try {
    const parsed = JSON.parse(raw);
    if (parsed.translationKey) {
      return ERROR_LABELS[parsed.translationKey] || parsed.translationKey;
    }
    return parsed.message || raw;
  } catch {
    return raw.length > 120 ? raw.slice(0, 120) + '…' : raw;
  }
}

function truncateUrl(url, max = 60) {
  if (!url) return '—';
  return url.length > max ? url.slice(0, max) + '…' : url;
}

export function ExtractionErrorsTab({ period, userId, refreshKey, isInitialLoad }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    setPage(0);
    fetchData();
  }, [period, userId, refreshKey]);

  async function fetchData() {
    if (!data) setLoading(true);
    try {
      let url = `/api/admin/extraction-errors?period=${period}&limit=100`;
      if (userId) url += `&userId=${userId}`;
      const res = await fetch(url);
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching extraction errors:', error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteError(id) {
    try {
      const res = await fetch(`/api/admin/extraction-errors?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      setToast({ type: 'success', message: 'Erreur supprimée' });
      if (expandedId === id) setExpandedId(null);
      await fetchData();
    } catch {
      setToast({ type: 'error', message: 'Erreur lors de la suppression' });
    }
  }

  function handleDeleteSingle(id) {
    setConfirmDialog({
      title: 'Marquer comme traité ?',
      message: 'Cette erreur sera supprimée de la liste.',
      type: 'warning',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      onConfirm: () => deleteError(id),
    });
  }

  function handleDeleteDomain(domain, count) {
    setConfirmDialog({
      title: `Supprimer toutes les erreurs de ${domain} ?`,
      message: `${count} erreur(s) seront supprimées pour ce domaine.`,
      type: 'danger',
      confirmText: 'Tout supprimer',
      cancelText: 'Annuler',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/extraction-errors?domain=${encodeURIComponent(domain)}&period=${period}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed');
          const result = await res.json();
          setToast({ type: 'success', message: `${result.deleted} erreur(s) supprimée(s) pour ${domain}` });
          if (selectedDomain === domain) setSelectedDomain(null);
          await fetchData();
        } catch {
          setToast({ type: 'error', message: 'Erreur lors de la suppression' });
        }
      },
    });
  }

  function handlePurgeAll() {
    setConfirmDialog({
      title: 'Purger toutes les erreurs ?',
      message: `${statistics.totalFailed} erreur(s) d'extraction seront supprimées. Cette action est irréversible.`,
      type: 'danger',
      confirmText: 'Tout purger',
      cancelText: 'Annuler',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/extraction-errors?clearAll=true&period=${period}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed');
          const result = await res.json();
          setToast({ type: 'success', message: `${result.deleted} erreur(s) supprimée(s)` });
          setSelectedDomain(null);
          setExpandedId(null);
          await fetchData();
        } catch {
          setToast({ type: 'error', message: 'Erreur lors de la purge' });
        }
      },
    });
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white/60">Chargement des erreurs d'extraction...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { statistics, domainStats, errors } = data;

  const filteredErrors = selectedDomain
    ? errors.filter(e => e.domain === selectedDomain)
    : errors;

  const totalPages = Math.ceil(filteredErrors.length / PAGE_SIZE);
  const paginatedErrors = filteredErrors.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-8">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      {confirmDialog && <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Échecs d'extraction"
          value={statistics.totalFailed}
          icon="❌"
          subtitle={`sur ${statistics.totalExtractions} extractions`}
          description="Nombre total d'extractions d'offres qui ont échoué sur la période"
        />
        <KPICard
          title="Taux d'échec"
          value={`${statistics.failureRate}%`}
          icon="📉"
          subtitleClassName={statistics.failureRate > 20 ? 'text-red-400' : statistics.failureRate > 10 ? 'text-yellow-400' : 'text-green-400'}
          subtitle={statistics.failureRate > 20 ? 'Élevé' : statistics.failureRate > 10 ? 'Modéré' : 'Bon'}
          description="Pourcentage d'extractions échouées vs total"
        />
        <KPICard
          title="Domaines en échec"
          value={domainStats.length}
          icon="🌐"
          subtitle={statistics.topDomain ? `Top: ${statistics.topDomain}` : '—'}
          description="Nombre de domaines distincts ayant généré des erreurs"
        />
        <KPICard
          title="Extractions réussies"
          value={statistics.totalExtractions - statistics.totalFailed}
          icon="✅"
          subtitle="sur la période"
          description="Nombre total d'extractions réussies"
        />
      </div>

      {/* Domaines - barres horizontales */}
      {domainStats.length > 0 && (
        <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-white">Échecs par domaine</h3>
              {selectedDomain && (
                <button
                  onClick={() => { setSelectedDomain(null); setPage(0); }}
                  className="text-xs text-orange-400 hover:text-orange-300 cursor-pointer"
                >
                  ✕ Réinitialiser le filtre
                </button>
              )}
            </div>
            {statistics.totalFailed > 0 && (
              <button
                onClick={handlePurgeAll}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-all cursor-pointer"
                title={`Tout purger (${statistics.totalFailed})`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
          <div className={`grid gap-2 ${
              domainStats.length === 1 ? 'grid-cols-1' :
              domainStats.length === 2 ? 'grid-cols-2' :
              domainStats.length === 3 ? 'grid-cols-3' :
              'grid-cols-4'
            }`}>
            {domainStats.map(d => {
              const maxCount = domainStats[0].count;
              const pct = Math.round((d.count / maxCount) * 100);
              const isSelected = selectedDomain === d.domain;
              return (
                <button
                  key={d.domain}
                  onClick={() => { setSelectedDomain(isSelected ? null : d.domain); setPage(0); }}
                  className={`text-left rounded-lg p-3 transition-all cursor-pointer ${
                    isSelected ? 'bg-orange-500/20 border border-orange-400/40' : 'bg-white/5 border border-transparent hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white truncate">{d.domain}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-sm text-white/60">{d.count}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); handleDeleteDomain(d.domain, d.count); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleDeleteDomain(d.domain, d.count); } }}
                        className="flex items-center justify-center text-green-400/60 hover:text-green-300 transition-colors cursor-pointer"
                        title={`Marquer ${d.domain} comme traité`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="bg-orange-400 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tableau des erreurs */}
      <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Détail des extractions échouées
          {selectedDomain && <span className="text-orange-400 text-sm font-normal ml-2">— {selectedDomain}</span>}
          <span className="text-white/40 text-sm font-normal ml-2">({filteredErrors.length})</span>
        </h3>

        {filteredErrors.length === 0 ? (
          <p className="text-white/40 text-center py-8">Aucune erreur d'extraction sur cette période</p>
        ) : (
          <>
          <div className="space-y-2">
            {paginatedErrors.map(err => (
              <div key={err.id} className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3">
                  <button
                    onClick={() => setExpandedId(expandedId === err.id ? null : err.id)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 shrink-0">
                      {err.domain}
                    </span>
                    <span className="text-sm text-red-400 truncate">{parseErrorMessage(err.error)}</span>
                    <span className="text-xs text-white/30 shrink-0 ml-auto">
                      {new Date(err.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                  <button
                    onClick={() => handleDeleteSingle(err.id)}
                    className="flex items-center justify-center shrink-0 text-green-400/60 hover:text-green-300 transition-colors cursor-pointer"
                    title="Marquer comme traité"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                </div>

                {expandedId === err.id && (
                  <div className="border-t border-white/10 p-4 space-y-3">
                    {/* URL complète */}
                    <div>
                      <h4 className="text-xs font-semibold text-white/60 uppercase mb-1">URL complète</h4>
                      {err.sourceUrl ? (
                        <a
                          href={err.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 hover:text-blue-300 break-all"
                        >
                          {err.sourceUrl}
                        </a>
                      ) : (
                        <span className="text-sm text-white/40">N/A</span>
                      )}
                    </div>

                    {/* Erreur complète */}
                    <div>
                      <h4 className="text-xs font-semibold text-white/60 uppercase mb-1">Erreur brute</h4>
                      <code className="text-xs text-red-300 whitespace-pre-wrap break-all block bg-black/40 rounded-lg p-3 border border-white/10">
                        {err.error || 'N/A'}
                      </code>
                    </div>

                    {/* Utilisateur */}
                    <div className="flex flex-wrap gap-4 text-xs text-white/50 pt-2 border-t border-white/10">
                      <span>Utilisateur : <span className="text-white/80">{err.userName || 'N/A'}</span></span>
                      <span>Email : <span className="text-white/80">{err.userEmail || 'N/A'}</span></span>
                      <span>Retries : <span className="text-white/80">{err.retryCount}</span></span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <span className="text-xs text-white/40">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredErrors.length)} sur {filteredErrors.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-xs text-white/60">{page + 1} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}
