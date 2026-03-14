'use client';

import { useState, useEffect, useRef } from 'react';
import { KPICard } from './KPICard';
import { CustomSelect } from './CustomSelect';
import { Toast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import { useUsersData } from './users/hooks/useUsersData';
import { useUserActions } from './users/hooks/useUserActions';
import { AddUserModal } from './users/modals/AddUserModal';
import { EditUserModal } from './users/modals/EditUserModal';
import { UserRow } from './users/UserRow';
import { CreditDistributionChart } from './CreditDistributionChart';

export function UsersTab({ refreshKey }) {
  // Data and filters
  const {
    data,
    loading,
    error,
    roleFilter,
    setRoleFilter,
    emailStatusFilter,
    setEmailStatusFilter,
    sortBy,
    setSortBy,
    searchQuery,
    setSearchQuery,
    limit,
    setLimit,
    page,
    setPage,
    refetch,
  } = useUsersData({ refreshKey });

  // Modals
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // User actions
  const {
    updating,
    handleRoleChange,
    handleValidateEmail,
    handleDeleteUser: executeDeleteUser,
    handleAddUser,
    handleUpdateUser,
  } = useUserActions({
    onSuccess: (message) => setToast({ type: 'success', message }),
    onError: (message) => setToast({ type: 'error', message }),
    refetch,
  });

  // Ref pour le scroll chaining
  const scrollContainerRef = useRef(null);

  // Gestion du scroll chaining pour la liste des utilisateurs
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

    return () => {
      scrollContainer.removeEventListener('wheel', preventScrollChaining);
    };
  }, [data]);

  // Delete user with confirmation
  function handleDeleteUser(user) {
    if (updating) return;

    setConfirmDialog({
      title: 'Supprimer cet utilisateur ?',
      message: `Êtes-vous sûr de vouloir supprimer ${user.email} ? Cette action est irréversible et supprimera toutes les données associées (CVs, télémétrie, sessions, etc.).`,
      type: 'danger',
      confirmText: 'Supprimer définitivement',
      cancelText: 'Annuler',
      onConfirm: () => executeDeleteUser(user.id),
    });
  }

  // Open edit modal
  function openEditUserModal(user) {
    setSelectedUserForEdit(user);
    setShowEditUserModal(true);
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white/60">Chargement des utilisateurs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-400">Erreur : {error}</div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 pb-8">
      {/* KPI Cards + Graphique crédits */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          icon="👥"
          label="Total Utilisateurs"
          value={data.kpis.totalUsers}
          subtitle="inscrits au total"
          description="Nombre total d'utilisateurs inscrits depuis le lancement de l'application"
        />
        <KPICard
          icon="📊"
          label="CV Moyen / User"
          value={data.kpis.avgCvPerUser}
          subtitle="CV par utilisateur"
          description="Nombre moyen de CV créés par utilisateur (tous types confondus : générés, importés, traduits)"
        />
        <KPICard
          icon="⏳"
          label="En Attente Validation"
          value={data.kpis.unverifiedCount}
          subtitle="email non vérifié"
          description="Utilisateurs ayant créé un compte mais n'ayant pas encore validé leur adresse email"
        />
        <CreditDistributionChart distribution={data.kpis.creditDistribution} />
      </div>

      {/* Filtres, Recherche et Bouton Ajouter — une seule ligne */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Rechercher..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-hidden focus:border-blue-400/50 transition"
        />
        <CustomSelect
          value={emailStatusFilter}
          onChange={setEmailStatusFilter}
          options={[
            { value: 'all', label: 'Email: Tous' },
            { value: 'verified', label: 'Vérifiés' },
            { value: 'unverified', label: 'Non vérifiés' },
          ]}
        />
        <CustomSelect
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: 'all', label: 'Rôle: Tous' },
            { value: 'USER', label: 'USER' },
            { value: 'ADMIN', label: 'ADMIN' },
          ]}
        />
        <CustomSelect
          value={sortBy}
          onChange={setSortBy}
          options={[
            { value: 'newest', label: 'Plus récent' },
            { value: 'oldest', label: 'Plus ancien' },
          ]}
        />
        <button
          onClick={() => setShowAddUserModal(true)}
          className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition flex items-center gap-2 text-sm whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ajouter
        </button>
      </div>

      {/* Liste des utilisateurs avec scroll chaining prevention */}
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">
            Utilisateurs ({data.pagination.total})
          </h3>

          {/* Sélecteur pagination */}
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-sm">Par page :</span>
            <div className="w-24">
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

        {/* Conteneur scrollable avec overscroll-behavior:contain */}
        <div
          ref={scrollContainerRef}
          className="max-h-[600px] overflow-y-auto space-y-3 [overscroll-behavior:contain] custom-scrollbar"
        >
          {data.users.length === 0 ? (
            <div className="text-center py-12 text-white/60">
              Aucun utilisateur trouvé
            </div>
          ) : (
            data.users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                updating={updating}
                subscriptionMode={data.subscriptionMode}
                onRoleChange={handleRoleChange}
                onEdit={openEditUserModal}
                onValidateEmail={handleValidateEmail}
                onDelete={handleDeleteUser}
              />
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
                className="px-3 py-1.5 bg-white/10 hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-sm transition text-sm"
              >
                Précédent
              </button>

              <button
                onClick={() => setPage(Math.min(data.pagination.totalPages, page + 1))}
                disabled={!data.pagination.hasMore}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-sm transition text-sm"
              >
                Suivant
              </button>
            </div>
          </div>
        )}

        {/* Nombre d'utilisateurs restants */}
        {data.pagination.total > data.users.length && (
          <div className="mt-4 text-center text-white/60 text-sm">
            {data.pagination.total - data.users.length} utilisateur{data.pagination.total - data.users.length > 1 ? 's' : ''} restant{data.pagination.total - data.users.length > 1 ? 's' : ''} en base
          </div>
        )}
      </div>

      {/* Modals */}
      <AddUserModal
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        onSubmit={handleAddUser}
        updating={updating}
      />

      <EditUserModal
        isOpen={showEditUserModal}
        onClose={() => {
          setShowEditUserModal(false);
          setSelectedUserForEdit(null);
        }}
        onSubmit={handleUpdateUser}
        onRoleChange={handleRoleChange}
        user={selectedUserForEdit}
        updating={updating}
      />

      {/* Toast and Confirm Dialog */}
      <Toast toast={toast} onClose={() => setToast(null)} />
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
