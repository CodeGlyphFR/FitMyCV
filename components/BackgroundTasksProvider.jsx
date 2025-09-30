"use client";

import React, { createContext, useContext, useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { useTaskSyncAPI } from "@/hooks/useTaskSyncAPI";

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
  const [tasks, setTasks] = useState([]);
  const { addNotification } = useNotifications();
  const previousStatusesRef = useRef(new Map());
  const initialLoadRef = useRef(true);

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

  const cancelTask = useCallback(async (taskId) => {
    if (!taskId) return;

    const result = await cancelTaskOnServer?.(taskId);
    if (result?.success) {
      await refreshTasks();
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

  const value = useMemo(() => ({
    tasks,
    runningTasks: tasks.filter(task => task.status === 'running'),
    isApiSyncEnabled,
    cancelTask,
    clearCompletedTasks,
    refreshTasks,
    localDeviceId,
  }), [tasks, isApiSyncEnabled, cancelTask, clearCompletedTasks, refreshTasks, localDeviceId]);

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
      console.log(`[BackgroundTask] Tâche ${task.id} (${task.type}): ${prevStatus} → ${task.status}`);

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
        addNotification({
          type: 'success',
          message: task.successMessage || 'Tâche terminée',
          duration: 3000,
        });
        didTrigger = true;
      } else if (task.status === 'failed') {
        const errorMessage = task.error || 'Échec de la tâche';
        console.error(`[BackgroundTask] Tâche ${task.id} (${task.type}) a échoué:`, errorMessage);
        console.error(`[BackgroundTask] Détails de la tâche:`, task);

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
