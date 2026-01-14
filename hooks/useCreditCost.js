"use client";

import { useCreditCostsContext } from '@/lib/creditCosts/CreditCostsContext';

/**
 * Hook pour récupérer les coûts en crédits des features
 *
 * OPTIMISATION: Utilise désormais un Context centralisé au lieu de faire
 * un fetch indépendant par composant. Cela réduit les appels API de ~8 à 1.
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
  return useCreditCostsContext();
}

export default useCreditCost;
