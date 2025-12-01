"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import Modal from "./ui/Modal";
import DonutProgress from "./ui/DonutProgress";
import { useBackgroundTasks } from "@/components/BackgroundTasksProvider";
import { sortTasksForDisplay } from "@/lib/backgroundTasks/sortTasks";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { emitOnboardingEvent, ONBOARDING_EVENTS } from "@/lib/onboarding/onboardingEvents";
import { useTaskProgress } from "@/hooks/useTaskProgress";

/**
 * Indicateur de progression pour les tâches en cours
 * Affiche un donut avec le pourcentage basé sur le temps estimé
 * Disparaît après l'animation de completion pour afficher le status texte
 */
function TaskProgressIndicator({ task, onComplete }) {
  const [showDonut, setShowDonut] = React.useState(true);
  const { progress } = useTaskProgress({
    taskId: task.id,
    taskType: task.type,
    taskStatus: task.status,
    startTime: Number(task.createdAt),
    payload: task.payload,
  });

  // Quand progress atteint 100% et tâche completed, attendre puis masquer
  React.useEffect(() => {
    if (progress >= 100 && task.status === 'completed') {
      const timer = setTimeout(() => {
        setShowDonut(false);
        onComplete?.();
      }, 600); // 600ms pour laisser voir le 100%
      return () => clearTimeout(timer);
    }
  }, [progress, task.status, onComplete]);

  if (!showDonut) return null;

  return (
    <DonutProgress
      progress={progress}
      size={28}
      strokeWidth={3}
      showPercent={false}
    />
  );
}

function extractQuotedName(text) {
  if (typeof text !== 'string') return '';
  const match = text.match(/'([^']+)'/);
  return match ? match[1] : '';
}

function TaskItem({ task, onCancel, onTaskClick }) {
  const { t } = useLanguage();
  const [showProgressDonut, setShowProgressDonut] = React.useState(task.status === 'running');

  // Réinitialiser showProgressDonut quand la tâche passe à running
  React.useEffect(() => {
    if (task.status === 'running') {
      setShowProgressDonut(true);
    }
  }, [task.status]);

  const getStatusDisplay = (status) => {
    const colors = {
      'queued': 'text-white/70 drop-shadow',
      'running': 'text-blue-300 drop-shadow',
      'completed': 'text-green-400 drop-shadow',
      'failed': 'text-red-400 drop-shadow',
      'cancelled': 'text-red-300 drop-shadow'
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
  let errorRedirectUrl = null;

  if (task.status === 'failed' && task.error) {
    // Try to parse error for actionRequired/redirectUrl
    try {
      const errorData = typeof task.error === 'string' ? JSON.parse(task.error) : task.error;
      if (errorData?.error) {
        description = errorData.error;
        if (errorData.actionRequired && errorData.redirectUrl) {
          errorRedirectUrl = errorData.redirectUrl;
        }
      } else {
        description = task.error;
      }
    } catch {
      description = task.error;
    }
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
    console.error('[TaskItem] Erreur extraction cvFileName:', err);
  }

  const isClickable = task.status === 'completed' && !!cvFileName;

  const handleClick = () => {
    console.log('[TaskItem] Click détecté:', {
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
      className={`flex items-center justify-between p-3 border border-white/20 rounded-lg bg-white/5 ${isClickable ? 'cursor-pointer hover:bg-white/10 transition-all duration-200' : ''}`}
      onClick={handleClick}
    >
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
        {/* Show action button if error has redirectUrl */}
        {task.status === 'failed' && errorRedirectUrl && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(errorRedirectUrl);
            }}
            className="mt-2 px-3 py-1 rounded-lg text-xs font-semibold bg-red-500/30 hover:bg-red-500/40 border border-red-500/50 text-white transition-all duration-200 inline-flex items-center gap-1"
          >
            {t("subscription.viewOptions") || "Voir les options"}
            <span className="text-base">→</span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 ml-4">
        {showProgressDonut && (task.status === 'running' || task.status === 'completed') ? (
          <TaskProgressIndicator task={task} onComplete={() => setShowProgressDonut(false)} />
        ) : (
          <span className={`text-sm font-medium ${statusDisplay.color}`}>
            {statusDisplay.label}
          </span>
        )}
        {canCancel && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancel(task.id);
            }}
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
  const router = useRouter();
  const { tasks, clearCompletedTasks, cancelTask, isApiSyncEnabled } = useBackgroundTasks();

  // Émettre l'événement onboarding quand le modal s'ouvre (pour valider l'étape 3)
  useEffect(() => {
    if (open) {
      console.log('[TaskQueueModal] Modal ouvert, émission task_manager_opened');
      emitOnboardingEvent(ONBOARDING_EVENTS.TASK_MANAGER_OPENED);
    }
  }, [open]);

  // Filtrer les tâches de calcul de match score (elles ne doivent apparaître que dans l'animation du bouton)
  const visibleTasks = tasks.filter(task => task.type !== 'calculate-match-score');

  // Sort tasks so running ones appear first (newest to oldest) and limit to 8
  const sortedTasks = sortTasksForDisplay(visibleTasks).slice(0, 8);

  const completedTasksCount = visibleTasks.filter(task =>
    task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'
  ).length;

  const handleTaskClick = async (cvFile) => {
    console.log('[TaskQueueModal] Click sur tâche avec CV:', cvFile);

    if (!cvFile) {
      console.warn('[TaskQueueModal] Pas de fichier CV associé');
      return;
    }

    // Définir le cookie pour le CV sélectionné
    document.cookie = "cvFile=" + encodeURIComponent(cvFile) + "; path=/; max-age=31536000";
    console.log('[TaskQueueModal] Cookie défini:', cvFile);

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

    console.log('[TaskQueueModal] CV chargé sans rechargement complet');

    // Fermer le modal après le chargement
    onClose();
  };

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
            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
              {sortedTasks.map(task => (
                <TaskItem key={task.id} task={task} onCancel={cancelTask} onTaskClick={handleTaskClick} />
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t border-white/10 text-xs text-white/70">
          <div className="flex items-center gap-1">
            <div
              className={`w-2 h-2 rounded-full ${isApiSyncEnabled ? 'bg-green-400' : 'bg-orange-400'}`}
              title={isApiSyncEnabled ? t("taskQueue.cloudSyncActive") : t("taskQueue.localSyncOnly")}
            />
            <span>{isApiSyncEnabled ? t("taskQueue.cloud") : t("taskQueue.localStorage")}</span>
          </div>
          <div>{t("taskQueue.total")}: {tasks.length}</div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
