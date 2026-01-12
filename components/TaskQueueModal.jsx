"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import Modal from "./ui/Modal";
import PipelineTaskProgress from "./ui/PipelineTaskProgress";
import GenericTaskProgressBar from "./ui/GenericTaskProgressBar";
import { useBackgroundTasks } from "@/components/BackgroundTasksProvider";
import { sortTasksForDisplay } from "@/lib/backgroundTasks/sortTasks";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { emitOnboardingEvent, ONBOARDING_EVENTS } from "@/lib/onboarding/onboardingEvents";

/**
 * Indicateur de progression pour les tâches cv_generation_v2
 * Affiche les barres de progression par offre
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

function extractQuotedName(text) {
  if (typeof text !== 'string') return '';
  const match = text.match(/'([^']+)'/);
  return match ? match[1] : '';
}

function TaskItem({ task, onCancel, onTaskClick }) {
  const { t } = useLanguage();
  const router = useRouter();

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
    // Essayer de parser comme JSON
    try {
      const errorData = typeof task.error === 'string' ? JSON.parse(task.error) : task.error;

      // Cas 1: Clé de traduction avec source (taskQueue.errors.*)
      if (errorData?.translationKey?.startsWith('taskQueue.errors.')) {
        description = t(errorData.translationKey, { source: errorData.source || '' });
      }
      // Cas 2: Clé de traduction générique (errors.*)
      else if (errorData?.translationKey?.startsWith('errors.')) {
        description = t(errorData.translationKey);
      }
      // Cas 3: Erreur avec action requise (ex: upgrade plan)
      else if (errorData?.error) {
        description = errorData.error;
        if (errorData.actionRequired && errorData.redirectUrl) {
          errorRedirectUrl = errorData.redirectUrl;
        }
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
    const offerLabel = totalOffers > 1 ? ` (${totalOffers} ${t("taskQueue.messages.offers") || 'offres'})` : '';
    if (task.status === 'running') {
      description = `${t("taskQueue.messages.pipelineInProgress") || 'Génération CV en cours'}${offerLabel}`;
    } else if (task.status === 'queued') {
      description = `${t("taskQueue.messages.pipelineQueued") || 'Génération CV en attente'}${offerLabel}`;
    } else if (task.status === 'completed') {
      description = `${t("taskQueue.messages.pipelineCompleted") || 'Génération CV terminée'}${offerLabel}`;
    } else if (task.status === 'cancelled') {
      description = `${t("taskQueue.messages.pipelineCancelled") || 'Génération CV annulée'}${offerLabel}`;
    } else if (task.status === 'failed') {
      description = `${t("taskQueue.messages.pipelineFailed") || 'Génération CV échouée'}${offerLabel}`;
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

  // Layout spécial pour cv_generation_v2 : PipelineProgressIndicator prend toute la largeur
  if (task.type === 'cv_generation_v2') {
    return (
      <div
        className={`p-3 border border-white/20 rounded-lg bg-white/5 ${isClickable ? 'cursor-pointer hover:bg-white/10 transition-all duration-200' : ''}`}
        onClick={handleClick}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <PipelineProgressIndicator task={task} />
          </div>
          {canCancel && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancel(task.id);
              }}
              className="text-xs text-red-400/70 hover:text-red-300 hover:bg-red-500/20 px-2 py-1 rounded-sm transition-all duration-200 mt-1 flex-shrink-0"
              title={t("taskQueue.cancelTask")}
            >
              ✕
            </button>
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
    );
  }

  // Layout standard pour les autres types de tâches - utilise le même style que le pipeline
  return (
    <div
      className={`p-3 border border-white/20 rounded-lg bg-white/5 ${isClickable ? 'cursor-pointer hover:bg-white/10 transition-all duration-200' : ''}`}
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
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancel(task.id);
            }}
            className="text-xs text-red-400/70 hover:text-red-300 hover:bg-red-500/20 px-2 py-1 rounded-sm transition-all duration-200 mt-1 flex-shrink-0"
            title={t("taskQueue.cancelTask")}
          >
            ✕
          </button>
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
  );
}

export default function TaskQueueModal({ open, onClose }) {
  const { t } = useLanguage();
  const router = useRouter();
  const { tasks, clearCompletedTasks, cancelTask } = useBackgroundTasks();

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

        <div className="flex justify-center items-center pt-4 border-t border-white/10 text-xs text-white/70">
          <div>{t("taskQueue.total")}: {tasks.length}</div>
        </div>
      </div>
    </Modal>
  );
}
