'use client';

import { useState, useEffect, useRef } from 'react';
import { KPICard } from './KPICard';
import { CustomSelect } from './CustomSelect';
import { Toast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import { getPlanColor } from '@/lib/admin/planColors';

export function UsersTab({ refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false); // Empêcher les changements multiples

  // Filtres
  const [roleFilter, setRoleFilter] = useState('all');
  const [emailStatusFilter, setEmailStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState(''); // Recherche avec debounce
  const [limit, setLimit] = useState('10');
  const [page, setPage] = useState(1);

  // Modals
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Formulaire ajout utilisateur
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('USER');

  // Formulaire édition utilisateur
  const [editedEmail, setEditedEmail] = useState('');

  // Ref pour le scroll chaining
  const scrollContainerRef = useRef(null);

  // Debounce pour la recherche (1000ms pour éviter trop de requêtes)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 1000);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Contrôle du fetch pour éviter les requêtes multiples
  const fetchingRef = useRef(false);

  useEffect(() => {
    // Éviter les appels multiples simultanés
    if (!fetchingRef.current) {
      fetchData();
    }
  }, [roleFilter, emailStatusFilter, sortBy, debouncedSearch, limit, page, refreshKey]);

  // Gestion du scroll chaining pour la liste des utilisateurs
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    function preventScrollChaining(e) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const isAtTop = scrollTop <= 1;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

      // Bloquer UNIQUEMENT aux limites pour éviter le scroll chaining
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

  async function fetchData() {
    // Empêcher les appels multiples simultanés
    if (fetchingRef.current) {
      console.log('[UsersTab] Fetch déjà en cours, ignoré');
      return;
    }

    try {
      fetchingRef.current = true;
      // Only show loader if no data yet (initial load)
      if (!data) {
        setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
      });

      if (roleFilter !== 'all') {
        params.append('role', roleFilter);
      }

      if (emailStatusFilter !== 'all') {
        params.append('emailStatus', emailStatusFilter);
      }

      if (debouncedSearch.trim()) {
        params.append('search', debouncedSearch.trim());
      }

      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Failed to fetch data');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching users data:', err);
      setError(err.message);

      // Ne pas afficher de toast si c'est une erreur de rate limit (éviter le spam de toasts)
      if (!err.message.includes('Trop de requêtes')) {
        setToast({ type: 'error', message: `Erreur: ${err.message}` });
      }
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }

  // Modifier le rôle d'un utilisateur
  async function handleRoleChange(userId, newRole) {
    if (updating) return; // Empêcher les changements simultanés

    try {
      setUpdating(true);
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateRole', role: newRole }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Erreur lors de la mise à jour du rôle');
      }

      setToast({ type: 'success', message: 'Rôle mis à jour avec succès' });

      // Attendre un peu plus longtemps pour éviter le rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      await fetchData();
    } catch (err) {
      console.error('Error updating role:', err);
      setToast({ type: 'error', message: err.message });
    } finally {
      setUpdating(false);
    }
  }

  // Valider l'email manuellement
  async function handleValidateEmail(userId) {
    if (updating) return;

    try {
      setUpdating(true);
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validateEmail' }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Erreur lors de la validation');
      }

      setToast({ type: 'success', message: 'Email validé avec succès' });
      await new Promise(resolve => setTimeout(resolve, 1000));
      await fetchData();
    } catch (err) {
      console.error('Error validating email:', err);
      setToast({ type: 'error', message: err.message });
    } finally {
      setUpdating(false);
    }
  }

  // Supprimer un utilisateur
  function handleDeleteUser(user) {
    if (updating) return;

    setConfirmDialog({
      title: 'Supprimer cet utilisateur ?',
      message: `Êtes-vous sûr de vouloir supprimer ${user.email} ? Cette action est irréversible et supprimera toutes les données associées (CVs, télémétrie, sessions, etc.).`,
      type: 'danger',
      confirmText: 'Supprimer définitivement',
      cancelText: 'Annuler',
      onConfirm: async () => {
        if (updating) return;

        try {
          setUpdating(true);
          const response = await fetch(`/api/admin/users/${user.id}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
            throw new Error(errorData.error || 'Erreur lors de la suppression');
          }

          setToast({ type: 'success', message: 'Utilisateur supprimé avec succès' });
          await new Promise(resolve => setTimeout(resolve, 1000));
          await fetchData();
        } catch (err) {
          console.error('Error deleting user:', err);
          setToast({ type: 'error', message: err.message });
        } finally {
          setUpdating(false);
        }
      }
    });
  }

  // Ouvrir modal édition utilisateur
  function openEditUserModal(user) {
    setSelectedUserForEdit(user);
    setEditedEmail(user.email);
    setShowEditUserModal(true);
  }

  // Modifier l'utilisateur (email et/ou tokens)
  async function handleUpdateUser() {
    if (!selectedUserForEdit) {
      setToast({ type: 'error', message: 'Utilisateur invalide' });
      return;
    }

    if (!editedEmail.trim()) {
      setToast({ type: 'error', message: 'Email invalide' });
      return;
    }

    if (updating) return;

    try {
      setUpdating(true);

      // Modifier l'email si changé
      if (editedEmail.trim() !== selectedUserForEdit.email) {
        if (selectedUserForEdit.hasOAuth) {
          throw new Error('Impossible de modifier l\'email d\'un utilisateur OAuth');
        }

        const emailResponse = await fetch(`/api/admin/users/${selectedUserForEdit.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'updateEmail', email: editedEmail.trim() }),
        });

        if (!emailResponse.ok) {
          const errorData = await emailResponse.json().catch(() => ({ error: 'Erreur serveur' }));
          throw new Error(errorData.error || 'Erreur lors de la modification de l\'email');
        }
      }

      setToast({ type: 'success', message: 'Utilisateur modifié avec succès' });
      setShowEditUserModal(false);
      setSelectedUserForEdit(null);
      setEditedEmail('');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await fetchData();
    } catch (err) {
      console.error('Error updating user:', err);
      setToast({ type: 'error', message: err.message });
    } finally {
      setUpdating(false);
    }
  }

  // Ajouter un utilisateur manuellement
  async function handleAddUser() {
    // Validation email
    if (!newUserEmail.trim()) {
      setToast({ type: 'error', message: 'Email requis' });
      return;
    }

    // Validation format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUserEmail.trim())) {
      setToast({ type: 'error', message: 'Format email invalide' });
      return;
    }

    // Validation nom
    if (!newUserName.trim()) {
      setToast({ type: 'error', message: 'Nom requis' });
      return;
    }

    // Validation password
    if (!newUserPassword.trim()) {
      setToast({ type: 'error', message: 'Mot de passe requis' });
      return;
    }

    if (newUserPassword.trim().length < 8) {
      setToast({ type: 'error', message: 'Le mot de passe doit contenir au moins 8 caractères' });
      return;
    }

    if (updating) return;

    try {
      setUpdating(true);
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail.trim(),
          name: newUserName.trim(),
          password: newUserPassword.trim(),
          role: newUserRole,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Erreur lors de la création de l\'utilisateur');
      }

      setToast({ type: 'success', message: 'Utilisateur créé avec succès' });
      setShowAddUserModal(false);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserPassword('');
      setNewUserRole('USER');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await fetchData();
    } catch (err) {
      console.error('Error creating user:', err);
      setToast({ type: 'error', message: err.message });
    } finally {
      setUpdating(false);
    }
  }

  // Reset page quand on change de filtres
  useEffect(() => {
    setPage(1);
  }, [roleFilter, emailStatusFilter, sortBy, debouncedSearch, limit]);

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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleBadge = (role) => {
    if (role === 'ADMIN') {
      return (
        <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded font-medium">
          ADMIN
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded font-medium">
        USER
      </span>
    );
  };

  const getEmailStatusBadge = (emailVerified) => {
    if (emailVerified) {
      return (
        <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Vérifié
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs bg-orange-500/20 text-orange-400 rounded flex items-center gap-1">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
        En attente
      </span>
    );
  };

  const getOAuthBadge = (oauthProviders) => {
    if (!oauthProviders || oauthProviders.length === 0) return null;

    const icons = {
      google: '🔵',
      github: '⚫',
      apple: '🍎'
    };

    const providerIcons = oauthProviders.map(p => icons[p] || '🔑').join(' ');

    return (
      <span className="px-2 py-1 text-xs bg-indigo-500/20 text-indigo-400 rounded font-medium flex items-center gap-1">
        <span>{providerIcons}</span>
        OAuth
      </span>
    );
  };

  const getPlanBadge = (subscription) => {
    if (!subscription?.plan) {
      return <span className="px-2 py-0.5 text-xs rounded bg-gray-500/20 text-gray-300">🆓 Gratuit</span>;
    }

    const style = getPlanColor(subscription.plan.tier);

    return (
      <span className={`px-2 py-0.5 text-xs rounded ${style.bg} ${style.text}`}>
        {style.icon} {subscription.plan.name}
      </span>
    );
  };

  const getBillingPeriodBadge = (subscription) => {
    if (!subscription?.billingPeriod) return null;

    return (
      <span className="px-2 py-0.5 text-xs rounded bg-emerald-500/20 text-emerald-400">
        {subscription.billingPeriod === 'monthly' ? '📅 Mensuel' : '📅 Annuel'}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-8">
      {/* KPI Cards avec tooltips */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      </div>

      {/* Bouton Ajouter Utilisateur */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddUserModal(true)}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ajouter un utilisateur
        </button>
      </div>

      {/* Filtres et Recherche */}
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Recherche */}
          <div className="lg:col-span-2">
            <label className="text-white/60 text-sm mb-2 block">Rechercher :</label>
            <input
              type="text"
              placeholder="Nom ou prénom..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-hidden focus:border-blue-400/50 transition"
            />
          </div>

          {/* Filtre Statut Email */}
          <div>
            <label className="text-white/60 text-sm mb-2 block">Statut Email :</label>
            <CustomSelect
              value={emailStatusFilter}
              onChange={setEmailStatusFilter}
              options={[
                { value: 'all', label: 'Tous' },
                { value: 'verified', label: 'Vérifiés' },
                { value: 'unverified', label: 'Non vérifiés' },
              ]}
            />
          </div>

          {/* Filtre Rôle */}
          <div>
            <label className="text-white/60 text-sm mb-2 block">Rôle :</label>
            <CustomSelect
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: 'all', label: 'Tous' },
                { value: 'USER', label: 'USER' },
                { value: 'ADMIN', label: 'ADMIN' },
              ]}
            />
          </div>

          {/* Tri Date */}
          <div>
            <label className="text-white/60 text-sm mb-2 block">Tri Date :</label>
            <CustomSelect
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: 'newest', label: 'Plus récent' },
                { value: 'oldest', label: 'Plus ancien' },
              ]}
            />
          </div>
        </div>
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
              <div
                key={user.id}
                className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Infos utilisateur */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
                    </div>

                    {/* Détails */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-white font-medium truncate">
                          {user.name || 'Sans nom'}
                        </span>
                        {getRoleBadge(user.role)}
                        {getOAuthBadge(user.oauthProviders)}
                        {getEmailStatusBadge(user.emailVerified)}
                      </div>

                      {/* Abonnement et crédits */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {getPlanBadge(user.subscription)}
                        {getBillingPeriodBadge(user.subscription)}
                        {user.credits > 0 && (
                          <span className="px-2 py-0.5 text-xs rounded bg-yellow-500/20 text-yellow-400">
                            💎 {user.credits} crédit{user.credits > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      <div className="text-white/60 text-sm truncate mb-1">
                        {user.email}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-white/40 flex-wrap">
                        <span>📄 {user.cvCount} CV{user.cvCount > 1 ? 's' : ''}</span>
                        <span>📅 Inscrit le {formatDate(user.createdAt)}</span>
                        <span>🕐 Dernière activité : {formatDateTime(user.lastActivity)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {/* Modifier rôle */}
                    <div className="w-28">
                      <CustomSelect
                        value={user.role}
                        onChange={(newRole) => !updating && handleRoleChange(user.id, newRole)}
                        options={[
                          { value: 'USER', label: 'USER' },
                          { value: 'ADMIN', label: 'ADMIN' },
                        ]}
                      />
                    </div>

                    {/* Éditer utilisateur */}
                    <button
                      onClick={() => !updating && openEditUserModal(user)}
                      disabled={updating}
                      className="px-3 py-1.5 text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-sm transition w-28 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Éditer
                    </button>

                    {/* Valider email (si non vérifié) */}
                    {!user.emailVerified && (
                      <button
                        onClick={() => handleValidateEmail(user.id)}
                        disabled={updating}
                        className="px-3 py-1.5 text-xs bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-sm transition w-28 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Valider email
                      </button>
                    )}

                    {/* Supprimer */}
                    <button
                      onClick={() => !updating && handleDeleteUser(user)}
                      disabled={updating}
                      className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-sm transition w-28 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Supprimer
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

      {/* Modal Ajouter Utilisateur */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-white/20 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Ajouter un utilisateur</h3>

            <div className="space-y-4">
              <div>
                <label className="text-white/60 text-sm mb-2 block">Email *</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-hidden focus:border-blue-400/50 transition"
                  placeholder="utilisateur@exemple.com"
                />
              </div>

              <div>
                <label className="text-white/60 text-sm mb-2 block">Nom complet *</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-hidden focus:border-blue-400/50 transition"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="text-white/60 text-sm mb-2 block">Mot de passe *</label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-hidden focus:border-blue-400/50 transition"
                  placeholder="Minimum 8 caractères"
                />
              </div>

              <div>
                <label className="text-white/60 text-sm mb-2 block">Rôle</label>
                <CustomSelect
                  value={newUserRole}
                  onChange={setNewUserRole}
                  options={[
                    { value: 'USER', label: 'USER' },
                    { value: 'ADMIN', label: 'ADMIN' },
                  ]}
                />
              </div>

              <div className="text-xs text-white/40 bg-white/5 p-3 rounded-sm border border-white/10">
                ℹ️ L'email sera automatiquement marqué comme vérifié.
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  setNewUserEmail('');
                  setNewUserName('');
                  setNewUserPassword('');
                  setNewUserRole('USER');
                }}
                disabled={updating}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Annuler
              </button>
              <button
                onClick={handleAddUser}
                disabled={updating}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Éditer Utilisateur */}
      {showEditUserModal && selectedUserForEdit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-white/20 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Éditer l'utilisateur</h3>

            <div className="space-y-4">
              {/* Email */}
              <div>
                <label className="text-white/60 text-sm mb-2 block">Email</label>
                <input
                  type="email"
                  value={editedEmail}
                  onChange={(e) => setEditedEmail(e.target.value)}
                  disabled={selectedUserForEdit?.hasOAuth}
                  className={`w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-hidden focus:border-blue-400/50 transition ${selectedUserForEdit?.hasOAuth ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
                {selectedUserForEdit?.hasOAuth && (
                  <p className="text-xs text-orange-400 mt-1 flex items-center gap-1">
                    <span>🔒</span>
                    L'email ne peut pas être modifié pour un compte OAuth (géré par {selectedUserForEdit.oauthProviders.join('/')})
                  </p>
                )}
              </div>
            </div>

            <div className="text-xs text-white/40 bg-white/5 p-3 rounded-sm border border-white/10 mt-4 mb-4">
              <div>⚠️ La modification de l'email réinitialisera le statut de vérification.</div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowEditUserModal(false);
                  setSelectedUserForEdit(null);
                  setEditedEmail('');
                }}
                disabled={updating}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Annuler
              </button>
              <button
                onClick={handleUpdateUser}
                disabled={updating}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? 'Modification...' : 'Modifier'}
              </button>
            </div>
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
