'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { KPICard } from './KPICard';
import { Toast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';

const JobOfferDetailModal = dynamic(
  () => import('@/components/cv-improvement/JobOfferDetailModal'),
  { ssr: false }
);

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

function formatTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ExtractionErrorsTab({ period, userId, refreshKey, isInitialLoad }) {
  const [view, setView] = useState('errors');

  // --- Errors state ---
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  // --- Success state ---
  const [successData, setSuccessData] = useState(null);
  const [successLoading, setSuccessLoading] = useState(true);
  const [successPage, setSuccessPage] = useState(0);
  const [selectedOffer, setSelectedOffer] = useState(null);

  useEffect(() => {
    setPage(0);
    setSuccessPage(0);
    fetchData();
    fetchSuccessData();
  }, [period, userId, refreshKey]);

  // --- Errors fetch ---
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

  // --- Success fetch ---
  async function fetchSuccessData() {
    if (!successData) setSuccessLoading(true);
    try {
      let url = `/api/admin/extraction-success?period=${period}&page=${successPage}&pageSize=${PAGE_SIZE}`;
      if (userId) url += `&userId=${userId}`;
      const res = await fetch(url);
      const result = await res.json();
      setSuccessData(result);
    } catch (error) {
      console.error('Error fetching extraction success:', error);
    } finally {
      setSuccessLoading(false);
    }
  }

  // Re-fetch success data when page changes
  useEffect(() => {
    if (view === 'success') fetchSuccessData();
  }, [successPage]);

  // --- Errors actions ---
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

  // === RENDER ===

  const statistics = data?.statistics;
  const domainStats = data?.domainStats || [];
  const errors = data?.errors || [];

  const filteredErrors = selectedDomain
    ? errors.filter(e => e.domain === selectedDomain)
    : errors;

  const totalPages = Math.ceil(filteredErrors.length / PAGE_SIZE);
  const paginatedErrors = filteredErrors.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const kpis = successData?.kpis;
  const successExtractions = successData?.extractions || [];
  const successTotal = successData?.total || 0;
  const successTotalPages = Math.ceil(successTotal / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      {confirmDialog && <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />}

      {/* Toggle Échecs / Réussies */}
      <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 w-fit">
        <button
          onClick={() => setView('errors')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer ${
            view === 'errors'
              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
              : 'text-white/50 hover:text-white/70 border border-transparent'
          }`}
        >
          Échecs
          {statistics && <span className="ml-1.5 text-xs opacity-70">({statistics.totalFailed})</span>}
        </button>
        <button
          onClick={() => setView('success')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer ${
            view === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'text-white/50 hover:text-white/70 border border-transparent'
          }`}
        >
          Réussies
          {kpis && <span className="ml-1.5 text-xs opacity-70">({kpis.totalExtractions})</span>}
        </button>
      </div>

      {/* ============================================================ */}
      {/* VUE ÉCHECS (contenu original inchangé)                       */}
      {/* ============================================================ */}
      {view === 'errors' && (
        <>
          {loading && !data ? (
            <div className="flex items-center justify-center p-12">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-white/60">Chargement des erreurs d'extraction...</p>
              </div>
            </div>
          ) : data ? (
            <div className="space-y-8">
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
          ) : null}
        </>
      )}

      {/* ============================================================ */}
      {/* VUE RÉUSSIES                                                 */}
      {/* ============================================================ */}
      {view === 'success' && (
        <>
          {successLoading && !successData ? (
            <div className="flex items-center justify-center p-12">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-white/60">Chargement des extractions réussies...</p>
              </div>
            </div>
          ) : kpis ? (
            <div className="space-y-8">
              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KPICard
                  title="Total extractions"
                  value={kpis.totalExtractions}
                  icon="✅"
                  description="Nombre total d'offres extraites avec succès sur la période"
                />
                <KPICard
                  title="Extractions URL"
                  value={kpis.bySourceType.url}
                  icon="🔗"
                  subtitle={kpis.totalExtractions > 0 ? `${Math.round((kpis.bySourceType.url / kpis.totalExtractions) * 100)}%` : '—'}
                  description="Extractions depuis une URL de site d'emploi"
                />
                <KPICard
                  title="Extractions PDF"
                  value={kpis.bySourceType.pdf}
                  icon="📑"
                  subtitle={kpis.totalExtractions > 0 ? `${Math.round((kpis.bySourceType.pdf / kpis.totalExtractions) * 100)}%` : '—'}
                  description="Extractions depuis un fichier PDF uploadé"
                />
                <KPICard
                  title="Utilisateurs"
                  value={kpis.uniqueUsers}
                  icon="👥"
                  description="Nombre d'utilisateurs ayant extrait au moins une offre"
                />
                <KPICard
                  title="Tokens utilisés"
                  value={formatTokens(kpis.totalTokensUsed)}
                  icon="🔢"
                  subtitle={`~${formatTokens(kpis.avgTokensPerExtraction)} / extraction`}
                  description="Total des tokens OpenAI consommés pour les extractions"
                />
                <KPICard
                  title="Conversion"
                  value={`${kpis.conversionRate}%`}
                  icon="📈"
                  subtitle={`${kpis.cvsGenerated} CV générés`}
                  subtitleClassName={kpis.conversionRate > 50 ? 'text-green-400' : kpis.conversionRate > 25 ? 'text-yellow-400' : 'text-red-400'}
                  description="Pourcentage d'extractions ayant mené à la génération d'au moins 1 CV"
                />
              </div>

              {/* Distribution des modèles */}
              {Object.keys(kpis.modelDistribution).length > 0 && (
                <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Modèles IA utilisés</h3>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(kpis.modelDistribution)
                      .sort(([, a], [, b]) => b - a)
                      .map(([model, count]) => (
                        <div key={model} className="bg-white/5 rounded-lg px-4 py-2 border border-white/10">
                          <span className="text-sm font-medium text-white">{model}</span>
                          <span className="text-xs text-white/40 ml-2">
                            {count} ({kpis.totalExtractions > 0 ? Math.round((count / kpis.totalExtractions) * 100) : 0}%)
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Tableau des extractions réussies */}
              <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Détail des extractions réussies
                  <span className="text-white/40 text-sm font-normal ml-2">({successTotal})</span>
                </h3>

                {successExtractions.length === 0 ? (
                  <p className="text-white/40 text-center py-8">Aucune extraction réussie sur cette période</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {successExtractions.map(ext => (
                        <div key={ext.id} className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-3">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {/* Badge type source */}
                              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                                ext.sourceType === 'url'
                                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              }`}>
                                {ext.sourceType === 'url' ? 'URL' : 'PDF'}
                              </span>

                              {/* Titre du poste */}
                              <span className="text-sm text-white font-medium truncate">
                                {ext.content?.title || 'Sans titre'}
                              </span>

                              {/* Entreprise */}
                              {ext.content?.company && (
                                <span className="text-xs text-white/40 truncate hidden md:inline">
                                  — {ext.content.company}
                                </span>
                              )}

                              {/* CVs générés */}
                              {ext.cvsCount > 0 && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                                  {ext.cvsCount} CV
                                </span>
                              )}

                              {/* Modèle + Tokens */}
                              <span className="text-xs text-white/30 shrink-0 hidden lg:inline">
                                {ext.extractionModel} · {ext.tokensUsed?.toLocaleString()} tok
                              </span>

                              {/* Utilisateur */}
                              <span className="text-xs text-white/30 shrink-0 hidden xl:inline">
                                {ext.userName || ext.userEmail || '—'}
                              </span>

                              {/* Date */}
                              <span className="text-xs text-white/30 shrink-0 ml-auto">
                                {new Date(ext.extractedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            {/* Bouton Voir */}
                            <button
                              onClick={() => setSelectedOffer(ext)}
                              className="flex items-center justify-center shrink-0 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all cursor-pointer"
                              title="Voir les données extraites"
                            >
                              Voir
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {successTotalPages > 1 && (
                      <div className="flex items-center justify-between pt-4 border-t border-white/10">
                        <span className="text-xs text-white/40">
                          {successPage * PAGE_SIZE + 1}–{Math.min((successPage + 1) * PAGE_SIZE, successTotal)} sur {successTotal}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSuccessPage(p => p - 1)}
                            disabled={successPage === 0}
                            className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <span className="text-xs text-white/60">{successPage + 1} / {successTotalPages}</span>
                          <button
                            onClick={() => setSuccessPage(p => p + 1)}
                            disabled={successPage >= successTotalPages - 1}
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
          ) : null}

          {/* Modal détail offre */}
          <JobOfferDetailModal
            isOpen={!!selectedOffer}
            onClose={() => setSelectedOffer(null)}
            jobOffer={selectedOffer}
            isLoading={false}
          />
        </>
      )}
    </div>
  );
}
