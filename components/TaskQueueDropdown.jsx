"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useBackgroundTasks } from "@/components/BackgroundTasksProvider";
import { sortTasksForDisplay } from "@/lib/backgroundTasks/sortTasks";
import { useLanguage } from "@/lib/i18n/LanguageContext";

function LoadingSpinner() {
  return (
    <div className="animate-apple-spin h-3 w-3 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
  );
}

function TaskItem({ task, onCancel, compact = false }) {
  const { t } = useLanguage();

  const getStatusDisplay = (status) => {
    const colors = {
      'queued': 'text-gray-600',
      'running': 'text-blue-600',
      'completed': 'text-green-600',
      'failed': 'text-red-600',
      'cancelled': 'text-orange-600'
    };

    return {
      label: t(`taskQueue.status.${status}`) || t("taskQueue.status.unknown"),
      color: colors[status] || 'text-gray-400'
    };
  };

  const statusDisplay = getStatusDisplay(task.status);
  const locale = t("common.locale") || 'fr-FR'; // fr-FR ou en-US
  const createdAt = new Date(task.createdAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  });

  const canCancel = task.status === 'queued' || task.status === 'running';

  // Extraire le lien ou la pièce jointe du payload
  const payload = task?.payload && typeof task.payload === 'object' ? task.payload : null;

  // Helper to extract quoted name
  const extractQuotedName = (text) => {
    if (typeof text !== 'string') return '';
    const match = text.match(/'([^']+)'/);
    return match ? match[1] : '';
  };

  const importName = payload?.savedName || extractQuotedName(task.title);
  const generationName = payload?.baseFileLabel || payload?.baseFile || extractQuotedName(task.title);

  // Generate translated description
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

  let sourceInfo = null;
  if (task.type === 'generation' && payload) {
    if (Array.isArray(payload.links) && payload.links.length > 0) {
      sourceInfo = payload.links[0];
    } else if (Array.isArray(payload.uploads) && payload.uploads.length > 0) {
      sourceInfo = payload.uploads[0].name;
    }
  } else if (task.type === 'import' && payload?.savedName) {
    sourceInfo = payload.savedName;
  }
  const hasSourceInfo = (task.type === 'generation' || task.type === 'import') && sourceInfo;

  return (
    <div className={`flex items-center justify-between ${compact ? 'p-2' : 'p-3'} border-b border-gray-100 last:border-b-0 hover:bg-gray-50`}>
      <div className="flex-1 min-w-0 mr-2">
        <div className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-gray-900 truncate`}>
          {description}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>{createdAt}</span>
          {hasSourceInfo && (
            <>
              <span className="text-gray-400">•</span>
              <span className="truncate" title={sourceInfo}>
                {sourceInfo}
              </span>
            </>
          )}
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
            title={t("taskQueue.cancelTask")}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export default function TaskQueueDropdown({ isOpen, onClose, className = "", buttonRef }) {
  const { t } = useLanguage();
  const { tasks, clearCompletedTasks, cancelTask, isApiSyncEnabled } = useBackgroundTasks();
  const [dropdownPosition, setDropdownPosition] = React.useState({ top: 0, right: 0 });

  // Filtrer les tâches de calcul de match score (elles ne doivent apparaître que dans l'animation du bouton)
  const visibleTasks = tasks.filter(task => task.type !== 'calculate-match-score');

  // Sort tasks so running ones appear first (newest to oldest) and limit to 8
  const sortedTasks = sortTasksForDisplay(visibleTasks).slice(0, 8);

  const completedTasksCount = visibleTasks.filter(task =>
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
        className="fixed inset-0 z-[10000] bg-transparent"
        onClick={onClose}
      />

      {/* Dropdown content */}
      <div
        className={`fixed w-96 bg-white border border-gray-200 rounded-lg shadow-xl z-[10001] ${className}`}
        style={{
          top: `${dropdownPosition.top}px`,
          right: `${dropdownPosition.right}px`
        }}
      >
        <div className="max-h-80 overflow-y-auto">
          {sortedTasks.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <div className="text-sm">{t("taskQueue.noTasks")}</div>
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
                      {t("taskQueue.clearCompleted")} ({completedTasksCount})
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
                title={isApiSyncEnabled ? t("taskQueue.cloudSyncActive") : t("taskQueue.localSyncOnly")}
              />
              <span>{isApiSyncEnabled ? t("taskQueue.cloud") : t("taskQueue.localStorage")}</span>
            </div>
            <div>{t("taskQueue.total")}: {visibleTasks.length}</div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
