"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { useNotifications } from "@/components/notifications/NotificationProvider";

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

  const processQueue = useCallback(async () => {
    if (runningTasks.length >= MAX_CONCURRENT_TASKS || taskQueue.current.length === 0) {
      return;
    }

    const nextTask = taskQueue.current.shift();
    if (!nextTask) return;

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

      // Execute the task with abort signal
      const result = await nextTask.execute(abortController.signal);

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
      if (error.message === 'Task cancelled' || abortController.signal.aborted) {
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
  }, [runningTasks, addNotification]);

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

  const clearCompletedTasks = useCallback(() => {
    setTasks(prev => prev.filter(task =>
      task.status !== 'completed' && task.status !== 'failed' && task.status !== 'cancelled'
    ));
  }, []);

  const cancelTask = useCallback((taskId) => {
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
    // If task is running, abort it using the AbortController
    else if (task.status === 'running') {
      const abortController = abortControllers.current.get(taskId);
      if (abortController) {
        abortController.abort();
      }

      addNotification({
        type: "info",
        message: "Tâche en cours annulée",
        duration: 2000,
      });
    }
  }, [tasks, addNotification, processQueue]);

  return (
    <BackgroundTasksContext.Provider value={{
      tasks,
      runningTasks,
      addTask,
      getTaskStatus,
      clearCompletedTasks,
      cancelTask,
    }}>
      {children}
    </BackgroundTasksContext.Provider>
  );
}