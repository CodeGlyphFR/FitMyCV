"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useBackgroundTasks } from "@/components/BackgroundTasksProvider";
import { sortTasksForDisplay } from "@/lib/backgroundTasks/sortTasks";
import { useLanguage } from "@/lib/i18n/LanguageContext";

function LoadingSpinner() {
  return (
    <div className="animate-apple-spin h-3 w-3 border-2 border-white/30 border-t-blue-300 rounded-full drop-shadow"></div>
  );
}

function TaskItem({ task, onCancel, onTaskClick, compact = false }) {
  const { t } = useLanguage();

  const getStatusDisplay = (status) => {
    const colors = {
      'queued': 'text-white/70',
      'running': 'text-blue-300',
      'completed': 'text-green-400',
      'failed': 'text-red-400',
      'cancelled': 'text-red-300'
    };

    return {
      label: t(`taskQueue.status.${status}`) || t("taskQueue.status.unknown"),
      color: colors[status] || 'text-white/60'
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

  // Déterminer si la tâche a un CV associé
  let cvFileName = null;

  // Vérifier d'abord le champ cvFile (pour calculate-match-score et improve-cv)
  try {
    if (task.cvFile) {
      cvFileName = task.cvFile;
    }
    // Sinon vérifier le result (pour generation, import, template-creation)
    else if (task.result && task.status === 'completed') {
      // task.result est déjà un objet (parsé par l'API)
      const result = typeof task.result === 'string' ? JSON.parse(task.result) : task.result;
      cvFileName = result.file || (result.files && result.files.length > 0 ? result.files[0] : null);
    }
  } catch (err) {
    console.error('[TaskItem Dropdown] Erreur extraction cvFileName:', err);
  }

  const isClickable = task.status === 'completed' && !!cvFileName;

  const handleClick = () => {
    console.log('[TaskItem Dropdown] Click détecté:', {
      isClickable,
      cvFileName,
      taskStatus: task.status,
      taskType: task.type,
      hasCvFile: !!task.cvFile,
      cvFileValue: task.cvFile,
      hasResult: !!task.result,
      resultValue: task.result
    });
    if (isClickable && onTaskClick) {
      onTaskClick(cvFileName);
    }
  };

  return (
    <div
      className={`flex items-center justify-between ${compact ? 'p-2' : 'p-3'} border-b border-white/10 last:border-b-0 hover:bg-white/20 transition-colors duration-200 ${isClickable ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <div className="flex-1 min-w-0 mr-2">
        <div className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-white truncate drop-shadow`}>
          {description}
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
      <div className="flex items-center gap-2">
        {task.status === 'running' && <LoadingSpinner />}
        <span className={`text-xs font-medium ${statusDisplay.color} drop-shadow`}>
          {statusDisplay.label}
        </span>
        {canCancel && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel(task.id);
            }}
            className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20 px-1 py-0.5 rounded transition-colors duration-200"
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
  const router = useRouter();
  const { tasks, clearCompletedTasks, cancelTask, isApiSyncEnabled } = useBackgroundTasks();
  const [dropdownPosition, setDropdownPosition] = React.useState({ top: 0, left: 0 });

  // Filtrer les tâches de calcul de match score (elles ne doivent apparaître que dans l'animation du bouton)
  const visibleTasks = tasks.filter(task => task.type !== 'calculate-match-score');

  // Sort tasks so running ones appear first (newest to oldest) and limit to 8
  const sortedTasks = sortTasksForDisplay(visibleTasks).slice(0, 8);

  const completedTasksCount = visibleTasks.filter(task =>
    task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'
  ).length;

  const handleTaskClick = async (cvFile) => {
    console.log('[TaskQueueDropdown] Click sur tâche avec CV:', cvFile);

    if (!cvFile) {
      console.warn('[TaskQueueDropdown] Pas de fichier CV associé');
      return;
    }

    // Définir le cookie pour le CV sélectionné
    document.cookie = "cvFile=" + encodeURIComponent(cvFile) + "; path=/; max-age=31536000";
    console.log('[TaskQueueDropdown] Cookie défini:', cvFile);

    try {
      localStorage.setItem("admin:cv", cvFile);
    } catch (_err) {}

    // Rafraîchir Next.js sans recharger toute la page
    router.refresh();

    // Déclencher les événements pour mettre à jour l'UI
    if (typeof window !== "undefined") {
      // Petit délai pour laisser router.refresh() se propager
      setTimeout(() => {
        window.dispatchEvent(new Event("cv:list:changed"));
        window.dispatchEvent(new CustomEvent("cv:selected", { detail: { file: cvFile, source: 'task-queue' } }));
      }, 50);
    }

    console.log('[TaskQueueDropdown] CV chargé sans rechargement complet');

    // Fermer le dropdown après le chargement
    onClose();
  };

  // Calculate position when dropdown opens
  React.useEffect(() => {
    if (isOpen && buttonRef?.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 384; // w-96 = 24rem = 384px
      const viewportWidth = window.innerWidth;

      // Align left edge of dropdown with left edge of button
      let leftPos = rect.left;

      // Check if dropdown would overflow on the right side
      const rightEdge = leftPos + dropdownWidth;
      if (rightEdge > viewportWidth - 8) { // 8px minimum margin
        // Adjust position to prevent overflow
        leftPos = viewportWidth - dropdownWidth - 8;
      }

      setDropdownPosition({
        top: rect.bottom + 8,
        left: Math.max(8, leftPos)
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
        className={`fixed w-96 bg-white/15 backdrop-blur-xl border-2 border-white/30 rounded-lg shadow-2xl z-[10001] ${className}`}
        style={{
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`
        }}
      >
        <div className="max-h-80 overflow-y-auto">
          {sortedTasks.length === 0 ? (
            <div className="p-6 text-center text-white/70">
              <div className="text-sm drop-shadow">{t("taskQueue.noTasks")}</div>
            </div>
          ) : (
            <>
              {completedTasksCount > 0 && (
                <div className="p-3 pb-0 border-b border-white/10">
                  <div className="flex justify-end">
                    <button
                      onClick={clearCompletedTasks}
                      className="text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 px-2 py-1 rounded transition-colors duration-200"
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
                    onTaskClick={handleTaskClick}
                    compact={true}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-3 border-t border-white/20 bg-white/10 rounded-b-lg">
          <div className="flex items-center justify-between text-xs text-white/70 drop-shadow">
            <div className="flex items-center gap-1">
              <div
                className={`w-2 h-2 rounded-full drop-shadow ${isApiSyncEnabled ? 'bg-green-400' : 'bg-orange-400'}`}
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
