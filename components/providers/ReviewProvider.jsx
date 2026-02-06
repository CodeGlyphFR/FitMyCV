"use client";
/**
 * ReviewProvider - Provider complet pour le système de review par section
 *
 * Ce Provider fournit :
 * - Le contexte partagé entre les sections (filename, contentVersion, isLatestVersion)
 * - La gestion des versions (versions, currentVersion, selectVersion, restoreVersion)
 * - Les changements globaux (pendingChanges pour GlobalReviewActions)
 * - Les actions batch (acceptChange, rejectChange, acceptAllChanges, rejectAllChanges)
 * - La synchronisation inter-sections via événements (broadcastUpdate)
 *
 * L'état des changements détaillés est géré localement par chaque hook de section,
 * mais les données globales (versions, actions batch) sont disponibles ici.
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";
import {
  ReviewContext,
  REVIEW_EVENTS,
} from "@/lib/cv-core/review/hooks/useReviewContext";
import { emitOnboardingEvent, ONBOARDING_EVENTS } from "@/lib/onboarding/onboardingEvents";

/**
 * ReviewProvider - Contexte complet pour la review par section
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Composants enfants
 * @param {string} props.filename - Nom du fichier CV
 * @param {number} [props.contentVersion=1] - Version du contenu
 * @param {string|number} [props.initialVersion='latest'] - Version initiale à afficher
 * @param {Object} [props.cv] - Données du CV (pour legacy changesMade)
 */
export function ReviewProvider({
  children,
  filename,
  contentVersion = 1,
  initialVersion = "latest",
  cv,
}) {
  const router = useRouter();

  // État legacy (pour rétrocompatibilité avec changesMade)
  const [changesMade, setChangesMade] = useState([]);

  // Nouveau système de review
  const [pendingChanges, setPendingChanges] = useState([]);
  const [versions, setVersions] = useState([]);
  const [currentVersion, setCurrentVersion] = useState(initialVersion);
  const [previousContent, setPreviousContent] = useState(null);
  const [pendingSourceVersion, setPendingSourceVersion] = useState(null);
  const [reviewProgress, setReviewProgress] = useState({
    total: 0,
    reviewed: 0,
    pending: 0,
    percentComplete: 100,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProcessingExpIndex, setBatchProcessingExpIndex] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  // Raisons des skills "kept" (pour bouton info)
  const [keptSkillReasons, setKeptSkillReasons] = useState({});

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
      const response = await fetch(
        `/api/cvs/changes?file=${encodeURIComponent(filename)}`
      );
      if (response.ok) {
        const data = await response.json();
        setPendingChanges(data.pendingChanges || []);
        setPendingSourceVersion(data.pendingSourceVersion);
        setReviewProgress(
          data.progress || {
            total: 0,
            reviewed: 0,
            pending: 0,
            percentComplete: 100,
          }
        );
        // Stocker les raisons des skills "kept"
        setKeptSkillReasons(data.keptSkillReasons || {});
      }
    } catch (error) {
      console.error("[ReviewProvider] Error fetching review state:", error);
    } finally {
      setIsLoading(false);
    }
  }, [filename]);

  // Charger les versions depuis l'API
  const loadVersions = useCallback(async () => {
    if (!filename) return;

    try {
      const response = await fetch(
        `/api/cvs/versions?file=${encodeURIComponent(filename)}`
      );
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
      }
    } catch (error) {
      console.error("[ReviewProvider] Error fetching versions:", error);
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
        (task.type === "improve-cv" || task.type === "generate-cv") &&
        task.status === "completed" &&
        task.cvFile === filename;

      if (isRelevantTask) {
        console.log(
          `[ReviewProvider] Task ${task.type} completed for ${filename}, refreshing...`
        );
        // Rafraîchir l'état de review et les versions
        refreshReviewState();
        loadVersions();
        // Rafraîchir le Server Component pour mettre à jour le CV affiché
        router.refresh();
      }
    };

    window.addEventListener("task:completed", handleTaskCompleted);
    return () => window.removeEventListener("task:completed", handleTaskCompleted);
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
        console.error("[ReviewProvider] Error fetching previous version:", error);
      }
    };

    loadPreviousContent();
  }, [filename, pendingSourceVersion]);

  // Sélectionner une version - naviguer avec le paramètre URL pour recharger le Server Component
  const selectVersion = useCallback(
    (version) => {
      setCurrentVersion(version);

      // Construire l'URL avec ou sans le paramètre version
      const url = new URL(window.location.href);
      if (version === "latest") {
        url.searchParams.delete("version");
      } else {
        url.searchParams.set("version", version.toString());
      }

      // Naviguer vers la nouvelle URL (refresh du Server Component)
      router.push(url.pathname + url.search);
    },
    [router]
  );

  // Accepter un changement
  // skipRefresh: true pour les opérations batch (évite les multiples refreshs)
  const acceptChange = useCallback(
    async (changeId, { skipRefresh = false } = {}) => {
      if (!filename || !changeId) return { success: false };

      try {
        const response = await fetch("/api/cvs/changes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename, changeId, action: "accept" }),
        });

        if (response.ok) {
          const result = await response.json();
          setPendingChanges(result.updatedChanges || []);
          setReviewProgress(
            result.progress || {
              total: 0,
              reviewed: 0,
              pending: 0,
              percentComplete: 100,
            }
          );

          // Si tous les changements sont reviewés, vider l'état
          if (result.allReviewed) {
            setPendingSourceVersion(null);
            setPreviousContent(null);
            emitOnboardingEvent(ONBOARDING_EVENTS.ALL_REVIEWS_COMPLETED);
          }

          // Rafraîchir les données du Server Component APRÈS un micro-tick
          // pour s'assurer que le state React est bien appliqué avant le refresh
          if (!skipRefresh) {
            await Promise.resolve();
            router.refresh();
          }

          return result;
        }

        return { success: false };
      } catch (error) {
        console.error("[ReviewProvider] Error accepting change:", error);
        return { success: false };
      }
    },
    [filename, router]
  );

  // Rejeter un changement (rollback)
  // skipRefresh: true pour les opérations batch (évite les multiples refreshs)
  const rejectChange = useCallback(
    async (changeId, { skipRefresh = false } = {}) => {
      if (!filename || !changeId) return { success: false };

      try {
        const response = await fetch("/api/cvs/changes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename, changeId, action: "reject" }),
        });

        if (response.ok) {
          const result = await response.json();

          // Mettre à jour le state immédiatement
          setPendingChanges(result.updatedChanges || []);
          setReviewProgress(
            result.progress || {
              total: 0,
              reviewed: 0,
              pending: 0,
              percentComplete: 100,
            }
          );

          // Si tous les changements sont reviewés, vider l'état
          if (result.allReviewed) {
            setPendingSourceVersion(null);
            setPreviousContent(null);
            emitOnboardingEvent(ONBOARDING_EVENTS.ALL_REVIEWS_COMPLETED);
          }

          // Rafraîchir les données du Server Component APRÈS un micro-tick
          // pour s'assurer que le state React est bien appliqué avant le refresh
          if (!skipRefresh) {
            await Promise.resolve();
            router.refresh();
          }

          return result;
        }

        return { success: false };
      } catch (error) {
        console.error("[ReviewProvider] Error rejecting change:", error);
        return { success: false };
      }
    },
    [filename, router]
  );

  // Accepter plusieurs changements d'un coup (batch - une seule requête API)
  // expIndex: optionnel, pour flouter l'expérience concernée pendant le traitement
  const acceptAllChanges = useCallback(
    async (changeIds, { expIndex } = {}) => {
      if (!filename || !changeIds?.length) return { success: false };

      setIsBatchProcessing(true);
      if (expIndex !== undefined) {
        setBatchProcessingExpIndex(expIndex);
      }

      try {
        // Une seule requête API pour tous les changements
        const response = await fetch("/api/cvs/changes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename, changeIds, action: "accept" }),
        });

        if (response.ok) {
          const result = await response.json();
          setPendingChanges(result.updatedChanges || []);
          setReviewProgress(
            result.progress || {
              total: 0,
              reviewed: 0,
              pending: 0,
              percentComplete: 100,
            }
          );

          // Si tous les changements sont reviewés, vider l'état
          if (result.allReviewed) {
            setPendingSourceVersion(null);
            setPreviousContent(null);
            emitOnboardingEvent(ONBOARDING_EVENTS.ALL_REVIEWS_COMPLETED);
          }

          // Rafraîchir le Server Component
          router.refresh();

          return { success: true, ...result };
        }

        return { success: false };
      } catch (error) {
        console.error("[ReviewProvider] Error in batch accept:", error);
        return { success: false };
      } finally {
        setIsBatchProcessing(false);
        setBatchProcessingExpIndex(null);
      }
    },
    [filename, router]
  );

  // Rejeter plusieurs changements d'un coup (batch - une seule requête API)
  // expIndex: optionnel, pour flouter l'expérience concernée pendant le traitement
  const rejectAllChanges = useCallback(
    async (changeIds, { expIndex } = {}) => {
      if (!filename || !changeIds?.length) return { success: false };

      setIsBatchProcessing(true);
      if (expIndex !== undefined) {
        setBatchProcessingExpIndex(expIndex);
      }

      try {
        // Une seule requête API pour tous les changements
        const response = await fetch("/api/cvs/changes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename, changeIds, action: "reject" }),
        });

        if (response.ok) {
          const result = await response.json();
          setPendingChanges(result.updatedChanges || []);
          setReviewProgress(
            result.progress || {
              total: 0,
              reviewed: 0,
              pending: 0,
              percentComplete: 100,
            }
          );

          // Si tous les changements sont reviewés, vider l'état
          if (result.allReviewed) {
            setPendingSourceVersion(null);
            setPreviousContent(null);
            emitOnboardingEvent(ONBOARDING_EVENTS.ALL_REVIEWS_COMPLETED);
          }

          // Rafraîchir le Server Component
          router.refresh();

          return { success: true, ...result };
        }

        return { success: false };
      } catch (error) {
        console.error("[ReviewProvider] Error in batch reject:", error);
        return { success: false };
      } finally {
        setIsBatchProcessing(false);
        setBatchProcessingExpIndex(null);
      }
    },
    [filename, router]
  );

  // Restaurer une version antérieure (destructif)
  const restoreVersion = useCallback(
    async (targetVersion) => {
      if (!filename || !targetVersion || isRestoring) return { success: false };

      setIsRestoring(true);
      try {
        const response = await fetch("/api/cvs/versions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename,
            version: targetVersion,
            action: "restore",
          }),
        });

        if (response.ok) {
          // Réinitialiser l'état local
          setPendingChanges([]);
          setPendingSourceVersion(null);
          setPreviousContent(null);
          setCurrentVersion("latest");

          // Rafraîchir les versions et le contenu
          await loadVersions();
          router.refresh();

          // Rediriger vers la version "latest" (sans paramètre URL)
          const url = new URL(window.location.href);
          url.searchParams.delete("version");
          router.push(url.pathname + url.search);

          return { success: true };
        }

        return { success: false };
      } catch (error) {
        console.error("[ReviewProvider] Error restoring version:", error);
        return { success: false };
      } finally {
        setIsRestoring(false);
      }
    },
    [filename, router, loadVersions, isRestoring]
  );

  /**
   * Broadcast une mise à jour aux autres sections
   * Utilisé pour la synchronisation inter-sections (ex: move_to_projects)
   *
   * @param {string} sourceSection - La section qui a émis la mise à jour
   */
  const broadcastUpdate = useCallback(
    (sourceSection) => {
      if (typeof window === "undefined") return;

      window.dispatchEvent(
        new CustomEvent(REVIEW_EVENTS.SECTION_UPDATED, {
          detail: {
            section: sourceSection,
            filename,
            timestamp: Date.now(),
          },
        })
      );

      console.log(
        `[ReviewProvider] Broadcast update from section: ${sourceSection}`
      );
    },
    [filename]
  );

  // Calculer les valeurs dérivées
  const isLatestVersion = currentVersion === "latest";
  const hasUnreviewedChanges = pendingChanges.some(
    (c) => c.status === "pending"
  );
  const isImprovedCv = !!cv?.meta?.improved_from;

  // Mémoiser la valeur du contexte pour éviter les re-renders inutiles
  const contextValue = useMemo(
    () => ({
      // Contexte de base (pour les hooks de section)
      filename,
      contentVersion,
      isLatestVersion,
      broadcastUpdate,

      // Legacy (rétrocompatibilité)
      changesMade,
      isImprovedCv,

      // Nouveau système - État
      pendingChanges,
      versions,
      currentVersion,
      previousContent,
      hasUnreviewedChanges,
      reviewProgress,
      isLoading,
      isBatchProcessing,
      batchProcessingExpIndex,
      isRestoring,
      keptSkillReasons,

      // Nouveau système - Actions
      acceptChange,
      rejectChange,
      acceptAllChanges,
      rejectAllChanges,
      selectVersion,
      restoreVersion,
      refreshReviewState,
    }),
    [
      filename,
      contentVersion,
      isLatestVersion,
      broadcastUpdate,
      changesMade,
      isImprovedCv,
      pendingChanges,
      versions,
      currentVersion,
      previousContent,
      hasUnreviewedChanges,
      reviewProgress,
      isLoading,
      isBatchProcessing,
      batchProcessingExpIndex,
      isRestoring,
      keptSkillReasons,
      acceptChange,
      rejectChange,
      acceptAllChanges,
      rejectAllChanges,
      selectVersion,
      restoreVersion,
      refreshReviewState,
    ]
  );

  return (
    <ReviewContext.Provider value={contextValue}>
      {children}
    </ReviewContext.Provider>
  );
}

/**
 * Hook pour accéder au contexte de review complet
 * Compatible avec l'ancien useHighlight() de HighlightProvider
 */
export function useReview() {
  const context = useContext(ReviewContext);
  if (!context) {
    console.warn("[useReview] Used outside of ReviewProvider");
    return {
      // Contexte de base
      filename: null,
      contentVersion: 1,
      isLatestVersion: true,
      broadcastUpdate: () => {},

      // Legacy
      changesMade: [],
      isImprovedCv: false,

      // Nouveau système
      pendingChanges: [],
      versions: [],
      currentVersion: "latest",
      previousContent: null,
      hasUnreviewedChanges: false,
      reviewProgress: { total: 0, reviewed: 0, pending: 0, percentComplete: 100 },
      isLoading: false,
      isBatchProcessing: false,
      batchProcessingExpIndex: null,
      isRestoring: false,
      keptSkillReasons: {},

      // Actions (no-op)
      acceptChange: async () => ({ success: false }),
      rejectChange: async () => ({ success: false }),
      acceptAllChanges: async () => ({ success: false }),
      rejectAllChanges: async () => ({ success: false }),
      selectVersion: () => {},
      restoreVersion: async () => ({ success: false }),
      refreshReviewState: async () => {},
    };
  }
  return context;
}

/**
 * Alias pour la rétrocompatibilité avec useHighlight()
 * @deprecated Utilisez useReview() à la place
 */
export const useHighlight = useReview;

export default ReviewProvider;
