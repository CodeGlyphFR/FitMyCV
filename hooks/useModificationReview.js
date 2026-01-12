'use client';

import { useState, useCallback, useMemo } from 'react';

/**
 * Hook pour gérer l'état des décisions accept/reject sur les modifications
 *
 * @param {Object} batchResults - Résultats des batches avec modifications
 * @returns {Object} - État et fonctions de gestion
 */
export function useModificationReview(batchResults) {
  // Map des décisions: { modificationKey: 'accepted' | 'rejected' | null }
  const [decisions, setDecisions] = useState({});

  /**
   * Génère une clé unique pour une modification
   */
  const getModificationKey = useCallback((section, index, field) => {
    return `${section}:${index}:${field}`;
  }, []);

  /**
   * Accepter une modification
   */
  const acceptModification = useCallback((section, index, field) => {
    const key = getModificationKey(section, index, field);
    setDecisions((prev) => ({
      ...prev,
      [key]: 'accepted',
    }));
  }, [getModificationKey]);

  /**
   * Refuser une modification
   */
  const rejectModification = useCallback((section, index, field) => {
    const key = getModificationKey(section, index, field);
    setDecisions((prev) => ({
      ...prev,
      [key]: 'rejected',
    }));
  }, [getModificationKey]);

  /**
   * Toggle la décision (accept -> reject -> accept)
   */
  const toggleDecision = useCallback((section, index, field, newDecision) => {
    const key = getModificationKey(section, index, field);
    setDecisions((prev) => ({
      ...prev,
      [key]: newDecision,
    }));
  }, [getModificationKey]);

  /**
   * Récupère la décision pour une modification
   */
  const getDecision = useCallback((section, index, field) => {
    const key = getModificationKey(section, index, field);
    return decisions[key] || null;
  }, [decisions, getModificationKey]);

  /**
   * Accepter toutes les modifications non décidées
   */
  const acceptAll = useCallback((modifications) => {
    const newDecisions = { ...decisions };
    Object.entries(modifications).forEach(([section, mods]) => {
      mods.forEach((mod, index) => {
        const key = getModificationKey(section, index, mod.field);
        if (!newDecisions[key]) {
          newDecisions[key] = 'accepted';
        }
      });
    });
    setDecisions(newDecisions);
  }, [decisions, getModificationKey]);

  /**
   * Refuser toutes les modifications non décidées
   */
  const rejectAll = useCallback((modifications) => {
    const newDecisions = { ...decisions };
    Object.entries(modifications).forEach(([section, mods]) => {
      mods.forEach((mod, index) => {
        const key = getModificationKey(section, index, mod.field);
        if (!newDecisions[key]) {
          newDecisions[key] = 'rejected';
        }
      });
    });
    setDecisions(newDecisions);
  }, [decisions, getModificationKey]);

  /**
   * Accepter toutes les modifications d'une section
   */
  const acceptAllInSection = useCallback((section, mods) => {
    const newDecisions = { ...decisions };
    mods.forEach((mod, index) => {
      const key = getModificationKey(section, index, mod.field);
      newDecisions[key] = 'accepted';
    });
    setDecisions(newDecisions);
  }, [decisions, getModificationKey]);

  /**
   * Refuser toutes les modifications d'une section
   */
  const rejectAllInSection = useCallback((section, mods) => {
    const newDecisions = { ...decisions };
    mods.forEach((mod, index) => {
      const key = getModificationKey(section, index, mod.field);
      newDecisions[key] = 'rejected';
    });
    setDecisions(newDecisions);
  }, [decisions, getModificationKey]);

  /**
   * Statistiques de review
   */
  const stats = useMemo(() => {
    const allDecisions = Object.values(decisions);
    const accepted = allDecisions.filter((d) => d === 'accepted').length;
    const rejected = allDecisions.filter((d) => d === 'rejected').length;
    const reviewed = accepted + rejected;

    return {
      accepted,
      rejected,
      reviewed,
      pending: 0, // Sera calculé par le composant avec le total
    };
  }, [decisions]);

  /**
   * Vérifie si toutes les modifications ont été reviewées
   */
  const isAllReviewed = useCallback((totalModifications) => {
    return stats.reviewed >= totalModifications;
  }, [stats.reviewed]);

  /**
   * Récupère les décisions pour application finale
   */
  const getDecisionsMap = useCallback(() => {
    return { ...decisions };
  }, [decisions]);

  /**
   * Reset toutes les décisions
   */
  const resetDecisions = useCallback(() => {
    setDecisions({});
  }, []);

  return {
    // Actions individuelles
    acceptModification,
    rejectModification,
    toggleDecision,
    getDecision,
    // Actions groupées
    acceptAll,
    rejectAll,
    acceptAllInSection,
    rejectAllInSection,
    // Stats et état
    stats,
    isAllReviewed,
    getDecisionsMap,
    resetDecisions,
    decisions,
  };
}

export default useModificationReview;
