"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Liste des étapes du pipeline CV Generation dans l'ordre
 */
const PIPELINE_STEPS = ['extraction', 'classify', 'experiences', 'projects', 'extras', 'skills', 'summary', 'recompose'];

/**
 * Poids de chaque étape pour le calcul du pourcentage (CV Generation)
 */
const STEP_WEIGHTS = {
  extraction: 10,
  classify: 10,
  experiences: 20,
  projects: 15,
  extras: 10,
  skills: 15,
  summary: 10,
  recompose: 10,
};

/**
 * Liste des étapes du pipeline CV Improvement dans l'ordre
 */
const IMPROVEMENT_STEPS = ['preprocess', 'classify_skills', 'experiences', 'projects', 'summary', 'finalize'];

/**
 * Poids de chaque étape pour le calcul du pourcentage (CV Improvement)
 */
const IMPROVEMENT_STEP_WEIGHTS = {
  preprocess: 15,
  classify_skills: 15,
  experiences: 30,
  projects: 20,
  summary: 10,
  finalize: 10,
};

/**
 * Calcule le pourcentage de progression pour une offre
 * Prend en compte les steps parallèles (runningSteps) pour un calcul précis
 * @param {Object} offerProgress - Progression de l'offre
 * @returns {number} - Pourcentage (0-100)
 */
function calculateOfferProgress(offerProgress) {
  if (!offerProgress) return 0;
  if (offerProgress.status === 'completed') return 100;
  if (offerProgress.status === 'failed' || offerProgress.status === 'cancelled') return 0;

  const { completedSteps = {}, runningSteps = {}, currentStep } = offerProgress;
  let totalWeight = 0;
  let completedWeight = 0;

  PIPELINE_STEPS.forEach(step => {
    totalWeight += STEP_WEIGHTS[step];
    if (completedSteps[step]) {
      completedWeight += STEP_WEIGHTS[step];
    }
  });

  // Ajouter une progression partielle pour les étapes en cours (parallèles)
  // Chaque step dans runningSteps compte pour 50% de son poids
  Object.keys(runningSteps).forEach(step => {
    if (!completedSteps[step] && STEP_WEIGHTS[step]) {
      completedWeight += STEP_WEIGHTS[step] * 0.5;
    }
  });

  // Fallback sur currentStep si runningSteps est vide (rétrocompatibilité)
  if (Object.keys(runningSteps).length === 0 && currentStep && !completedSteps[currentStep]) {
    completedWeight += STEP_WEIGHTS[currentStep] * 0.5;
  }

  return Math.round((completedWeight / totalWeight) * 100);
}

/**
 * Hook pour suivre la progression du pipeline CV via SSE
 *
 * Structure de progression par offre pour une granularité fine.
 *
 * Écoute les événements SSE:
 * - cv_generation:offer_progress - Progression par étape
 * - cv_generation:offer_completed - Offre terminée
 * - cv_generation:offer_failed - Offre échouée
 * - cv_generation:completed - Tâche terminée
 *
 * @returns {Object} { getProgress, getOfferProgress, calculateProgress, allProgress }
 */
export function usePipelineProgress() {
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';

  // Map des progressions par taskId
  const [progressMap, setProgressMap] = useState({});
  const eventSourceRef = useRef(null);

  // Mise à jour de la progression pour une offre spécifique
  const updateOfferProgress = useCallback((taskId, offerId, offerIndex, update) => {
    setProgressMap(prev => {
      const isNewTask = !prev[taskId];
      if (isNewTask && typeof window !== 'undefined') {
        // Nouvelle tâche détectée via SSE (vient d'un autre device/onglet)
        setTimeout(() => window.dispatchEvent(new Event('realtime:task:updated')), 0);
      }

      const task = prev[taskId] || { offers: {}, status: 'running' };
      const offer = task.offers[offerId] || { offerIndex, completedSteps: {}, runningSteps: {} };

      // Gérer les runningSteps pour tracker les steps parallèles
      // On utilise stepStatus (status du step) et non status (status de l'offre)
      let newRunningSteps = { ...offer.runningSteps };
      const stepStatus = update.stepStatus || update.status; // Fallback pour rétrocompatibilité
      if (update.currentStep && stepStatus === 'running') {
        newRunningSteps[update.currentStep] = {
          currentItem: update.currentItem ?? null,
          totalItems: update.totalItems ?? null,
        };
      }

      return {
        ...prev,
        [taskId]: {
          ...task,
          offers: {
            ...task.offers,
            [offerId]: {
              ...offer,
              ...update,
              runningSteps: newRunningSteps,
            },
          },
          lastUpdate: Date.now(),
        },
      };
    });
  }, []);

  // Marquer une étape comme terminée pour une offre
  const markStepCompleted = useCallback((taskId, offerId, step) => {
    setProgressMap(prev => {
      const task = prev[taskId] || { offers: {} };
      const offer = task.offers[offerId] || { completedSteps: {}, runningSteps: {} };

      // Ajouter aux completedSteps
      const completedSteps = { ...offer.completedSteps, [step]: true };

      // Retirer des runningSteps (le step n'est plus en cours)
      const runningSteps = { ...offer.runningSteps };
      delete runningSteps[step];

      return {
        ...prev,
        [taskId]: {
          ...task,
          offers: {
            ...task.offers,
            [offerId]: {
              ...offer,
              completedSteps,
              runningSteps,
            },
          },
          lastUpdate: Date.now(),
        },
      };
    });
  }, []);

  // Mise à jour globale de la tâche
  const updateTaskProgress = useCallback((taskId, update) => {
    setProgressMap(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        ...update,
        lastUpdate: Date.now(),
      },
    }));
  }, []);

  // Connexion au SSE avec reconnexion automatique
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const BASE_RECONNECT_DELAY = 1000;
    let reconnectTimeout = null;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;

      const eventSource = new EventSource('/api/events/stream');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        reconnectAttempts = 0;
      };

      eventSource.onerror = () => {
        const readyState = eventSource.readyState;

        if (readyState === EventSource.CLOSED) {
          eventSource.close();
          eventSourceRef.current = null;

          if (isMounted && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), 30000);
            reconnectAttempts++;
            console.log(`[usePipelineProgress] SSE reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
            reconnectTimeout = setTimeout(connect, delay);
          }
        }
      };

      // Événement de progression
      eventSource.addEventListener('cv_generation:offer_progress', (event) => {
        try {
          const data = JSON.parse(event.data);
          const {
            taskId,
            offerId,
            offerIndex,
            totalOffers,
            phase,
            step,
            status,
            sourceUrl,
            jobTitle,
            currentItem,
            totalItems,
          } = data;

          if (status === 'completed') {
            markStepCompleted(taskId, offerId, step);
          }

          // Note: Le status dans l'événement SSE est le status du STEP (running/completed),
          // pas le status de l'OFFRE. L'offre reste "running" tant qu'elle n'est pas complètement terminée.
          updateOfferProgress(taskId, offerId, offerIndex, {
            offerIndex,
            sourceUrl: sourceUrl || null,
            jobTitle: jobTitle || null,
            currentPhase: phase,
            currentStep: step,
            currentItem: currentItem ?? null,
            totalItems: totalItems ?? null,
            stepStatus: status || 'running', // Status du step (pour runningSteps)
            status: 'running', // L'offre reste "running" - seul offer_completed change ce status
          });

          updateTaskProgress(taskId, {
            totalOffers,
            status: 'running',
          });
        } catch (err) {
          console.error('[usePipelineProgress] Erreur parsing offer_progress:', err);
        }
      });

      // Événement offre terminée
      eventSource.addEventListener('cv_generation:offer_completed', (event) => {
        try {
          const data = JSON.parse(event.data);
          const { taskId, offerId, offerIndex, generatedCvFileId, generatedCvFileName } = data;

          setProgressMap(prev => {
            const task = prev[taskId] || { offers: {}, completedOffers: [] };
            const completedOffers = [...(task.completedOffers || [])];
            completedOffers.push({
              id: offerId,
              offerIndex,
              cvFileId: generatedCvFileId,
              cvFileName: generatedCvFileName,
            });

            const offer = task.offers[offerId] || {};
            const completedSteps = {};
            PIPELINE_STEPS.forEach(step => {
              completedSteps[step] = true;
            });

            return {
              ...prev,
              [taskId]: {
                ...task,
                offers: {
                  ...task.offers,
                  [offerId]: {
                    ...offer,
                    completedSteps,
                    runningSteps: {}, // Nettoyer les steps en cours
                    currentStep: null,
                    status: 'completed',
                  },
                },
                completedOffers,
                lastUpdate: Date.now(),
              },
            };
          });
        } catch (err) {
          console.error('[usePipelineProgress] Erreur parsing offer_completed:', err);
        }
      });

      // Événement offre échouée ou annulée
      eventSource.addEventListener('cv_generation:offer_failed', (event) => {
        try {
          const data = JSON.parse(event.data);
          const { taskId, offerId, offerIndex, error, creditsRefunded } = data;

          const isCancelled = error === 'Task cancelled' || error?.includes('cancelled');
          const offerStatus = isCancelled ? 'cancelled' : 'failed';

          setProgressMap(prev => {
            const task = prev[taskId] || { offers: {}, failedOffers: [] };
            const failedOffers = [...(task.failedOffers || [])];
            failedOffers.push({ id: offerId, offerIndex, error, creditsRefunded, cancelled: isCancelled });

            const offer = task.offers[offerId] || {};

            return {
              ...prev,
              [taskId]: {
                ...task,
                offers: {
                  ...task.offers,
                  [offerId]: {
                    ...offer,
                    status: offerStatus,
                    error,
                  },
                },
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
      eventSource.addEventListener('cv_generation:completed', (event) => {
        try {
          const data = JSON.parse(event.data);
          const { taskId, totalGenerated, totalFailed, creditsRefunded } = data;

          updateTaskProgress(taskId, {
            status: totalFailed === 0 ? 'completed' : (totalGenerated > 0 ? 'partial' : 'failed'),
            totalGenerated,
            totalFailed,
            creditsRefunded,
          });

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cv_generation:task_completed', { detail: { taskId } }));
            window.dispatchEvent(new Event('cv:list:changed'));
          }
        } catch (err) {
          console.error('[usePipelineProgress] Erreur parsing completed:', err);
        }
      });

      // Événements CV Improvement
      eventSource.addEventListener('cv_improvement:progress', (event) => {
        try {
          const data = JSON.parse(event.data);
          const { taskId, stage, step, status, current, total, itemType } = data;

          setProgressMap(prev => {
            const isNewTask = !prev[taskId];
            if (isNewTask && typeof window !== 'undefined') {
              // Nouvelle tâche détectée via SSE (vient d'un autre device/onglet)
              setTimeout(() => window.dispatchEvent(new Event('realtime:task:updated')), 0);
            }

            const task = prev[taskId] || { stages: {}, completedSteps: {}, status: 'running', type: 'cv_improvement' };
            const completedSteps = { ...task.completedSteps };

            if (status === 'completed') {
              completedSteps[step] = true;
            }

            return {
              ...prev,
              [taskId]: {
                ...task,
                type: 'cv_improvement',
                currentStage: stage,
                currentStep: step,
                currentItem: current ?? null,
                totalItems: total ?? null,
                itemType: itemType ?? null,
                completedSteps,
                status: 'running',
                lastUpdate: Date.now(),
              },
            };
          });
        } catch (err) {
          console.error('[usePipelineProgress] Erreur parsing cv_improvement:progress:', err);
        }
      });

      eventSource.addEventListener('cv_improvement:completed', (event) => {
        try {
          const data = JSON.parse(event.data);
          const { taskId, changesCount, pipelineVersion, stageMetrics } = data;

          updateTaskProgress(taskId, {
            type: 'cv_improvement',
            status: 'completed',
            changesCount,
            pipelineVersion,
            stageMetrics,
          });

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cv_improvement:task_completed', { detail: { taskId } }));
            window.dispatchEvent(new Event('cv:list:changed'));
          }
        } catch (err) {
          console.error('[usePipelineProgress] Erreur parsing cv_improvement:completed:', err);
        }
      });

      eventSource.addEventListener('cv_improvement:failed', (event) => {
        try {
          const data = JSON.parse(event.data);
          const { taskId, error } = data;

          const isCancelled = error === 'Task cancelled' || error?.includes('cancelled');

          updateTaskProgress(taskId, {
            type: 'cv_improvement',
            status: isCancelled ? 'cancelled' : 'failed',
            error,
          });

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('cv:list:changed'));
          }
        } catch (err) {
          console.error('[usePipelineProgress] Erreur parsing cv_improvement:failed:', err);
        }
      });
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isAuthenticated, updateOfferProgress, markStepCompleted, updateTaskProgress]);

  // Détection des tâches "stale"
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const STALE_TIMEOUT_MS = 5 * 60 * 1000;
    const CHECK_INTERVAL_MS = 30 * 1000;

    const checkStaleTasks = () => {
      const now = Date.now();
      let hasStale = false;

      Object.entries(progressMap).forEach(([taskId, progress]) => {
        if (
          progress.status === 'running' &&
          progress.lastUpdate &&
          (now - progress.lastUpdate) > STALE_TIMEOUT_MS
        ) {
          console.log(`[usePipelineProgress] Tâche ${taskId} stale, demande de rafraîchissement`);
          hasStale = true;
        }
      });

      if (hasStale && typeof window !== 'undefined') {
        window.dispatchEvent(new Event('realtime:task:updated'));
      }
    };

    const interval = setInterval(checkStaleTasks, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, progressMap]);

  // Hydratation du progressMap depuis les données serveur (rechargement page)
  const hydrateFromServer = useCallback((tasksWithProgress) => {
    setProgressMap(prev => {
      const next = { ...prev };
      tasksWithProgress.forEach(task => {
        if (!task.progress || next[task.id]) return; // Ne pas écraser les données SSE
        next[task.id] = {
          offers: task.progress.offers,
          completedOffers: task.progress.completedOffers || [],
          failedOffers: task.progress.failedOffers || [],
          totalOffers: Object.keys(task.progress.offers).length,
          status: 'running',
          lastUpdate: Date.now(),
        };
      });
      return next;
    });
  }, []);

  // Écouter les données de progression du serveur pour hydratation initiale
  useEffect(() => {
    const handler = (event) => {
      hydrateFromServer(event.detail.tasks);
    };
    window.addEventListener('tasks:progress-hydrate', handler);
    return () => window.removeEventListener('tasks:progress-hydrate', handler);
  }, [hydrateFromServer]);

  // Récupérer la progression pour une tâche spécifique
  const getProgress = useCallback((taskId) => {
    return progressMap[taskId] || null;
  }, [progressMap]);

  // Récupérer la progression d'une offre spécifique
  const getOfferProgress = useCallback((taskId, offerId) => {
    const task = progressMap[taskId];
    if (!task || !task.offers) return null;
    return task.offers[offerId] || null;
  }, [progressMap]);

  // Récupérer les offres triées par index
  const getOffersArray = useCallback((taskId) => {
    const task = progressMap[taskId];
    if (!task || !task.offers) return [];

    return Object.entries(task.offers)
      .map(([offerId, data]) => ({ offerId, ...data }))
      .sort((a, b) => a.offerIndex - b.offerIndex);
  }, [progressMap]);

  return {
    getProgress,
    getOfferProgress,
    getOffersArray,
    calculateOfferProgress,
    allProgress: progressMap,
    hydrateFromServer,
  };
}

/**
 * Hook pour écouter la progression d'une tâche spécifique du pipeline CV
 *
 * @param {string} taskId - ID de la tâche à suivre
 * @returns {Object|null} Progression de la tâche
 */
export function useSSEPipelineProgress(taskId) {
  const { getProgress } = usePipelineProgress();
  return taskId ? getProgress(taskId) : null;
}

// Exporter les constantes pour le composant UI
export { PIPELINE_STEPS, STEP_WEIGHTS, calculateOfferProgress };
