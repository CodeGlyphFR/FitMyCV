"use client";

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook pour récupérer les coûts en crédits des features
 *
 * @returns {Object}
 * - showCosts: boolean - true si on doit afficher les coûts (mode crédits-only)
 * - costs: Object - { featureName: cost }
 * - getCost: (featureName) => number - récupère le coût d'une feature
 * - getTotalCost: (featureName, count) => number - récupère le coût total (coût × count)
 * - loading: boolean
 * - error: string | null
 * - refetch: () => void
 */
export function useCreditCost() {
  const [state, setState] = useState({
    showCosts: false,
    costs: {},
    loading: true,
    error: null,
  });

  const fetchCosts = useCallback(async (isMounted = true) => {
    try {
      const response = await fetch('/api/credits/costs', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!response.ok) throw new Error('Erreur API');

      const data = await response.json();

      if (isMounted) {
        setState({
          showCosts: data.showCosts,
          costs: data.costs || {},
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      if (isMounted) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error.message,
        }));
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchCosts(isMounted);

    // Écouter les mises à jour des settings
    const handleSettingsUpdate = () => fetchCosts(true);
    window.addEventListener('settings:updated', handleSettingsUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('settings:updated', handleSettingsUpdate);
    };
  }, [fetchCosts]);

  // Helper pour récupérer le coût d'une feature spécifique
  const getCost = useCallback(
    (featureName) => {
      return state.costs[featureName] ?? 0;
    },
    [state.costs]
  );

  // Calcul du coût total pour plusieurs opérations
  const getTotalCost = useCallback(
    (featureName, count = 1) => {
      return getCost(featureName) * count;
    },
    [getCost]
  );

  return {
    ...state,
    getCost,
    getTotalCost,
    refetch: () => fetchCosts(true),
  };
}

export default useCreditCost;
