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
  const { addNotification } = useNotifications();

  const processQueue = useCallback(async () => {
    if (runningTasks.length >= MAX_CONCURRENT_TASKS || taskQueue.current.length === 0) {
      return;
    }

    const nextTask = taskQueue.current.shift();
    if (!nextTask) return;

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
      // Execute the task
      const result = await nextTask.execute();

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
      // Task failed
      setTasks(prev => prev.map(task =>
        task.id === nextTask.id ? { ...task, status: 'failed', error: error.message } : task
      ));

      addNotification({
        type: "error",
        message: "Erreur ! Echec lors de la création du CV.",
        duration: 5000,
      });
    } finally {
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
    // If task is running, mark it as cancelled (the execution will handle cleanup)
    else if (task.status === 'running') {
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: 'cancelled' } : t
      ));

      // Remove from running tasks
      setRunningTasks(prev => prev.filter(id => id !== taskId));

      addNotification({
        type: "info",
        message: "Tâche en cours annulée",
        duration: 2000,
      });

      // Process next task in queue
      setTimeout(() => processQueue(), 100);
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