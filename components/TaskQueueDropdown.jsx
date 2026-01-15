"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import PipelineTaskProgress from "./ui/PipelineTaskProgress";
import GenericTaskProgressBar from "./ui/GenericTaskProgressBar";
import { useBackgroundTasks } from "@/components/BackgroundTasksProvider";
import { usePipelineProgressContext } from "@/components/PipelineProgressProvider";
import { sortTasksForDisplay } from "@/lib/backgroundTasks/sortTasks";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { ONBOARDING_EVENTS, emitOnboardingEvent } from "@/lib/onboarding/onboardingEvents";

/**
 * Indicateur de progression pour les tâches cv_generation_v2 (version compact)
 * Affiche les lignes de progression par offre
 * Note: Ne se cache pas quand terminé car il affiche le contenu complet de la ligne
 */
function PipelineProgressIndicator({ task }) {
  const { t } = useLanguage();

  // Extraire les infos du payload pour multi-offres
  const payload = task?.payload && typeof task.payload === 'object' ? task.payload : null;
  const totalOffers = payload?.totalOffers || 1;
  const sourceUrl = payload?.url || null;

  // Formater l'heure
  const locale = t("common.locale") || 'fr-FR';
  const createdAt = new Date(task.createdAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <PipelineTaskProgress
      taskId={task.id}
      totalOffers={totalOffers}
      createdAt={createdAt}
      taskStatus={task.status}
      taskTitle={task.title}
      sourceUrl={sourceUrl}
      className="w-full"
    />
  );
}

function TaskItem({ task, onCancel, onTaskClick, compact = false }) {
  const { t } = useLanguage();
  const { getProgress } = usePipelineProgressContext();

  const locale = t("common.locale") || 'fr-FR'; // fr-FR ou en-US
  const createdAt = new Date(task.createdAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Pour cv_generation_v2, utiliser le statut SSE s'il est disponible (plus à jour que le polling)
  let effectiveStatus = task.status;
  if (task.type === 'cv_generation_v2') {
    const sseProgress = getProgress(task.id);
    if (sseProgress?.status && sseProgress.status !== 'running') {
      effectiveStatus = sseProgress.status;
    }
  }

  const canCancel = effectiveStatus === 'queued' || effectiveStatus === 'running';

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
    // Essayer de parser comme JSON avec clé de traduction
    try {
      const errorData = JSON.parse(task.error);
      // Cas 1: Clé de traduction avec source (taskQueue.errors.*)
      if (errorData.translationKey?.startsWith('taskQueue.errors.')) {
        description = t(errorData.translationKey, { source: errorData.source || '' });
      }
      // Cas 2: Clé de traduction générique (errors.*)
      else if (errorData.translationKey?.startsWith('errors.')) {
        description = t(errorData.translationKey);
      } else {
        description = task.error;
      }
    } catch {
      // Si c'est une clé de traduction directe (string)
      if (typeof task.error === 'string' && task.error.startsWith('errors.')) {
        description = t(task.error);
      } else {
        description = task.error;
      }
    }
  } else if (task.type === 'import') {
    // Utiliser task.title qui contient le nom du fichier PDF
    description = task.title || importName || t("taskQueue.messages.importInProgress");
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
    // Utiliser task.title qui contient le titre de l'offre ou le lien
    description = task.title || t("taskQueue.messages.templateCreationInProgress");
  } else if (task.type === 'cv_generation_v2') {
    const totalOffers = payload?.totalOffers || 1;
    const offersLabel = totalOffers > 1 ? ` (${totalOffers} ${t("taskQueue.messages.offers")})` : '';
    if (task.status === 'running') {
      description = t("taskQueue.messages.pipelineInProgress") + offersLabel;
    } else if (task.status === 'queued') {
      description = t("taskQueue.messages.pipelineQueued") + offersLabel;
    } else if (task.status === 'completed') {
      description = t("taskQueue.messages.pipelineCompleted") + offersLabel;
    } else if (task.status === 'cancelled') {
      description = t("taskQueue.messages.pipelineCancelled") + offersLabel;
    } else if (task.status === 'failed') {
      description = t("taskQueue.messages.pipelineFailed") + offersLabel;
    }
  }
  // Note: Les tâches 'calculate-match-score' sont filtrées et n'apparaissent pas dans le gestionnaire

  // Déterminer si la tâche a un CV associé
  let cvFileName = null;

  // Vérifier d'abord le champ cvFile (pour calculate-match-score et improve-cv)
  try {
    if (task.cvFile) {
      cvFileName = task.cvFile;
    }
    // Sinon vérifier le result (pour generation, import, template-creation, cv_generation_v2)
    else if (task.result && task.status === 'completed') {
      // task.result est déjà un objet (parsé par l'API)
      const result = typeof task.result === 'string' ? JSON.parse(task.result) : task.result;
      // cv_generation_v2 utilise 'filename', les autres utilisent 'file' ou 'files'
      cvFileName = result.filename || result.file || (result.files && result.files.length > 0 ? result.files[0] : null);
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

  // Layout spécial pour cv_generation_v2 : PipelineProgressIndicator prend toute la largeur
  if (task.type === 'cv_generation_v2') {
    return (
      <div
        className={`${compact ? 'px-2 py-1' : 'px-3 py-2'} border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors duration-200 ${isClickable ? 'cursor-pointer' : ''}`}
        onClick={handleClick}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <PipelineProgressIndicator task={task} />
          </div>
          {canCancel && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel(task.id);
              }}
              className="text-xs text-red-400/70 hover:text-red-300 hover:bg-red-500/20 px-1 py-0.5 rounded-sm transition-colors duration-200 mt-1 flex-shrink-0"
              title={t("taskQueue.cancelTask")}
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  }

  // Layout standard pour les autres types de tâches - utilise le même style que le pipeline
  return (
    <div
      className={`${compact ? 'px-2 py-1' : 'px-3 py-2'} border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors duration-200 ${isClickable ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <GenericTaskProgressBar
            task={task}
            description={description}
            createdAt={createdAt}
            className="w-full"
          />
        </div>
        {canCancel && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel(task.id);
            }}
            className="text-xs text-red-400/70 hover:text-red-300 hover:bg-red-500/20 px-1 py-0.5 rounded-sm transition-colors duration-200 mt-1 flex-shrink-0"
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
  const { tasks, clearCompletedTasks, cancelTask } = useBackgroundTasks();
  const [dropdownPosition, setDropdownPosition] = React.useState({ top: 0, left: 0 });
  const dropdownRef = React.useRef(null);

  // Filtrer les tâches de calcul de match score (complètement transparentes - le bouton MatchScore a sa propre animation)
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

  // Émettre l'événement task_manager_opened pour l'onboarding
  React.useEffect(() => {
    if (isOpen) {
      console.log('[TaskQueueDropdown] Dropdown ouvert, émission task_manager_opened');
      emitOnboardingEvent(ONBOARDING_EVENTS.TASK_MANAGER_OPENED);
    }
  }, [isOpen]);

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

  // Click outside handler
  React.useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        buttonRef?.current &&
        !buttonRef.current.contains(event.target)
      ) {
        onClose();
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose, buttonRef]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      className={`fixed w-96 bg-white/15 backdrop-blur-md border-2 border-white/30 rounded-lg shadow-2xl z-[10001] gpu-accelerate ${className}`}
      style={{
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`
      }}
      >
        <div className="max-h-80 overflow-y-auto custom-scrollbar">
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
                      className="text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 px-2 py-1 rounded-sm transition-colors duration-200"
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
          <div className="flex items-center justify-center text-xs text-white/70 drop-shadow">
            <div>{t("taskQueue.total")}: {visibleTasks.length}</div>
          </div>
        </div>
    </div>,
    document.body
  );
}
