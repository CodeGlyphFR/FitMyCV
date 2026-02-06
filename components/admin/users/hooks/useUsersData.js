'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Hook for fetching and managing users data with filters and pagination
 */
export function useUsersData({ refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtres
  const [roleFilter, setRoleFilter] = useState('all');
  const [emailStatusFilter, setEmailStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [limit, setLimit] = useState('10');
  const [page, setPage] = useState(1);

  // Contrôle du fetch pour éviter les requêtes multiples
  const fetchingRef = useRef(false);

  // Debounce pour la recherche (1000ms pour éviter trop de requêtes)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 1000);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page quand on change de filtres
  useEffect(() => {
    setPage(1);
  }, [roleFilter, emailStatusFilter, sortBy, debouncedSearch, limit]);

  // Fetch data
  useEffect(() => {
    if (!fetchingRef.current) {
      fetchData();
    }
  }, [roleFilter, emailStatusFilter, sortBy, debouncedSearch, limit, page, refreshKey]);

  async function fetchData() {
    if (fetchingRef.current) {
      console.log('[UsersTab] Fetch déjà en cours, ignoré');
      return;
    }

    try {
      fetchingRef.current = true;
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
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }

  return {
    // Data
    data,
    loading,
    error,
    // Filters
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
    // Actions
    refetch: fetchData,
  };
}
