"use client";

import React from "react";
import { useBackgroundTasks } from "@/components/BackgroundTasksProvider";

export default function QueueIcon({ className = "h-4 w-4" }) {
  const { tasks } = useBackgroundTasks();

  // Filtrer les tâches de calcul de match score (elles ne doivent apparaître que dans l'animation du bouton)
  const visibleTasks = tasks.filter(task => task.type !== 'calculate-match-score');

  const runningTasksCount = visibleTasks.filter(task => task.status === 'running').length;
  const queuedTasksCount = visibleTasks.filter(task => task.status === 'queued').length;
  const hasActiveTasks = runningTasksCount > 0 || queuedTasksCount > 0;

  return (
    <div className="relative">
      {/* Queue icon */}
      <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      </svg>

      {/* Badge or loading indicator */}
      {hasActiveTasks && (
        <div className="absolute -top-1 -right-1">
          {runningTasksCount > 0 ? (
            <div className="bg-blue-600 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center relative">
              {runningTasksCount + queuedTasksCount}
              <div className="absolute inset-0 animate-apple-spin border border-white border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="bg-gray-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
              {queuedTasksCount}
            </div>
          )}
        </div>
      )}
    </div>
  );
}