"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const CreditCostsContext = createContext();

// Valeurs par défaut
const defaultState = {
  showCosts: false,
  costs: {},
  loading: true,
  error: null,
};

/**
 * Provider centralisé pour les coûts en crédits
 * Remplace les multiples appels indépendants de useCreditCost par UN SEUL fetch
 */
export function CreditCostsProvider({ children }) {
  const [state, setState] = useState(defaultState);

  const fetchCosts = useCallback(async () => {
    try {
      const response = await fetch('/api/credits/costs', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!response.ok) throw new Error('Erreur API');

      const data = await response.json();

      setState({
        showCosts: data.showCosts,
        costs: data.costs || {},
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('[CreditCostsProvider] Erreur:', error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error.message,
      }));
    }
  }, []);

  // Fetch initial au montage
  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  // Écouter les mises à jour des settings ET des crédits
  useEffect(() => {
    const handleUpdate = () => {
      fetchCosts();
    };

    // Rafraîchir quand les settings changent (prix modifiés par admin)
    window.addEventListener('settings:updated', handleUpdate);
    // Rafraîchir quand les crédits changent (dépense, remboursement, etc.)
    window.addEventListener('credits-updated', handleUpdate);

    return () => {
      window.removeEventListener('settings:updated', handleUpdate);
      window.removeEventListener('credits-updated', handleUpdate);
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

  const value = {
    ...state,
    getCost,
    getTotalCost,
    refetch: fetchCosts,
  };

  return (
    <CreditCostsContext.Provider value={value}>
      {children}
    </CreditCostsContext.Provider>
  );
}

/**
 * Hook pour accéder aux coûts en crédits
 * Utilise le Context centralisé au lieu de faire un fetch indépendant
 */
export function useCreditCostsContext() {
  const context = useContext(CreditCostsContext);
  if (!context) {
    throw new Error("useCreditCostsContext must be used within a CreditCostsProvider");
  }
  return context;
}
