"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { useTaskSyncAPI } from "@/hooks/useTaskSyncAPI";

const MAX_CONCURRENT_TASKS = 3;

const BackgroundTasksContext = createContext();

export function useBackgroundTasks() {
  const context = useContext(BackgroundTasksContext);
  if (!context) {
    throw new Error("useBackgroundTasks must be used within a BackgroundTasksProvider");
  }
  return context;
}

export default function BackgroundTasksProvider({ children }) {
  const [tasks, setTasks] = useState([]);
  const [runningTasks, setRunningTasks] = useState([]);
  const tasksRef = useRef([]);
  const taskQueue = useRef([]);
  const abortControllers = useRef(new Map());
  const { addNotification } = useNotifications();

  // Initialize cross-device sync
  const { isApiSyncEnabled, cancelTaskOnServer, deleteCompletedTasksOnServer, loadTasksFromServer, localDeviceId } = useTaskSyncAPI(tasks, setTasks, abortControllers);

  // Load from localStorage only as fallback, API sync will override with real data
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Clear old storage keys
        localStorage.removeItem('backgroundRunningTasks');

        const savedTasks = localStorage.getItem('backgroundTasks');
        if (savedTasks) {
          const parsedTasks = JSON.parse(savedTasks);

          // Filter out potentially stale running tasks from localStorage
          const safeTasks = parsedTasks.filter(task => {
            // Keep completed/failed/cancelled tasks
            if (task.status !== 'running' && task.status !== 'queued') {
              return true;
            }

            // For running/queued tasks, only keep very recent ones (< 1 minute old)
            const age = Date.now() - task.createdAt;
            return age < 60000; // 1 minute
          });

          if (safeTasks.length > 0) {
            console.log(`Loading ${safeTasks.length} safe tasks from localStorage (filtered ${parsedTasks.length - safeTasks.length} potentially stale tasks)`);
            setTasks(safeTasks);
          }

          // Clear localStorage after API sync initializes to prevent interference
          setTimeout(() => {
            if (isApiSyncEnabled) {
              console.log('Clearing localStorage after API sync initialization');
              localStorage.removeItem('backgroundTasks');
            }
          }, 3000);
        }
      } catch (error) {
        console.warn('Failed to load tasks:', error);
      }
    }
  }, []); // Remove dependency on isApiSyncEnabled

  // Always save tasks to localStorage for immediate persistence (in addition to API sync)
  useEffect(() => {
    if (typeof window !== 'undefined' && tasks.length > 0) {
      try {
        const tasksToSave = tasks.map(task => ({
          id: task.id,
          title: task.title,
          successMessage: task.successMessage,
          type: task.type,
          status: task.status,
          createdAt: task.createdAt,
          shouldUpdateCvList: task.shouldUpdateCvList,
          result: task.result,
          error: task.error
        }));
        localStorage.setItem('backgroundTasks', JSON.stringify(tasksToSave));
      } catch (error) {
        console.warn('Failed to save tasks:', error);
      }
    }
  }, [tasks]); // Remove dependency on isApiSyncEnabled

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Helper function to execute a task with periodic cancellation checks
  const executeWithCancellationCheck = useCallback(async (task, abortSignal) => {
    return new Promise((resolve, reject) => {
      let taskPromise;
      let checkInterval;

      // Start the actual task execution
      taskPromise = task.execute(abortSignal);

      // Check for cancellation every 500ms
      checkInterval = setInterval(() => {
        if (abortSignal.aborted) {
          clearInterval(checkInterval);
          reject(new Error('Task cancelled'));
          return;
        }

        // Check if task was cancelled externally (e.g., from another device)
        setTasks(prev => {
          const currentTask = prev.find(t => t.id === task.id);
          if (currentTask && currentTask.status === 'cancelled') {
            clearInterval(checkInterval);
            reject(new Error('Task cancelled externally'));
            return prev;
          }
          return prev;
        });
      }, 500);

      // Handle task completion/rejection
      taskPromise
        .then(result => {
          clearInterval(checkInterval);
          resolve(result);
        })
        .catch(error => {
          clearInterval(checkInterval);
          reject(error);
        });
    });
  }, []);

  const processQueue = useCallback(async () => {
    if (runningTasks.length >= MAX_CONCURRENT_TASKS || taskQueue.current.length === 0) {
      return;
    }

    const nextTask = taskQueue.current.shift();
    if (!nextTask) return;

    // Check if task was cancelled before we even start processing
    const currentTaskInState = tasks.find(t => t.id === nextTask.id);
    if (currentTaskInState && currentTaskInState.status === 'cancelled') {
      // Task already cancelled, don't start it, process next one
      setTimeout(() => processQueue(), 100);
      return;
    }

    // Create AbortController for this task
    const abortController = new AbortController();
    abortControllers.current.set(nextTask.id, abortController);

    setRunningTasks(prev => [...prev, nextTask.id]);
    setTasks(prev => prev.map(task =>
      task.id === nextTask.id ? { ...task, status: 'running' } : task
    ));

    // Show start notification
    addNotification({
      type: "info",
      message: nextTask.title,
      duration: 2000,
    });

    try {
      // Check if task was cancelled before execution
      if (abortController.signal.aborted) {
        throw new Error('Task cancelled');
      }

      // Get fresh task state to check if it was cancelled externally
      let shouldContinue = true;
      setTasks(prev => {
        const currentTask = prev.find(t => t.id === nextTask.id);
        if (currentTask && currentTask.status === 'cancelled') {
          shouldContinue = false;
        }
        return prev;
      });

      if (!shouldContinue) {
        throw new Error('Task cancelled externally');
      }

      // Execute the task with abort signal and periodic cancellation checks
      // Pass the task ID to the execute function if it accepts it
      const executeWithTaskId = (signal) => {
        if (nextTask.execute.length >= 2) {
          // Function accepts taskId as second parameter
          return nextTask.execute(signal, nextTask.id);
        } else {
          // Legacy function, just pass the signal
          return nextTask.execute(signal);
        }
      };
      const result = await executeWithCancellationCheck({ ...nextTask, execute: executeWithTaskId }, abortController.signal);

      // Task completed successfully
      setTasks(prev => prev.map(task =>
        task.id === nextTask.id ? { ...task, status: 'completed', result } : task
      ));

      addNotification({
        type: "success",
        message: nextTask.successMessage || "Tâche terminée avec succès",
        duration: 3000,
      });

      // Trigger CV list update if needed
      if (nextTask.shouldUpdateCvList) {
        if (typeof window !== "undefined") {
          // Delay the update slightly to ensure backend processing is complete
          setTimeout(() => {
            window.dispatchEvent(new Event("cv:list:changed"));
          }, 500);
        }
      }

    } catch (error) {
      const currentTaskState = tasksRef.current.find(t => t.id === nextTask.id);
      const alreadyMarkedCancelled = currentTaskState?.status === 'cancelled';
      const looksLikeCancellation = Boolean(
        error?.message === 'Task cancelled' ||
        error?.message === 'Task cancelled externally' ||
        (typeof error?.message === 'string' && error.message.includes('Task cancelled')) ||
        error?.name === 'AbortError'
      );
      const cancellationRequested = alreadyMarkedCancelled;
      const isTransientNetworkError = (() => {
        if (error?.name === 'AbortError') return true;
        if (error?.name === 'TypeError') {
          const msg = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
          return msg.includes('fetch') || msg.includes('network') || msg.includes('abort');
        }
        if (typeof error?.message === 'string') {
          const msg = error.message.toLowerCase();
          return msg.includes('networkerror') || msg.includes('network request failed') || msg.includes('aborted');
        }
        return false;
      })();

      // Check if error is due to cancellation
      if (looksLikeCancellation && cancellationRequested) {
        // Task was cancelled - don't show error notification
        setTasks(prev => prev.map(task =>
          task.id === nextTask.id ? { ...task, status: 'cancelled' } : task
        ));
      } else if (looksLikeCancellation) {
        // Navigation refresh or dropped connection: keep task as running to allow server to drive status
        setTasks(prev => prev.map(task =>
          task.id === nextTask.id
            ? { ...task, status: 'running', error: null }
            : task
        ));
      } else if (isTransientNetworkError) {
        setTasks(prev => prev.map(task =>
          task.id === nextTask.id
            ? { ...task, status: 'running', error: null }
            : task
        ));
      } else {
        // Task failed for other reasons
        setTasks(prev => prev.map(task =>
          task.id === nextTask.id ? { ...task, status: 'failed', error: error.message } : task
        ));

        addNotification({
          type: "error",
          message: "Erreur ! Echec lors de la création du CV.",
          duration: 5000,
        });
      }
    } finally {
      // Clean up abort controller
      abortControllers.current.delete(nextTask.id);
      setRunningTasks(prev => prev.filter(id => id !== nextTask.id));

      // Process next task in queue
      setTimeout(() => processQueue(), 100);
    }
  }, [runningTasks, addNotification, tasks]);

  const addTask = useCallback((taskConfig) => {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newTask = {
      id: taskId,
      title: taskConfig.title,
      successMessage: taskConfig.successMessage,
      type: taskConfig.type,
      status: 'queued',
      createdAt: Date.now(),
      shouldUpdateCvList: taskConfig.shouldUpdateCvList || false,
      execute: taskConfig.execute,
    };

    console.log('Adding task:', newTask);
    setTasks(prev => {
      const newTasks = [...prev, newTask];
      console.log('Tasks after adding:', newTasks);
      return newTasks;
    });
    taskQueue.current.push(newTask);

    // Start processing if possible
    setTimeout(() => processQueue(), 0);

    return taskId;
  }, [processQueue]);

  const getTaskStatus = useCallback((taskId) => {
    return tasks.find(task => task.id === taskId);
  }, [tasks]);

  const clearCompletedTasks = useCallback(async () => {
    // Get IDs of completed tasks to delete
    const completedTaskIds = tasks
      .filter(task => task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled')
      .map(task => task.id);

    // Remove locally
    setTasks(prev => prev.filter(task =>
      task.status !== 'completed' && task.status !== 'failed' && task.status !== 'cancelled'
    ));

    // Remove from server if API sync is enabled
    if (isApiSyncEnabled && deleteCompletedTasksOnServer && completedTaskIds.length > 0) {
      await deleteCompletedTasksOnServer(completedTaskIds);
    }
  }, [tasks, isApiSyncEnabled, deleteCompletedTasksOnServer]);

  // Function to force clear all tasks (for debugging/cleanup)
  const clearAllTasks = useCallback(() => {
    setTasks([]);
    taskQueue.current = [];
    abortControllers.current.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('backgroundTasks');
    }
  }, []);

  // Function to force sync with server
  const forceSyncWithServer = useCallback(async () => {
    if (loadTasksFromServer) {
      await loadTasksFromServer();
    }
  }, [loadTasksFromServer]);

  const cancelTask = useCallback(async (taskId) => {
    // Find the task
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      console.warn(`Task ${taskId} not found for cancellation`);
      return;
    }

    console.log(`Attempting to cancel task ${taskId} with status: ${task.status}`);

    // For queued tasks
    if (task.status === 'queued') {
      // Remove from local queue if present
      taskQueue.current = taskQueue.current.filter(t => t.id !== taskId);

      // Update local state immediately for instant feedback
      setTasks(prev => prev.filter(t => t.id !== taskId));

      // Try server cancellation for consistency
      if (isApiSyncEnabled && cancelTaskOnServer) {
        try {
          await cancelTaskOnServer(taskId);
          // Server will handle the cancellation and sync will update the UI
        } catch (error) {
          console.warn('Server cancellation failed for queued task:', error);
          // Task is already removed locally, so this is not critical
        }
      }

      addNotification({
        type: "info",
        message: "Tâche annulée",
        duration: 2000,
      });
    }
    // For running tasks
    else if (task.status === 'running') {
      // Server-side cancel (primary method - works even after page refresh)
      if (isApiSyncEnabled && cancelTaskOnServer) {
        try {
          // Update local state immediately for instant feedback
          setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, status: 'cancelled' } : t
          ));

          await cancelTaskOnServer(taskId);

          // Also try local abort if controller exists (for immediate local feedback)
          const abortController = abortControllers.current.get(taskId);
          if (abortController) {
            abortController.abort();
          }

          // Force immediate sync to get updated status from server
          if (loadTasksFromServer) {
            // Quick sync without delay for immediate feedback
            loadTasksFromServer();
            // And a backup sync after a short delay
            setTimeout(() => loadTasksFromServer(), 100);
          }

          addNotification({
            type: "info",
            message: "Tâche en cours annulée",
            duration: 2000,
          });
        } catch (error) {
          console.warn('Server cancellation failed:', error);

          // Rollback local state if server cancellation failed
          setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, status: 'running' } : t
          ));

          addNotification({
            type: "error",
            message: "Erreur lors de l'annulation de la tâche",
            duration: 3000,
          });
        }
      } else {
        // No API sync - only works for locally running tasks
        const abortController = abortControllers.current.get(taskId);
        if (abortController) {
          abortController.abort();
          setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, status: 'cancelled' } : t
          ));
          addNotification({
            type: "info",
            message: "Tâche en cours annulée",
            duration: 2000,
          });
        } else {
          addNotification({
            type: "warning",
            message: "Impossible d'annuler cette tâche (rafraîchissez la page pour voir le statut actuel)",
            duration: 3000,
          });
        }
      }
    }
    // Handle cases where task might be stuck/phantom
    else if (task.status === 'running' || task.status === 'queued') {
      // For phantom tasks, try to remove them forcefully
      addNotification({
        type: "warning",
        message: "Suppression forcée de la tâche fantôme...",
        duration: 2000,
      });

      setTasks(prev => prev.filter(t => t.id !== taskId));
    }
  }, [tasks, addNotification, isApiSyncEnabled, cancelTaskOnServer]);

  // Function to remove phantom tasks
  const removePhantomTask = useCallback(async (taskId) => {
    // Try to cancel on server first if API sync is enabled
    if (isApiSyncEnabled && cancelTaskOnServer) {
      try {
        await cancelTaskOnServer(taskId);
        addNotification({
          type: "info",
          message: "Tâche fantôme nettoyée sur le serveur",
          duration: 2000,
        });
        return;
      } catch (error) {
        console.warn('Failed to clean phantom task on server:', error);
      }
    }

    // Fallback to local removal
    setTasks(prev => prev.filter(t => t.id !== taskId));
    addNotification({
      type: "info",
      message: "Tâche fantôme supprimée localement",
      duration: 2000,
    });
  }, [addNotification, isApiSyncEnabled, cancelTaskOnServer]);

  return (
    <BackgroundTasksContext.Provider value={{
      tasks,
      runningTasks,
      addTask,
      getTaskStatus,
      clearCompletedTasks,
      cancelTask,
      isApiSyncEnabled,
      clearAllTasks,
      forceSyncWithServer,
      removePhantomTask,
      localDeviceId,
    }}>
      {children}
    </BackgroundTasksContext.Provider>
  );
}
