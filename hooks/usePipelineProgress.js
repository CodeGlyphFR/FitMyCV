"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Hook pour suivre la progression du pipeline CV v2 via SSE
 *
 * Écoute les événements SSE:
 * - cv_generation_v2:offer_progress - Progression par étape
 * - cv_generation_v2:offer_completed - Offre terminée
 * - cv_generation_v2:offer_failed - Offre échouée
 * - cv_generation_v2:completed - Tâche terminée
 *
 * @returns {Object} { getProgress, allProgress }
 */
export function usePipelineProgress() {
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';

  // Map des progressions par taskId
  const [progressMap, setProgressMap] = useState({});
  const eventSourceRef = useRef(null);

  // Mise à jour de la progression pour une tâche
  const updateProgress = useCallback((taskId, update) => {
    setProgressMap(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        ...update,
        lastUpdate: Date.now(),
      },
    }));
  }, []);

  // Marquer une étape comme terminée
  const markStepCompleted = useCallback((taskId, step) => {
    setProgressMap(prev => {
      const current = prev[taskId] || {};
      const completedSteps = { ...(current.completedSteps || {}) };
      completedSteps[step] = true;

      return {
        ...prev,
        [taskId]: {
          ...current,
          completedSteps,
          lastUpdate: Date.now(),
        },
      };
    });
  }, []);

  // Connexion au SSE
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    // Utiliser la même connexion EventSource que useRealtimeSync
    // en écoutant les événements spécifiques au pipeline
    const eventSource = new EventSource('/api/events/stream');
    eventSourceRef.current = eventSource;

    // Événement de progression
    eventSource.addEventListener('cv_generation_v2:offer_progress', (event) => {
      try {
        const data = JSON.parse(event.data);
        const { taskId, offerId, offerIndex, totalOffers, phase, step, status } = data;

        // Si status === 'completed', marquer l'étape comme terminée
        if (status === 'completed') {
          markStepCompleted(taskId, step);
        }

        // Mettre à jour la progression courante
        updateProgress(taskId, {
          currentOffer: offerIndex,
          totalOffers,
          currentPhase: phase,
          currentStep: step,
          status: 'running',
        });
      } catch (err) {
        console.error('[usePipelineProgress] Erreur parsing offer_progress:', err);
      }
    });

    // Événement offre terminée
    eventSource.addEventListener('cv_generation_v2:offer_completed', (event) => {
      try {
        const data = JSON.parse(event.data);
        const { taskId, offerId, offerIndex, generatedCvFileId, generatedCvFileName } = data;

        setProgressMap(prev => {
          const current = prev[taskId] || {};
          const completedOffers = [...(current.completedOffers || [])];
          completedOffers.push({ id: offerId, offerIndex, cvFileId: generatedCvFileId, cvFileName: generatedCvFileName });

          // Marquer toutes les étapes comme terminées pour cette offre
          const completedSteps = {
            classify: true,
            experiences: true,
            projects: true,
            extras: true,
            skills: true,
            summary: true,
            recompose: true,
          };

          return {
            ...prev,
            [taskId]: {
              ...current,
              completedOffers,
              completedSteps, // Reset pour la prochaine offre
              currentStep: null,
              lastUpdate: Date.now(),
            },
          };
        });
      } catch (err) {
        console.error('[usePipelineProgress] Erreur parsing offer_completed:', err);
      }
    });

    // Événement offre échouée
    eventSource.addEventListener('cv_generation_v2:offer_failed', (event) => {
      try {
        const data = JSON.parse(event.data);
        const { taskId, offerId, offerIndex, error, creditsRefunded } = data;

        setProgressMap(prev => {
          const current = prev[taskId] || {};
          const failedOffers = [...(current.failedOffers || [])];
          failedOffers.push({ id: offerId, offerIndex, error, creditsRefunded });

          return {
            ...prev,
            [taskId]: {
              ...current,
              failedOffers,
              lastUpdate: Date.now(),
            },
          };
        });
      } catch (err) {
        console.error('[usePipelineProgress] Erreur parsing offer_failed:', err);
      }
    });

    // Événement tâche terminée
    eventSource.addEventListener('cv_generation_v2:completed', (event) => {
      try {
        const data = JSON.parse(event.data);
        const { taskId, totalGenerated, totalFailed, creditsRefunded } = data;

        updateProgress(taskId, {
          status: totalFailed === 0 ? 'completed' : (totalGenerated > 0 ? 'partial' : 'failed'),
          totalGenerated,
          totalFailed,
          creditsRefunded,
          currentStep: null,
        });
      } catch (err) {
        console.error('[usePipelineProgress] Erreur parsing completed:', err);
      }
    });

    // Cleanup
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isAuthenticated, updateProgress, markStepCompleted]);

  // Détection des tâches "stale" (pas de SSE depuis 5 minutes)
  // Si une tâche est en "running" mais n'a pas reçu d'événement depuis 5 minutes,
  // on déclenche un rafraîchissement depuis l'API
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const STALE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    const CHECK_INTERVAL_MS = 30 * 1000; // Vérifier toutes les 30 secondes

    const checkStaleTasks = () => {
      const now = Date.now();
      let hasStale = false;

      Object.entries(progressMap).forEach(([taskId, progress]) => {
        // Vérifier si la tâche est en cours et n'a pas reçu de mise à jour depuis 5 minutes
        if (
          progress.status === 'running' &&
          progress.lastUpdate &&
          (now - progress.lastUpdate) > STALE_TIMEOUT_MS
        ) {
          console.log(`[usePipelineProgress] Tâche ${taskId} stale (pas de SSE depuis 5 min), demande de rafraîchissement`);
          hasStale = true;
        }
      });

      // Déclencher un rafraîchissement si des tâches sont stale
      if (hasStale && typeof window !== 'undefined') {
        window.dispatchEvent(new Event('realtime:task:updated'));
      }
    };

    const interval = setInterval(checkStaleTasks, CHECK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [isAuthenticated, progressMap]);

  // Récupérer la progression pour une tâche spécifique
  const getProgress = useCallback((taskId) => {
    return progressMap[taskId] || null;
  }, [progressMap]);

  return {
    getProgress,
    allProgress: progressMap,
  };
}

/**
 * Hook pour écouter la progression d'une tâche spécifique du pipeline CV v2
 *
 * @param {string} taskId - ID de la tâche à suivre
 * @returns {Object|null} Progression de la tâche ou null
 *   - currentOffer: index de l'offre en cours (0-based)
 *   - totalOffers: nombre total d'offres
 *   - currentPhase: phase en cours (classify, batches, recompose)
 *   - currentStep: étape en cours (classify, experiences, projects, extras, skills, summary, recompose)
 *   - completedSteps: map des étapes terminées { classify: true, ... }
 *   - completedOffers: [{ id, offerIndex, cvFileId, cvFileName }]
 *   - failedOffers: [{ id, offerIndex, error, creditsRefunded }]
 *   - status: "running" | "completed" | "partial" | "failed"
 */
export function useSSEPipelineProgress(taskId) {
  const { getProgress } = usePipelineProgress();
  return taskId ? getProgress(taskId) : null;
}
