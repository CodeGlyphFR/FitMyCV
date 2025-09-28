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
  const taskQueue = useRef([]);
  const abortControllers = useRef(new Map());
  const { addNotification } = useNotifications();

  // Initialize cross-device sync
  const { isApiSyncEnabled, cancelTaskOnServer, deleteCompletedTasksOnServer } = useTaskSyncAPI(tasks, setTasks, abortControllers);

  // Fallback persistence - only use localStorage if API sync is not enabled
  useEffect(() => {
    if (typeof window !== 'undefined' && !isApiSyncEnabled) {
      try {
        // Clear old storage keys
        localStorage.removeItem('backgroundRunningTasks');

        const savedTasks = localStorage.getItem('backgroundTasks');
        if (savedTasks) {
          const parsedTasks = JSON.parse(savedTasks);
          // Only restore completed/failed/cancelled tasks, not running ones
          const restoredTasks = parsedTasks.map(task => ({
            ...task,
            status: (task.status === 'running' || task.status === 'queued') ? 'cancelled' : task.status
          }));
          setTasks(restoredTasks);
        }
      } catch (error) {
        console.warn('Failed to load tasks:', error);
      }
    }
  }, [isApiSyncEnabled]);

  // Fallback persistence - save tasks when they change (only if API sync not enabled)
  useEffect(() => {
    if (typeof window !== 'undefined' && !isApiSyncEnabled && tasks.length > 0) {
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
  }, [tasks, isApiSyncEnabled]);

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
      // Check if error is due to cancellation
      if (error.message === 'Task cancelled' ||
          error.message === 'Task cancelled externally' ||
          error.message.includes('Task cancelled') ||
          abortController.signal.aborted) {
        // Task was cancelled - don't show error notification
        setTasks(prev => prev.map(task =>
          task.id === nextTask.id ? { ...task, status: 'cancelled' } : task
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

  const cancelTask = useCallback(async (taskId) => {
    // Find the task
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // If task is queued, remove it from queue and tasks
    if (task.status === 'queued') {
      // Remove from queue
      taskQueue.current = taskQueue.current.filter(t => t.id !== taskId);

      // Remove from tasks list
      setTasks(prev => prev.filter(t => t.id !== taskId));

      addNotification({
        type: "info",
        message: "Tâche annulée",
        duration: 2000,
      });
    }
    // If task is running, abort it locally AND on server
    else if (task.status === 'running') {
      // Local abort
      const abortController = abortControllers.current.get(taskId);
      if (abortController) {
        abortController.abort();
      }

      // Server-side cancel (if API sync is enabled)
      if (isApiSyncEnabled && cancelTaskOnServer) {
        await cancelTaskOnServer(taskId);
      } else {
        // If no API sync, mark as cancelled locally
        setTasks(prev => prev.map(t =>
          t.id === taskId ? { ...t, status: 'cancelled' } : t
        ));
      }

      addNotification({
        type: "info",
        message: "Tâche en cours annulée",
        duration: 2000,
      });
    }
  }, [tasks, addNotification, isApiSyncEnabled, cancelTaskOnServer]);

  return (
    <BackgroundTasksContext.Provider value={{
      tasks,
      runningTasks,
      addTask,
      getTaskStatus,
      clearCompletedTasks,
      cancelTask,
      isApiSyncEnabled,
    }}>
      {children}
    </BackgroundTasksContext.Provider>
  );
}