"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useBackgroundTasks } from "@/components/BackgroundTasksProvider";
import { sortTasksForDisplay } from "@/lib/backgroundTasks/sortTasks";

function LoadingSpinner() {
  return (
    <div className="animate-apple-spin h-3 w-3 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
  );
}

function TaskItem({ task, onCancel, compact = false }) {
  const getStatusDisplay = (status) => {
    switch (status) {
      case 'queued':
        return { label: 'En attente', color: 'text-gray-600' };
      case 'running':
        return { label: 'En cours', color: 'text-blue-600' };
      case 'completed':
        return { label: 'Terminé', color: 'text-green-600' };
      case 'failed':
        return { label: 'Échec', color: 'text-red-600' };
      case 'cancelled':
        return { label: 'Annulé', color: 'text-orange-600' };
      default:
        return { label: 'Inconnu', color: 'text-gray-400' };
    }
  };

  const statusDisplay = getStatusDisplay(task.status);
  const createdAt = new Date(task.createdAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const canCancel = task.status === 'queued' || task.status === 'running';

  return (
    <div className={`flex items-center justify-between ${compact ? 'p-2' : 'p-3'} border-b border-gray-100 last:border-b-0 hover:bg-gray-50`}>
      <div className="flex-1 min-w-0 mr-2">
        <div className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-gray-900 truncate`}>
          {task.title}
        </div>
        <div className="text-xs text-gray-500">
          {createdAt}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {task.status === 'running' && <LoadingSpinner />}
        <span className={`text-xs font-medium ${statusDisplay.color}`}>
          {statusDisplay.label}
        </span>
        {canCancel && (
          <button
            onClick={() => onCancel(task.id)}
            className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-1 py-0.5 rounded"
            title="Annuler la tâche"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export default function TaskQueueDropdown({ isOpen, onClose, className = "", buttonRef }) {
  const { tasks, clearCompletedTasks, cancelTask, isApiSyncEnabled } = useBackgroundTasks();
  const [dropdownPosition, setDropdownPosition] = React.useState({ top: 0, right: 0 });

  // Sort tasks so running ones appear first (newest to oldest) and limit to 8
  const sortedTasks = sortTasksForDisplay(tasks).slice(0, 8);

  const completedTasksCount = tasks.filter(task =>
    task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'
  ).length;

  // Calculate position when dropdown opens
  React.useEffect(() => {
    if (isOpen && buttonRef?.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right
      });
    }
  }, [isOpen, buttonRef]);

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Overlay for click outside - covers entire viewport */}
      <div
        className="fixed inset-0 z-[60] bg-transparent"
        onClick={onClose}
      />

      {/* Dropdown content */}
      <div
        className={`fixed w-96 bg-white border border-gray-200 rounded-lg shadow-xl z-[60] ${className}`}
        style={{
          top: `${dropdownPosition.top}px`,
          right: `${dropdownPosition.right}px`
        }}
      >
        <div className="max-h-80 overflow-y-auto">
          {sortedTasks.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <div className="text-sm">Aucune tâche en cours</div>
            </div>
          ) : (
            <>
              {completedTasksCount > 0 && (
                <div className="p-3 pb-0 border-b border-gray-100">
                  <div className="flex justify-end">
                    <button
                      onClick={clearCompletedTasks}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded"
                    >
                      Effacer terminées ({completedTasksCount})
                    </button>
                  </div>
                </div>
              )}

              <div>
                {sortedTasks.map(task => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onCancel={cancelTask}
                    compact={true}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <div
                className={`w-2 h-2 rounded-full ${isApiSyncEnabled ? 'bg-green-500' : 'bg-orange-500'}`}
                title={isApiSyncEnabled ? 'Sync inter-appareils actif' : 'Sync local uniquement'}
              />
              <span>{isApiSyncEnabled ? 'Cloud' : 'Local'}</span>
            </div>
            <div>Total: {tasks.length}</div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
