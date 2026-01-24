"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const HighlightContext = createContext({
  // État des changements (legacy)
  changesMade: [],
  isImprovedCv: false,

  // Nouveau système de review
  pendingChanges: [],
  versions: [],
  currentVersion: 'latest',
  contentVersion: 1,
  previousContent: null,
  isLatestVersion: true,
  hasUnreviewedChanges: false,
  reviewProgress: { total: 0, reviewed: 0, pending: 0, percentComplete: 100 },
  isLoading: false,
  isBatchProcessing: false,
  batchProcessingExpIndex: null, // Index de l'expérience en cours de traitement batch
  isRestoring: false,

  // Actions
  acceptChange: async () => {},
  rejectChange: async () => {},
  acceptAllChanges: async () => {},
  rejectAllChanges: async () => {},
  selectVersion: () => {},
  restoreVersion: async () => {},
  refreshReviewState: async () => {},
});

export function HighlightProvider({ children, cv, filename, initialVersion = 'latest', contentVersion = 1 }) {
  const router = useRouter();

  // État legacy
  const [changesMade, setChangesMade] = useState([]);

  // Nouveau système de review
  const [pendingChanges, setPendingChanges] = useState([]);
  const [versions, setVersions] = useState([]);
  const [currentVersion, setCurrentVersion] = useState(initialVersion);
  const [previousContent, setPreviousContent] = useState(null);
  const [pendingSourceVersion, setPendingSourceVersion] = useState(null);
  const [reviewProgress, setReviewProgress] = useState({
    total: 0, reviewed: 0, pending: 0, percentComplete: 100
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProcessingExpIndex, setBatchProcessingExpIndex] = useState(null);

  // Charger les changements legacy depuis meta
  useEffect(() => {
    if (cv?.meta?.changes_made) {
      setChangesMade(cv.meta.changes_made);
    } else {
      setChangesMade([]);
    }
  }, [cv]);

  // Charger l'état de review depuis l'API
  const refreshReviewState = useCallback(async () => {
    if (!filename) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/cvs/changes?file=${encodeURIComponent(filename)}`);
      if (response.ok) {
        const data = await response.json();
        setPendingChanges(data.pendingChanges || []);
        setPendingSourceVersion(data.pendingSourceVersion);
        setReviewProgress(data.progress || {
          total: 0, reviewed: 0, pending: 0, percentComplete: 100
        });
      }
    } catch (error) {
      console.error('[HighlightProvider] Error fetching review state:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filename]);

  // Charger les versions depuis l'API
  const loadVersions = useCallback(async () => {
    if (!filename) return;

    try {
      const response = await fetch(`/api/cvs/versions?file=${encodeURIComponent(filename)}`);
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
      }
    } catch (error) {
      console.error('[HighlightProvider] Error fetching versions:', error);
    }
  }, [filename]);

  // Chargement initial
  useEffect(() => {
    refreshReviewState();
    loadVersions();
  }, [refreshReviewState, loadVersions]);

  // Écouter la fin des tâches d'optimisation/génération pour rafraîchir automatiquement
  useEffect(() => {
    const handleTaskCompleted = (event) => {
      const task = event.detail?.task;
      if (!task || !filename) return;

      // Vérifier si c'est une tâche d'optimisation ou génération pour ce CV
      const isRelevantTask =
        (task.type === 'improve-cv' || task.type === 'generate-cv') &&
        task.status === 'completed' &&
        task.cvFile === filename;

      if (isRelevantTask) {
        console.log(`[HighlightProvider] Task ${task.type} completed for ${filename}, refreshing...`);
        // Rafraîchir l'état de review et les versions
        refreshReviewState();
        loadVersions();
        // Rafraîchir le Server Component pour mettre à jour le CV affiché
        router.refresh();
      }
    };

    window.addEventListener('task:completed', handleTaskCompleted);
    return () => window.removeEventListener('task:completed', handleTaskCompleted);
  }, [filename, refreshReviewState, loadVersions, router]);

  // Charger le contenu d'une version précédente pour comparaison
  useEffect(() => {
    const loadPreviousContent = async () => {
      if (!filename || pendingSourceVersion === null) {
        setPreviousContent(null);
        return;
      }

      try {
        const response = await fetch(
          `/api/cvs/versions?file=${encodeURIComponent(filename)}&version=${pendingSourceVersion}`
        );
        if (response.ok) {
          const data = await response.json();
          setPreviousContent(data.content);
        }
      } catch (error) {
        console.error('[HighlightProvider] Error fetching previous version:', error);
      }
    };

    loadPreviousContent();
  }, [filename, pendingSourceVersion]);

  // Sélectionner une version - naviguer avec le paramètre URL pour recharger le Server Component
  const selectVersion = useCallback((version) => {
    setCurrentVersion(version);

    // Construire l'URL avec ou sans le paramètre version
    const url = new URL(window.location.href);
    if (version === 'latest') {
      url.searchParams.delete('version');
    } else {
      url.searchParams.set('version', version.toString());
    }

    // Naviguer vers la nouvelle URL (refresh du Server Component)
    router.push(url.pathname + url.search);
  }, [router]);

  // Accepter un changement
  // skipRefresh: true pour les opérations batch (évite les multiples refreshs)
  const acceptChange = useCallback(async (changeId, { skipRefresh = false } = {}) => {
    if (!filename || !changeId) return { success: false };

    try {
      const response = await fetch('/api/cvs/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, changeId, action: 'accept' }),
      });

      if (response.ok) {
        const result = await response.json();
        setPendingChanges(result.updatedChanges || []);
        setReviewProgress(result.progress || {
          total: 0, reviewed: 0, pending: 0, percentComplete: 100
        });

        // Si tous les changements sont reviewés, vider l'état
        if (result.allReviewed) {
          setPendingSourceVersion(null);
          setPreviousContent(null);
        }

        // Rafraîchir les données du Server Component (sauf si batch)
        if (!skipRefresh) {
          router.refresh();
        }

        return result;
      }

      return { success: false };
    } catch (error) {
      console.error('[HighlightProvider] Error accepting change:', error);
      return { success: false };
    }
  }, [filename, router]);

  // Rejeter un changement (rollback)
  // skipRefresh: true pour les opérations batch (évite les multiples refreshs)
  const rejectChange = useCallback(async (changeId, { skipRefresh = false } = {}) => {
    if (!filename || !changeId) return { success: false };

    try {
      const response = await fetch('/api/cvs/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, changeId, action: 'reject' }),
      });

      if (response.ok) {
        const result = await response.json();

        // Mettre à jour le state immédiatement
        setPendingChanges(result.updatedChanges || []);
        setReviewProgress(result.progress || {
          total: 0, reviewed: 0, pending: 0, percentComplete: 100
        });

        // Si tous les changements sont reviewés, vider l'état
        if (result.allReviewed) {
          setPendingSourceVersion(null);
          setPreviousContent(null);
        }

        // Rafraîchir les données du Server Component
        if (!skipRefresh) {
          router.refresh();
        }

        return result;
      }

      return { success: false };
    } catch (error) {
      console.error('[HighlightProvider] Error rejecting change:', error);
      return { success: false };
    }
  }, [filename, router]);

  // Accepter plusieurs changements d'un coup (batch - une seule requête API)
  // expIndex: optionnel, pour flouter l'expérience concernée pendant le traitement
  const acceptAllChanges = useCallback(async (changeIds, { expIndex } = {}) => {
    if (!filename || !changeIds?.length) return { success: false };

    setIsBatchProcessing(true);
    if (expIndex !== undefined) {
      setBatchProcessingExpIndex(expIndex);
    }

    try {
      // Une seule requête API pour tous les changements
      const response = await fetch('/api/cvs/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, changeIds, action: 'accept' }),
      });

      if (response.ok) {
        const result = await response.json();
        setPendingChanges(result.updatedChanges || []);
        setReviewProgress(result.progress || {
          total: 0, reviewed: 0, pending: 0, percentComplete: 100
        });

        // Si tous les changements sont reviewés, vider l'état
        if (result.allReviewed) {
          setPendingSourceVersion(null);
          setPreviousContent(null);
        }

        // Rafraîchir le Server Component
        router.refresh();

        return { success: true, ...result };
      }

      return { success: false };
    } catch (error) {
      console.error('[HighlightProvider] Error in batch accept:', error);
      return { success: false };
    } finally {
      setIsBatchProcessing(false);
      setBatchProcessingExpIndex(null);
    }
  }, [filename, router]);

  // Rejeter plusieurs changements d'un coup (batch - une seule requête API)
  // expIndex: optionnel, pour flouter l'expérience concernée pendant le traitement
  const rejectAllChanges = useCallback(async (changeIds, { expIndex } = {}) => {
    if (!filename || !changeIds?.length) return { success: false };

    setIsBatchProcessing(true);
    if (expIndex !== undefined) {
      setBatchProcessingExpIndex(expIndex);
    }

    try {
      // Une seule requête API pour tous les changements
      const response = await fetch('/api/cvs/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, changeIds, action: 'reject' }),
      });

      if (response.ok) {
        const result = await response.json();
        setPendingChanges(result.updatedChanges || []);
        setReviewProgress(result.progress || {
          total: 0, reviewed: 0, pending: 0, percentComplete: 100
        });

        // Si tous les changements sont reviewés, vider l'état
        if (result.allReviewed) {
          setPendingSourceVersion(null);
          setPreviousContent(null);
        }

        // Rafraîchir le Server Component
        router.refresh();

        return { success: true, ...result };
      }

      return { success: false };
    } catch (error) {
      console.error('[HighlightProvider] Error in batch reject:', error);
      return { success: false };
    } finally {
      setIsBatchProcessing(false);
      setBatchProcessingExpIndex(null);
    }
  }, [filename, router]);

  // Restaurer une version antérieure (destructif)
  const [isRestoring, setIsRestoring] = useState(false);

  const restoreVersion = useCallback(async (targetVersion) => {
    if (!filename || !targetVersion || isRestoring) return { success: false };

    setIsRestoring(true);
    try {
      const response = await fetch('/api/cvs/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          version: targetVersion,
          action: 'restore',
        }),
      });

      if (response.ok) {
        // Réinitialiser l'état local
        setPendingChanges([]);
        setPendingSourceVersion(null);
        setPreviousContent(null);
        setCurrentVersion('latest');

        // Rafraîchir les versions et le contenu
        await loadVersions();
        router.refresh();

        // Rediriger vers la version "latest" (sans paramètre URL)
        const url = new URL(window.location.href);
        url.searchParams.delete('version');
        router.push(url.pathname + url.search);

        return { success: true };
      }

      return { success: false };
    } catch (error) {
      console.error('[HighlightProvider] Error restoring version:', error);
      return { success: false };
    } finally {
      setIsRestoring(false);
    }
  }, [filename, router, loadVersions, isRestoring]);

  // Calculer les valeurs dérivées
  const isLatestVersion = currentVersion === 'latest';
  const hasUnreviewedChanges = pendingChanges.some(c => c.status === 'pending');
  const isImprovedCv = !!cv?.meta?.improved_from;

  const value = {
    // Legacy
    changesMade,
    isImprovedCv,

    // Nouveau système
    pendingChanges,
    versions,
    currentVersion,
    contentVersion,
    previousContent,
    isLatestVersion,
    hasUnreviewedChanges,
    reviewProgress,
    isLoading,
    isBatchProcessing,
    batchProcessingExpIndex,
    isRestoring,

    // Actions
    acceptChange,
    rejectChange,
    acceptAllChanges,
    rejectAllChanges,
    selectVersion,
    restoreVersion,
    refreshReviewState,
  };

  return (
    <HighlightContext.Provider value={value}>
      {children}
    </HighlightContext.Provider>
  );
}

export function useHighlight() {
  const context = useContext(HighlightContext);
  if (!context) {
    throw new Error("useHighlight must be used within HighlightProvider");
  }
  return context;
}