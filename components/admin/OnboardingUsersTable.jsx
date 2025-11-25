'use client';

import { useState, useEffect, useRef } from 'react';
import { CustomSelect } from './CustomSelect';
import { Toast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import {
  ONBOARDING_STEPS,
  ONBOARDING_STATUSES,
  getStatusInfo,
  getStepIcon,
} from '@/lib/admin/onboardingSteps';
import { formatDate, formatRelativeTime } from '@/lib/utils/dateFormatters';

/**
 * Table des utilisateurs avec leur statut d'onboarding
 * Inclut filtres, pagination et action de reset
 */
export function OnboardingUsersTable({ refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);

  // Filtres
  const [statusFilter, setStatusFilter] = useState('all');
  const [stepFilter, setStepFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [limit, setLimit] = useState('10');
  const [page, setPage] = useState(1);

  // Feedback
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Ref pour éviter les appels multiples
  const fetchingRef = useRef(false);
  const scrollContainerRef = useRef(null);

  // Debounce recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch data
  useEffect(() => {
    if (!fetchingRef.current) {
      fetchData();
    }
  }, [statusFilter, stepFilter, debouncedSearch, sortBy, limit, page, refreshKey]);

  // Reset page quand filtres changent
  useEffect(() => {
    setPage(1);
  }, [statusFilter, stepFilter, debouncedSearch, sortBy, limit]);

  // Scroll chaining prevention
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    function preventScrollChaining(e) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const isAtTop = scrollTop <= 1;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

      if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    scrollContainer.addEventListener('wheel', preventScrollChaining, { passive: false });
    return () => scrollContainer.removeEventListener('wheel', preventScrollChaining);
  }, [data]);

  async function fetchData() {
    if (fetchingRef.current) return;

    try {
      fetchingRef.current = true;
      if (!data) setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (stepFilter !== '') {
        params.append('step', stepFilter);
      }

      if (debouncedSearch.trim()) {
        params.append('search', debouncedSearch.trim());
      }

      const response = await fetch(`/api/admin/onboarding/users?${params}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Failed to fetch data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching onboarding users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }

  // Reset onboarding d'un utilisateur
  async function handleResetOnboarding(user) {
    if (updating) return;

    setConfirmDialog({
      title: "Réinitialiser l'onboarding ?",
      message: `L'utilisateur ${user.name || user.email} devra recommencer l'onboarding depuis le début. Cette action est irréversible.`,
      type: 'warning',
      confirmText: 'Réinitialiser',
      cancelText: 'Annuler',
      onConfirm: async () => {
        try {
          setUpdating(true);
          const response = await fetch('/api/admin/onboarding/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
            throw new Error(errorData.error || 'Erreur lors de la réinitialisation');
          }

          setToast({ type: 'success', message: `Onboarding réinitialisé pour ${user.email}` });
          await new Promise(resolve => setTimeout(resolve, 500));
          await fetchData();
        } catch (err) {
          console.error('Error resetting onboarding:', err);
          setToast({ type: 'error', message: err.message });
        } finally {
          setUpdating(false);
        }
      },
    });
  }

  // Status badge
  const getStatusBadge = (status, isStuck, stuckDays) => {
    // Override status affichage si bloqué
    const displayStatus = isStuck ? 'stuck' : status;
    const info = getStatusInfo(displayStatus);

    return (
      <span className={`px-2 py-1 text-xs rounded font-medium ${info.bgColor} ${info.color}`}>
        {isStuck ? `Bloqué (${stuckDays}j)` : info.label}
      </span>
    );
  };

  // Progress bar
  const ProgressBar = ({ percent }) => (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            percent === 100 ? 'bg-emerald-500' : percent >= 50 ? 'bg-blue-500' : 'bg-amber-500'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-white/60 text-xs w-10 text-right">{percent}%</span>
    </div>
  );

  if (loading && !data) {
    return (
      <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-white/60">Chargement des utilisateurs...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 p-6">
        <div className="text-red-400 text-center py-12">Erreur : {error}</div>
      </div>
    );
  }

  if (!data) return null;

  // Options pour les filtres
  const statusOptions = ONBOARDING_STATUSES.map(s => ({ value: s.value, label: s.label }));
  const stepOptions = [
    { value: '', label: 'Toutes les étapes' },
    ...ONBOARDING_STEPS.map(s => ({ value: s.id.toString(), label: `${s.icon} ${s.nameFr}` })),
  ];

  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Utilisateurs par statut d'onboarding</h3>

      {/* Filtres */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Recherche */}
        <div className="lg:col-span-2">
          <label className="text-white/60 text-sm mb-2 block">Rechercher :</label>
          <input
            type="text"
            placeholder="Nom ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-none focus:border-blue-400/50 transition"
          />
        </div>

        {/* Filtre Statut */}
        <div>
          <label className="text-white/60 text-sm mb-2 block">Statut :</label>
          <CustomSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
          />
        </div>

        {/* Filtre Étape */}
        <div>
          <label className="text-white/60 text-sm mb-2 block">Étape :</label>
          <CustomSelect
            value={stepFilter}
            onChange={setStepFilter}
            options={stepOptions}
          />
        </div>

        {/* Tri */}
        <div>
          <label className="text-white/60 text-sm mb-2 block">Tri :</label>
          <CustomSelect
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'newest', label: 'Plus récent' },
              { value: 'oldest', label: 'Plus ancien' },
              { value: 'progress', label: 'Progression' },
            ]}
          />
        </div>
      </div>

      {/* Header avec count et pagination */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-white/60 text-sm">
          {data.pagination.total} utilisateur{data.pagination.total > 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-sm">Par page :</span>
          <div className="w-20">
            <CustomSelect
              value={limit}
              onChange={setLimit}
              options={[
                { value: '10', label: '10' },
                { value: '25', label: '25' },
                { value: '50', label: '50' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Liste des utilisateurs */}
      <div
        ref={scrollContainerRef}
        className="max-h-[500px] overflow-y-auto space-y-3 [overscroll-behavior:contain] custom-scrollbar"
      >
        {data.users.length === 0 ? (
          <div className="text-center py-12 text-white/60">
            Aucun utilisateur trouvé
          </div>
        ) : (
          data.users.map((user) => (
            <div
              key={user.id}
              className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Infos utilisateur */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white font-bold flex-shrink-0">
                    {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
                  </div>

                  {/* Détails */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-white font-medium truncate">
                        {user.name || 'Sans nom'}
                      </span>
                      {getStatusBadge(user.status, user.isStuck, user.stuckDays)}
                    </div>

                    <div className="text-white/60 text-sm truncate mb-2">
                      {user.email}
                    </div>

                    {/* Progression */}
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs text-white/60 mb-1">
                        <span>
                          {getStepIcon(user.currentStep)} Étape {user.currentStep}/8 - {user.currentStepName}
                        </span>
                        <span>{user.modalsCompleted}/{user.totalModals} modales</span>
                      </div>
                      <ProgressBar percent={user.progressPercent} />
                    </div>

                    {/* Dates */}
                    <div className="flex items-center gap-4 text-xs text-white/40 flex-wrap">
                      <span>Démarré : {formatDate(user.startedAt)}</span>
                      <span>Dernière activité : {formatRelativeTime(user.lastActivity)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex-shrink-0">
                  <button
                    onClick={() => handleResetOnboarding(user)}
                    disabled={updating}
                    className="px-3 py-1.5 text-xs bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Réinitialiser
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {data.pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
          <div className="text-white/60 text-sm">
            Page {data.pagination.page} sur {data.pagination.totalPages}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition text-sm"
            >
              Précédent
            </button>
            <button
              onClick={() => setPage(Math.min(data.pagination.totalPages, page + 1))}
              disabled={!data.pagination.hasMore}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition text-sm"
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {/* Toast and Confirm Dialog */}
      <Toast toast={toast} onClose={() => setToast(null)} />
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
}
