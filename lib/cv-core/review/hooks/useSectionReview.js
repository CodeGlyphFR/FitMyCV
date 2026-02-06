"use client";
/**
 * Factory générique pour créer des hooks de review par section
 *
 * Ce module fournit la logique commune à tous les hooks de section :
 * - Chargement des changements depuis l'API (filtré par section)
 * - Actions accept/reject avec mise à jour optimiste
 * - Synchronisation inter-sections via événements
 * - Pas de router.refresh() - mises à jour locales seulement
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  useReviewContext,
  REVIEW_EVENTS,
  shouldRefreshForSection,
} from "./useReviewContext";

/**
 * Hook factory pour créer un hook de review pour une section spécifique
 *
 * @param {Object} options - Configuration du hook
 * @param {string} options.section - Nom de la section (summary, skills, experience, etc.)
 * @param {string} [options.field] - Champ optionnel pour filtrer (hard_skills, soft_skills, etc.)
 * @param {number} [options.expIndex] - Index d'expérience optionnel
 * @returns {Object} Hook state et actions
 */
export function useSectionReview({ section, field, expIndex }) {
  const { filename, isLatestVersion, broadcastUpdate } = useReviewContext();

  // État local de la section
  const [changes, setChanges] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Ref pour éviter les race conditions
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  // Cleanup au démontage
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Charger les changements de cette section depuis l'API
   */
  const loadChanges = useCallback(async () => {
    if (!filename || loadingRef.current) return;

    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Construire l'URL avec les filtres
      const params = new URLSearchParams({
        file: filename,
        section,
      });
      if (field) params.set("field", field);
      if (expIndex !== undefined) params.set("expIndex", expIndex.toString());

      const response = await fetch(`/api/cvs/changes?${params}`);

      if (!mountedRef.current) return;

      if (response.ok) {
        const data = await response.json();
        setChanges(data.pendingChanges || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to load changes");
      }
    } catch (err) {
      if (mountedRef.current) {
        console.error(`[useSectionReview:${section}] Error loading changes:`, err);
        setError(err.message);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
      loadingRef.current = false;
    }
  }, [filename, section, field, expIndex]);

  /**
   * Accepter un changement avec mise à jour optimiste
   */
  const accept = useCallback(
    async (changeId) => {
      if (!filename || !changeId || isProcessing) return { success: false };

      setIsProcessing(true);

      // Mise à jour optimiste : retirer le changement immédiatement
      const previousChanges = changes;
      setChanges((prev) => prev.filter((c) => c.id !== changeId));

      try {
        const response = await fetch("/api/cvs/changes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename,
            changeId,
            action: "accept",
            section, // Informer l'API de la section pour retourner seulement ses changements
          }),
        });

        if (!mountedRef.current) return { success: false };

        if (response.ok) {
          const result = await response.json();

          // Filtrer les changements retournés pour cette section uniquement
          const sectionChanges = filterChangesForSection(
            result.updatedChanges || [],
            section,
            field,
            expIndex
          );
          setChanges(sectionChanges);

          // Notifier les autres sections si nécessaire
          broadcastUpdate(section);

          return { success: true, ...result };
        }

        // Rollback si erreur
        setChanges(previousChanges);
        return { success: false };
      } catch (err) {
        if (mountedRef.current) {
          console.error(`[useSectionReview:${section}] Accept error:`, err);
          setChanges(previousChanges);
        }
        return { success: false };
      } finally {
        if (mountedRef.current) {
          setIsProcessing(false);
        }
      }
    },
    [filename, changes, isProcessing, section, field, expIndex, broadcastUpdate]
  );

  /**
   * Rejeter un changement avec mise à jour optimiste
   */
  const reject = useCallback(
    async (changeId) => {
      if (!filename || !changeId || isProcessing) return { success: false };

      setIsProcessing(true);

      // Mise à jour optimiste
      const previousChanges = changes;
      setChanges((prev) => prev.filter((c) => c.id !== changeId));

      try {
        const response = await fetch("/api/cvs/changes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename,
            changeId,
            action: "reject",
            section,
          }),
        });

        if (!mountedRef.current) return { success: false };

        if (response.ok) {
          const result = await response.json();

          const sectionChanges = filterChangesForSection(
            result.updatedChanges || [],
            section,
            field,
            expIndex
          );
          setChanges(sectionChanges);

          // Notifier les autres sections
          broadcastUpdate(section);

          return { success: true, ...result };
        }

        setChanges(previousChanges);
        return { success: false };
      } catch (err) {
        if (mountedRef.current) {
          console.error(`[useSectionReview:${section}] Reject error:`, err);
          setChanges(previousChanges);
        }
        return { success: false };
      } finally {
        if (mountedRef.current) {
          setIsProcessing(false);
        }
      }
    },
    [filename, changes, isProcessing, section, field, expIndex, broadcastUpdate]
  );

  /**
   * Accepter tous les changements de la section
   */
  const acceptAll = useCallback(async () => {
    if (!filename || isProcessing || changes.length === 0) {
      return { success: false };
    }

    const changeIds = changes.map((c) => c.id);
    setIsProcessing(true);

    // Mise à jour optimiste
    const previousChanges = changes;
    setChanges([]);

    try {
      const response = await fetch("/api/cvs/changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename,
          changeIds,
          action: "accept",
          section,
        }),
      });

      if (!mountedRef.current) return { success: false };

      if (response.ok) {
        const result = await response.json();

        const sectionChanges = filterChangesForSection(
          result.updatedChanges || [],
          section,
          field,
          expIndex
        );
        setChanges(sectionChanges);

        broadcastUpdate(section);

        return { success: true, ...result };
      }

      setChanges(previousChanges);
      return { success: false };
    } catch (err) {
      if (mountedRef.current) {
        console.error(`[useSectionReview:${section}] AcceptAll error:`, err);
        setChanges(previousChanges);
      }
      return { success: false };
    } finally {
      if (mountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [filename, changes, isProcessing, section, field, expIndex, broadcastUpdate]);

  /**
   * Rejeter tous les changements de la section
   */
  const rejectAll = useCallback(async () => {
    if (!filename || isProcessing || changes.length === 0) {
      return { success: false };
    }

    const changeIds = changes.map((c) => c.id);
    setIsProcessing(true);

    const previousChanges = changes;
    setChanges([]);

    try {
      const response = await fetch("/api/cvs/changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename,
          changeIds,
          action: "reject",
          section,
        }),
      });

      if (!mountedRef.current) return { success: false };

      if (response.ok) {
        const result = await response.json();

        const sectionChanges = filterChangesForSection(
          result.updatedChanges || [],
          section,
          field,
          expIndex
        );
        setChanges(sectionChanges);

        broadcastUpdate(section);

        return { success: true, ...result };
      }

      setChanges(previousChanges);
      return { success: false };
    } catch (err) {
      if (mountedRef.current) {
        console.error(`[useSectionReview:${section}] RejectAll error:`, err);
        setChanges(previousChanges);
      }
      return { success: false };
    } finally {
      if (mountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [filename, changes, isProcessing, section, field, expIndex, broadcastUpdate]);

  /**
   * Écouter les mises à jour d'autres sections
   */
  useEffect(() => {
    const handleSectionUpdate = (event) => {
      const { section: changedSection, filename: changedFilename } =
        event.detail || {};

      // Ignorer si pas le même fichier ou si c'est ma propre section
      if (changedFilename !== filename || changedSection === section) return;

      // Vérifier si je dois me rafraîchir
      if (shouldRefreshForSection(section, changedSection)) {
        console.log(
          `[useSectionReview:${section}] Refreshing due to ${changedSection} update`
        );
        loadChanges();
      }
    };

    window.addEventListener(REVIEW_EVENTS.SECTION_UPDATED, handleSectionUpdate);
    return () => {
      window.removeEventListener(
        REVIEW_EVENTS.SECTION_UPDATED,
        handleSectionUpdate
      );
    };
  }, [filename, section, loadChanges]);

  /**
   * Chargement initial des changements
   */
  useEffect(() => {
    if (filename && isLatestVersion) {
      loadChanges();
    }
  }, [filename, isLatestVersion, loadChanges]);

  // Données dérivées
  const hasChanges = changes.length > 0;
  const pendingCount = changes.filter((c) => c.status === "pending").length;

  // Filtrer par type de changement
  const addedItems = changes.filter(
    (c) => c.changeType === "added" || c.changeType === "move_to_projects"
  );
  const modifiedItems = changes.filter(
    (c) => c.changeType === "modified" || c.changeType === "level_adjusted"
  );
  const removedItems = changes.filter(
    (c) => c.changeType === "removed" || c.changeType === "experience_removed"
  );

  return {
    // État
    changes,
    isLoading,
    isProcessing,
    error,
    hasChanges,
    pendingCount,

    // Changements par type
    addedItems,
    modifiedItems,
    removedItems,

    // Actions
    accept,
    reject,
    acceptAll,
    rejectAll,
    refresh: loadChanges,
  };
}

/**
 * Filtrer les changements pour une section spécifique
 *
 * @param {Array} allChanges - Tous les changements
 * @param {string} section - Section cible
 * @param {string} [field] - Champ optionnel
 * @param {number} [expIndex] - Index d'expérience optionnel
 * @returns {Array} Changements filtrés
 */
function filterChangesForSection(allChanges, section, field, expIndex) {
  if (!allChanges || !Array.isArray(allChanges)) return [];

  return allChanges.filter((c) => {
    if (c.section !== section) return false;
    if (c.status !== "pending") return false;
    if (field && c.field !== field) return false;
    if (expIndex !== undefined && c.expIndex !== undefined && c.expIndex !== expIndex) {
      return false;
    }
    return true;
  });
}

/**
 * Hook pour trouver un changement spécifique par section/field/itemName
 */
export function useFindSectionChange(section, field, itemName, expIndex) {
  const { changes, isLatestVersion } = useSectionReview({ section, field, expIndex });

  const change = changes.find((c) => {
    if (c.section !== section || c.field !== field) return false;
    if (itemName && c.itemName?.toLowerCase() !== itemName?.toLowerCase()) return false;
    return true;
  });

  return {
    change,
    isPending: change?.status === "pending",
    shouldHighlight: isLatestVersion && change?.status === "pending",
  };
}
