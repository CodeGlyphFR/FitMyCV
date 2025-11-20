"use client";

import React, { createContext, useContext, useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { useTaskSyncAPI } from "@/hooks/useTaskSyncAPI";
import { emitTaskAddedEvent } from "@/lib/backgroundTasks/taskTypes";

const BackgroundTasksContext = createContext(null);

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

    window.addEventListener('realtime:task:updated', handleRealtimeTaskUpdate);
    return () => {
      window.removeEventListener('realtime:task:updated', handleRealtimeTaskUpdate);
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
      // Émettre l'événement pour rafraîchir les compteurs de tokens
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('tokens:updated'));
      }
      return;
    }

    const message = result?.error || "Impossible d'annuler la tâche";
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

    const message = result?.error || "Impossible de supprimer les tâches terminées";
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

      if (!task?.shouldUpdateCvList) {
        return;
      }

      if (task.status === 'completed') {
        // Émettre l'événement task:completed pour l'onboarding
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('task:completed', {
            detail: { task }
          }));
        }

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
                    message: task.successMessage || 'Tâche terminée',
                    duration: 3000,
                  });
                }
              }
            } catch (err) {
              // En cas d'erreur, notifier quand même pour ne pas perdre l'info
              addNotification({
                type: 'success',
                message: task.successMessage || 'Tâche terminée',
                duration: 3000,
              });
            }
          };
          checkFirstCv();
        } else {
          // Pour les autres types de tâches, notifier normalement
          addNotification({
            type: 'success',
            message: task.successMessage || 'Tâche terminée',
            duration: 3000,
          });
        }
        didTrigger = true;
      } else if (task.status === 'failed') {
        const errorMessage = task.error || 'Échec de la tâche';

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
  }, [tasks, isAuthenticated, refreshTasks, addNotification]);

  return (
    <BackgroundTasksContext.Provider value={value}>
      {children}
    </BackgroundTasksContext.Provider>
  );
}
