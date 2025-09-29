"use client";

import React from "react";
import Modal from "./ui/Modal";
import { useBackgroundTasks } from "@/components/BackgroundTasksProvider";

function LoadingSpinner() {
  return (
    <div className="animate-apple-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
  );
}

function TaskItem({ task, onCancel, onRemovePhantom, localDeviceId }) {
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

  // Detect potential phantom tasks (running without execute function after page refresh)
  const isOwnedByLocalDevice = task.deviceId ? task.deviceId === localDeviceId : Boolean(task.execute);
  const isPhantomTask = isOwnedByLocalDevice && task.status === 'running' && !task.execute;

  return (
    <div className={`flex items-center justify-between p-3 border rounded-lg ${isPhantomTask ? 'bg-orange-50 border-orange-200' : 'bg-gray-50'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-gray-900 truncate">
            {task.title}
          </div>
          {isPhantomTask && (
            <span className="text-xs bg-orange-100 text-orange-700 px-1 rounded" title="Tâche fantôme - pas de contrôle local">
              👻
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          Créé à {createdAt}
          {isPhantomTask && <span className="text-orange-600 ml-2">(Fantôme)</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 ml-4">
        {task.status === 'running' && !isPhantomTask && <LoadingSpinner />}
        {isPhantomTask && <span className="text-xs text-orange-600">⚠️</span>}
        <span className={`text-sm font-medium ${statusDisplay.color}`}>
          {statusDisplay.label}
        </span>
        {canCancel && !isPhantomTask && (
          <button
            onClick={() => onCancel(task.id)}
            className="ml-2 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded"
            title="Annuler la tâche"
          >
            ✕
          </button>
        )}
        {isPhantomTask && (
          <button
            onClick={() => onRemovePhantom(task.id)}
            className="ml-2 text-xs text-orange-600 hover:text-orange-800 hover:bg-orange-100 px-2 py-1 rounded"
            title="Nettoyer la tâche fantôme"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}

export default function TaskQueueModal({ open, onClose }) {
  const { tasks, clearCompletedTasks, addTask, cancelTask, isApiSyncEnabled, removePhantomTask, localDeviceId } = useBackgroundTasks();

  // Debug function to add test tasks
  const addTestTask = () => {
    const taskNumber = tasks.length + 1;
    addTask({
      title: `Test d'importation CV 'test-${taskNumber}.pdf' en cours ...`,
      successMessage: `CV 'test-${taskNumber}.pdf' importé avec succès`,
      type: 'import',
      shouldUpdateCvList: false,
      execute: (abortSignal, taskId) => new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => resolve({}), 5000);
        abortSignal?.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new Error('Task cancelled'));
        });
      })
    });
  };

  const addMultipleTestTasks = () => {
    for (let i = 0; i < 6; i++) {
      setTimeout(() => addTestTask(), i * 100);
    }
  };

  // Sort tasks by creation time (most recent first) and limit to 8
  const sortedTasks = [...tasks]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8);

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
                <TaskItem key={task.id} task={task} onCancel={cancelTask} onRemovePhantom={removePhantomTask} localDeviceId={localDeviceId} />
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="hidden md:flex gap-2">
            <button
              onClick={addTestTask}
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50 bg-blue-50 text-blue-600"
            >
              + 1 Test
            </button>
            <button
              onClick={addMultipleTestTasks}
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50 bg-purple-50 text-purple-600"
            >
              + 6 Tests
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <div
                className={`w-2 h-2 rounded-full ${isApiSyncEnabled ? 'bg-green-500' : 'bg-orange-500'}`}
                title={isApiSyncEnabled ? 'Sync inter-appareils actif' : 'Sync local uniquement'}
              />
              <span>{isApiSyncEnabled ? 'Synchronisation Cloud' : 'Stockage Local'}</span>
            </div>
            <div>Total: {tasks.length}</div>
          </div>
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
