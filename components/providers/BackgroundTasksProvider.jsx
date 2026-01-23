"use client";

import React, { createContext, useContext, useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { useTaskSyncAPI } from "@/hooks/useTaskSyncAPI";
import { emitTaskAddedEvent } from "@/lib/background-jobs/taskTypes";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const BackgroundTasksContext = createContext(null);

/**
 * Parse successMessage qui peut être:
 * - Une clé de traduction simple: "taskQueue.messages.pipelineCompleted"
 * - Un JSON avec clé + params: {"key": "taskQueue.messages.cvGenerated", "params": {"count": 3}}
 * - Un message texte brut (legacy)
 */
function parseSuccessMessage(successMessage, t) {
  if (!successMessage) return null;

  // Si c'est une clé de traduction simple (commence par "taskQueue." ou "errors.")
  if (typeof successMessage === 'string' && (successMessage.startsWith('taskQueue.') || successMessage.startsWith('errors.'))) {
    return t(successMessage);
  }

  // Si c'est un JSON avec clé + params
  try {
    const parsed = JSON.parse(successMessage);
    if (parsed.key) {
      return t(parsed.key, parsed.params || {});
    }
  } catch {
    // Ce n'est pas du JSON, retourner le message tel quel (legacy)
  }

  return successMessage;
}

export function useBackgroundTasks() {
  const context = useContext(BackgroundTasksContext);
  if (!context) {
    throw new Error("useBackgroundTasks must be used within a BackgroundTasksProvider");
  }
  return context;
}

export default function BackgroundTasksProvider({ children }) {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [tasks, setTasksInternal] = useState([]);
  const { addNotification } = useNotifications();
  const { t } = useLanguage();
  const previousStatusesRef = useRef(new Map());
  const initialLoadRef = useRef(true);

  // Wrapper pour setTasks qui détecte les nouvelles tâches et émet des événements
  const setTasks = useCallback((newTasksOrUpdater) => {
    setTasksInternal(prevTasks => {
      const updatedTasks = typeof newTasksOrUpdater === 'function'
        ? newTasksOrUpdater(prevTasks)
        : newTasksOrUpdater;

      // Détecter les tâches nouvellement ajoutées (pas dans prevTasks)
      const prevTaskIds = new Set(prevTasks.map(t => t.id));
      const addedTasks = updatedTasks.filter(t => !prevTaskIds.has(t.id));

      // Émettre l'événement task:added pour chaque nouvelle tâche
      // (permet la détection des tâches venant du serveur)
      if (typeof window !== 'undefined' && addedTasks.length > 0) {
        addedTasks.forEach(task => {
          emitTaskAddedEvent(task);
        });
      }

      return updatedTasks;
    });
  }, []);

  const {
    isApiSyncEnabled,
    cancelTaskOnServer,
    deleteCompletedTasksOnServer,
    loadTasksFromServer,
    localDeviceId,
  } = useTaskSyncAPI(tasks, setTasks, null, { enabled: isAuthenticated });

  const refreshTasks = useCallback(async () => {
    await loadTasksFromServer?.();
  }, [loadTasksFromServer]);

  // Ref pour stabiliser refreshTasks et éviter les re-renders inutiles
  const refreshTasksRef = useRef(refreshTasks);
  useEffect(() => {
    refreshTasksRef.current = refreshTasks;
  }, [refreshTasks]);

  // Debounce pour les rafraîchissements SSE (éviter les rafraîchissements trop rapides)
  const debounceTimerRef = useRef(null);

  // Écouter les événements temps réel pour rafraîchir les tâches
  useEffect(() => {
    const handleRealtimeTaskUpdate = (event) => {

      // Debounce : ne rafraîchir qu'après 500ms sans nouvel événement
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        refreshTasksRef.current().then(() => {
        }).catch(err => {
        });
      }, 500);
    };

    // Rafraîchissement immédiat quand une tâche cv_generation est terminée (pas de debounce)
    const handleTaskCompleted = () => {
      // Annuler le debounce en cours s'il y en a un
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      // Rafraîchir immédiatement
      refreshTasksRef.current().catch(err => {
        console.error('[BackgroundTasksProvider] Erreur refresh après complétion:', err);
      });
    };

    window.addEventListener('realtime:task:updated', handleRealtimeTaskUpdate);
    window.addEventListener('cv_generation:task_completed', handleTaskCompleted);
    return () => {
      window.removeEventListener('realtime:task:updated', handleRealtimeTaskUpdate);
      window.removeEventListener('cv_generation:task_completed', handleTaskCompleted);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []); // Pas de dépendances - utilise la ref pour accéder à refreshTasks

  // Calculer si on a des tâches actives (mémoïsé pour éviter re-render inutiles)
  const hasRunningTasks = useMemo(() =>
    tasks.some(task => task.status === 'running' || task.status === 'queued'),
    [tasks]
  );

  // Polling de backup si des tâches sont en cours (en cas d'échec SSE)
  useEffect(() => {
    if (!isAuthenticated || !hasRunningTasks) {
      return;
    }


    // Polling toutes les 10 secondes uniquement si des tâches sont actives
    const interval = setInterval(() => {
      refreshTasks().catch(err => {
      });
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [isAuthenticated, hasRunningTasks, refreshTasks]);

  const cancelTask = useCallback(async (taskId) => {
    if (!taskId) return;

    const result = await cancelTaskOnServer?.(taskId);
    if (result?.success) {
      await refreshTasks();
      // Émettre les événements pour rafraîchir les compteurs
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('tokens:updated'));
        window.dispatchEvent(new Event('credits-updated'));
      }
      return;
    }

    // Parse l'erreur API si c'est une clé de traduction
    let message = result?.error || '';
    if (message.startsWith('errors.')) {
      message = t(message);
    } else if (!message) {
      message = t('errors.api.background.cancelFailed');
    }
    addNotification({ type: "error", message, duration: 4000 });
  }, [cancelTaskOnServer, addNotification, refreshTasks]);

  const clearCompletedTasks = useCallback(async () => {
    const completedIds = tasks
      .filter(task => task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled')
      .map(task => task.id);

    if (!completedIds.length) {
      return;
    }

    const result = await deleteCompletedTasksOnServer?.(completedIds);
    if (result?.success) {
      await refreshTasks();
      return;
    }

    // Parse l'erreur API si c'est une clé de traduction
    let message = result?.error || '';
    if (message.startsWith('errors.')) {
      message = t(message);
    } else if (!message) {
      message = t('errors.api.background.deleteFailed');
    }
    addNotification({ type: "error", message, duration: 4000 });
  }, [tasks, deleteCompletedTasksOnServer, addNotification, refreshTasks]);

  const addOptimisticTask = useCallback((taskData) => {
    const optimisticTask = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'queued',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isOptimistic: true,
      ...taskData,
    };

    setTasks(prev => [optimisticTask, ...prev]);

    // NOTE : L'événement task:added est émis après succès API dans useGeneratorModal.js
    // pour éviter les faux positifs si l'API échoue

    return optimisticTask.id;
  }, []);

  const removeOptimisticTask = useCallback((taskId) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  }, []);

  const value = useMemo(() => ({
    tasks,
    runningTasks: tasks.filter(task => task.status === 'running'),
    isApiSyncEnabled,
    cancelTask,
    clearCompletedTasks,
    refreshTasks,
    localDeviceId,
    addOptimisticTask,
    removeOptimisticTask,
  }), [tasks, isApiSyncEnabled, cancelTask, clearCompletedTasks, refreshTasks, localDeviceId, addOptimisticTask, removeOptimisticTask]);

  useEffect(() => {
    if (!isAuthenticated) {
      previousStatusesRef.current = new Map();
      initialLoadRef.current = true;
      return;
    }

    const prevMap = previousStatusesRef.current;
    const nextMap = new Map();
    let didTrigger = false;

    tasks.forEach(task => {
      const prevStatus = prevMap.get(task.id);
      const statusChanged = prevStatus !== undefined && prevStatus !== task.status;

      nextMap.set(task.id, task.status);

      if (!statusChanged) {
        return;
      }

      // Log tous les changements de statut dans la console

      if (task?.shouldUpdateCvList && typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cv:list:changed'));
      }

      if (initialLoadRef.current) {
        return;
      }

      // Émettre task:completed pour l'onboarding (toutes les tâches complétées)
      // Important: doit être avant le check shouldUpdateCvList car les tâches match score
      // n'ont pas ce flag mais ont besoin de déclencher la validation de l'onboarding
      if (task.status === 'completed' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('task:completed', {
          detail: { task }
        }));
        // Rafraîchir le compteur de crédits (la tâche a potentiellement consommé des crédits)
        window.dispatchEvent(new Event('credits-updated'));
      }

      // Rafraîchir le compteur de crédits si la tâche a échoué (remboursement potentiel)
      if (task.status === 'failed' && typeof window !== 'undefined') {
        window.dispatchEvent(new Event('credits-updated'));
      }

      if (!task?.shouldUpdateCvList) {
        return;
      }

      if (task.status === 'completed') {

        // Pour les tâches de création/import de CV, vérifier si c'est le premier CV
        // Si oui, ne pas notifier car l'utilisateur voit déjà la barre de progression
        const isImportOrCreateTask = task.type === 'import' || task.type === 'create-manual';

        if (isImportOrCreateTask) {
          // Vérifier combien de CV l'utilisateur a maintenant
          const checkFirstCv = async () => {
            try {
              const res = await fetch('/api/cvs');
              if (res.ok) {
                const data = await res.json();
                const cvCount = data.items?.length || 0;

                // Ne notifier que si ce n'est PAS le premier CV (cvCount > 1)
                if (cvCount > 1) {
                  addNotification({
                    type: 'success',
                    message: parseSuccessMessage(task.successMessage, t) || t('errors.api.background.taskCompleted'),
                    duration: 3000,
                  });
                }
              }
            } catch (err) {
              // En cas d'erreur, notifier quand même pour ne pas perdre l'info
              addNotification({
                type: 'success',
                message: parseSuccessMessage(task.successMessage, t) || t('errors.api.background.taskCompleted'),
                duration: 3000,
              });
            }
          };
          checkFirstCv();
        } else {
          // Pour les autres types de tâches, notifier normalement
          addNotification({
            type: 'success',
            message: parseSuccessMessage(task.successMessage, t) || t('errors.api.background.taskCompleted'),
            duration: 3000,
          });
        }
        didTrigger = true;
      } else if (task.status === 'failed') {
        let errorMessage = task.error || t('errors.api.background.taskFailed');

        // Essayer de parser comme JSON avec clé de traduction
        try {
          const errorData = JSON.parse(errorMessage);
          if (errorData.translationKey?.startsWith('taskQueue.errors.')) {
            errorMessage = t(errorData.translationKey, { source: errorData.source || '' });
          } else if (errorData.translationKey?.startsWith('errors.')) {
            errorMessage = t(errorData.translationKey);
          }
        } catch {
          // Si c'est une clé de traduction directe
          if (errorMessage.startsWith('errors.')) {
            errorMessage = t(errorMessage);
          }
        }

        addNotification({
          type: 'error',
          message: errorMessage,
          duration: 4000,
        });
        didTrigger = true;
      }
    });

    previousStatusesRef.current = nextMap;
    initialLoadRef.current = false;

    if (didTrigger) {
      refreshTasks?.();
    }
  }, [tasks, isAuthenticated, refreshTasks, addNotification, t]);

  return (
    <BackgroundTasksContext.Provider value={value}>
      {children}
    </BackgroundTasksContext.Provider>
  );
}
