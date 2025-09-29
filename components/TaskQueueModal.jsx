"use client";

import React from "react";
import Modal from "./ui/Modal";
import { useBackgroundTasks } from "@/components/BackgroundTasksProvider";
import { sortTasksForDisplay } from "@/lib/backgroundTasks/sortTasks";

function LoadingSpinner() {
  return (
    <div className="animate-apple-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
  );
}

function extractQuotedName(text) {
  if (typeof text !== 'string') return '';
  const match = text.match(/'([^']+)'/);
  return match ? match[1] : '';
}

function TaskItem({ task, onCancel }) {
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
    minute: '2-digit',
    second: '2-digit'
  });

  const canCancel = task.status === 'queued' || task.status === 'running';

  const payload = task?.payload && typeof task.payload === 'object' ? task.payload : null;

  const importName = payload?.savedName || extractQuotedName(task.title);
  const generationName = payload?.baseFileLabel || payload?.baseFile || extractQuotedName(task.title);

  let description = task.title || 'Tâche';

  if (task.status === 'failed' && task.error) {
    description = task.error;
  } else if (task.type === 'import') {
    if (task.status === 'running') {
      description = `Import en cours${importName ? ` : '${importName}'` : ''}`;
    } else if (task.status === 'queued') {
      description = `Import en attente${importName ? ` : '${importName}'` : ''}`;
    }
  } else if (task.type === 'generation') {
    if (task.status === 'running') {
      description = `Création en cours${generationName ? ` : '${generationName}'` : ''}`;
    } else if (task.status === 'queued') {
      description = `Création en attente${generationName ? ` : '${generationName}'` : ''}`;
    }
  }

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-gray-900 truncate">
            {description}
          </div>
        </div>
        <div className="text-xs text-gray-500">
          Créé à {createdAt}
        </div>
      </div>
      <div className="flex items-center gap-2 ml-4">
        {task.status === 'running' && <LoadingSpinner />}
        <span className={`text-sm font-medium ${statusDisplay.color}`}>
          {statusDisplay.label}
        </span>
        {canCancel && (
          <button
            type="button"
            onClick={() => onCancel(task.id)}
            className="ml-2 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded"
            title="Annuler la tâche"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export default function TaskQueueModal({ open, onClose }) {
  const { tasks, clearCompletedTasks, cancelTask, isApiSyncEnabled } = useBackgroundTasks();

  // Sort tasks so running ones appear first (newest to oldest) and limit to 8
  const sortedTasks = sortTasksForDisplay(tasks).slice(0, 8);

  const completedTasksCount = tasks.filter(task =>
    task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'
  ).length;

  return (
    <Modal open={open} onClose={onClose} title="File d'attente des tâches">
      <div className="space-y-4">
        {sortedTasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-sm">Aucune tâche en cours</div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-gray-700">
                Tâches ({sortedTasks.length}{tasks.length > 8 ? ` sur ${tasks.length}` : ''})
              </div>
              {completedTasksCount > 0 && (
                <button
                  onClick={clearCompletedTasks}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Effacer terminées ({completedTasksCount})
                </button>
              )}
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {sortedTasks.map(task => (
                <TaskItem key={task.id} task={task} onCancel={cancelTask} />
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div
              className={`w-2 h-2 rounded-full ${isApiSyncEnabled ? 'bg-green-500' : 'bg-orange-500'}`}
              title={isApiSyncEnabled ? 'Synchronisation Cloud active' : 'Sync local uniquement'}
            />
            <span>{isApiSyncEnabled ? 'Cloud' : 'Stockage Local'}</span>
          </div>
          <div>Total: {tasks.length}</div>
          <button
            onClick={onClose}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </Modal>
  );
}
