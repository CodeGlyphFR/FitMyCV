"use client";

import React from "react";
import Modal from "./ui/Modal";
import { useBackgroundTasks } from "@/components/BackgroundTasksProvider";
import { sortTasksForDisplay } from "@/lib/backgroundTasks/sortTasks";
import { useLanguage } from "@/lib/i18n/LanguageContext";

function LoadingSpinner() {
  return (
    <div className="animate-apple-spin h-4 w-4 border-2 border-white/30 border-t-amber-300 rounded-full drop-shadow"></div>
  );
}

function extractQuotedName(text) {
  if (typeof text !== 'string') return '';
  const match = text.match(/'([^']+)'/);
  return match ? match[1] : '';
}

function TaskItem({ task, onCancel }) {
  const { t } = useLanguage();

  const getStatusDisplay = (status) => {
    const colors = {
      'queued': 'text-white/70 drop-shadow',
      'running': 'text-amber-300 drop-shadow',
      'completed': 'text-green-400 drop-shadow',
      'failed': 'text-red-400 drop-shadow',
      'cancelled': 'text-orange-400 drop-shadow'
    };

    return {
      label: t(`taskQueue.status.${status}`) || t("taskQueue.status.unknown"),
      color: colors[status] || 'text-white/60 drop-shadow'
    };
  };

  const statusDisplay = getStatusDisplay(task.status);
  const locale = t("common.locale") || 'fr-FR'; // fr-FR ou en-US
  const createdAt = new Date(task.createdAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  });

  const canCancel = task.status === 'queued' || task.status === 'running';

  const payload = task?.payload && typeof task.payload === 'object' ? task.payload : null;

  const importName = payload?.savedName || extractQuotedName(task.title);
  const generationName = payload?.baseFileLabel || payload?.baseFile || extractQuotedName(task.title);

  let description = task.title || t("taskQueue.messages.task");

  if (task.status === 'failed' && task.error) {
    description = task.error;
  } else if (task.type === 'import') {
    if (task.status === 'running') {
      description = t("taskQueue.messages.importInProgress");
    } else if (task.status === 'queued') {
      description = t("taskQueue.messages.importQueued");
    } else if (task.status === 'completed') {
      description = t("taskQueue.messages.importCompleted");
    } else if (task.status === 'cancelled') {
      description = t("taskQueue.messages.importCancelled");
    } else if (task.status === 'failed') {
      description = t("taskQueue.messages.importFailed");
    }
  } else if (task.type === 'generation') {
    if (task.status === 'running') {
      description = `${t("taskQueue.messages.creationInProgress")}${generationName ? ` : '${generationName}'` : ''}`;
    } else if (task.status === 'queued') {
      description = `${t("taskQueue.messages.creationQueued")}${generationName ? ` : '${generationName}'` : ''}`;
    } else if (task.status === 'completed') {
      description = `${t("taskQueue.messages.creationCompleted")}${generationName ? ` : '${generationName}'` : ''}`;
    } else if (task.status === 'cancelled') {
      description = `${t("taskQueue.messages.creationCancelled")}${generationName ? ` : '${generationName}'` : ''}`;
    } else if (task.status === 'failed') {
      description = `${t("taskQueue.messages.creationFailed")}${generationName ? ` : '${generationName}'` : ''}`;
    }
  } else if (task.type === 'template-creation') {
    if (task.status === 'running') {
      description = t("taskQueue.messages.templateCreationInProgress");
    } else if (task.status === 'queued') {
      description = t("taskQueue.messages.templateCreationQueued");
    } else if (task.status === 'completed') {
      description = t("taskQueue.messages.templateCreationCompleted");
    } else if (task.status === 'cancelled') {
      description = t("taskQueue.messages.templateCreationCancelled");
    } else if (task.status === 'failed') {
      description = t("taskQueue.messages.templateCreationFailed");
    }
  }
  // Note: Les tâches 'calculate-match-score' sont filtrées et n'apparaissent pas dans le gestionnaire

  // Extraire le lien ou la pièce jointe du payload
  let sourceInfo = null;
  if ((task.type === 'generation' || task.type === 'template-creation') && payload) {
    if (Array.isArray(payload.links) && payload.links.length > 0) {
      sourceInfo = payload.links[0];
    } else if (Array.isArray(payload.uploads) && payload.uploads.length > 0) {
      sourceInfo = payload.uploads[0].name;
    }
  } else if (task.type === 'import' && payload?.savedName) {
    sourceInfo = payload.savedName;
  }
  const hasSourceInfo = (task.type === 'generation' || task.type === 'template-creation' || task.type === 'import') && sourceInfo;

  return (
    <div className="flex items-center justify-between p-3 border-2 border-white/30 rounded-lg bg-white/10 backdrop-blur-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-white drop-shadow truncate">
            {description}
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-white/60 drop-shadow">
          <span>{createdAt}</span>
          {hasSourceInfo && (
            <>
              <span className="text-white/40">•</span>
              <span className="truncate" title={sourceInfo}>
                {sourceInfo}
              </span>
            </>
          )}
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
            className="ml-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20 px-2 py-1 rounded transition-all duration-200 drop-shadow"
            title={t("taskQueue.cancelTask")}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export default function TaskQueueModal({ open, onClose }) {
  const { t } = useLanguage();
  const { tasks, clearCompletedTasks, cancelTask, isApiSyncEnabled } = useBackgroundTasks();

  // Filtrer les tâches de calcul de match score (elles ne doivent apparaître que dans l'animation du bouton)
  const visibleTasks = tasks.filter(task => task.type !== 'calculate-match-score');

  // Sort tasks so running ones appear first (newest to oldest) and limit to 8
  const sortedTasks = sortTasksForDisplay(visibleTasks).slice(0, 8);

  const completedTasksCount = visibleTasks.filter(task =>
    task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'
  ).length;

  return (
    <Modal open={open} onClose={onClose} title={t("taskQueue.title")}>
      <div className="space-y-4">
        {sortedTasks.length === 0 ? (
          <div className="text-center py-8 text-white/60 drop-shadow">
            <div className="text-sm">{t("taskQueue.noTasks")}</div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-white drop-shadow">
                {t("taskQueue.tasks")} ({sortedTasks.length}{visibleTasks.length > 8 ? ` ${t("taskQueue.of")} ${visibleTasks.length}` : ''})
              </div>
              {completedTasksCount > 0 && (
                <button
                  onClick={clearCompletedTasks}
                  className="text-xs text-emerald-400 hover:text-emerald-300 drop-shadow transition-colors duration-200"
                >
                  {t("taskQueue.clearCompleted")} ({completedTasksCount})
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

        <div className="flex justify-between items-center pt-4 border-t border-white/30 text-xs text-white/70 drop-shadow">
          <div className="flex items-center gap-1">
            <div
              className={`w-2 h-2 rounded-full drop-shadow ${isApiSyncEnabled ? 'bg-green-400' : 'bg-orange-400'}`}
              title={isApiSyncEnabled ? t("taskQueue.cloudSyncActive") : t("taskQueue.localSyncOnly")}
            />
            <span>{isApiSyncEnabled ? t("taskQueue.cloud") : t("taskQueue.localStorage")}</span>
          </div>
          <div>{t("taskQueue.total")}: {tasks.length}</div>
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm font-medium text-white bg-white/20 border-2 border-white/40 rounded-lg hover:bg-white/30 backdrop-blur-sm transition-all duration-200 drop-shadow"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
