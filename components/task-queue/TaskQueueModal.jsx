"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import PipelineTaskProgress from "@/components/ui/PipelineTaskProgress";
import GenericTaskProgressBar from "@/components/ui/GenericTaskProgressBar";
import { useBackgroundTasks } from "@/components/providers/BackgroundTasksProvider";
import { usePipelineProgressContext } from "@/components/providers/PipelineProgressProvider";
import { sortTasksForDisplay } from "@/lib/background-jobs/sortTasks";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { emitOnboardingEvent, ONBOARDING_EVENTS } from "@/lib/onboarding/onboardingEvents";

/**
 * Labels des étapes improve-cv pour l'affichage
 */
const IMPROVEMENT_STEP_LABELS = {
  preprocess: 'Préparation',
  classify_skills: 'Classification',
  experiences: 'Expériences',
  projects: 'Projets',
  summary: 'Summary',
  finalize: 'Finalisation',
};

/**
 * Poids de chaque étape pour le calcul du pourcentage (CV Improvement)
 */
const IMPROVEMENT_STEP_WEIGHTS = {
  preprocess: 15,
  classify_skills: 15,
  experiences: 30,
  projects: 20,
  summary: 10,
  finalize: 10,
};

/**
 * Calcule le pourcentage de progression pour une tâche improve-cv
 */
function calculateImprovementProgress(progressData) {
  if (!progressData) return 0;
  if (progressData.status === 'completed') return 100;
  if (progressData.status === 'failed' || progressData.status === 'cancelled') return 0;

  const { completedSteps = {}, currentStep, currentItem, totalItems } = progressData;
  const steps = ['preprocess', 'classify_skills', 'experiences', 'projects', 'summary', 'finalize'];
  let totalWeight = 0;
  let completedWeight = 0;

  steps.forEach(step => {
    totalWeight += IMPROVEMENT_STEP_WEIGHTS[step];
    if (completedSteps[step]) {
      completedWeight += IMPROVEMENT_STEP_WEIGHTS[step];
    }
  });

  // Ajouter une progression partielle pour l'étape en cours
  if (currentStep && !completedSteps[currentStep]) {
    const stepWeight = IMPROVEMENT_STEP_WEIGHTS[currentStep] || 0;
    if (totalItems && totalItems > 0 && currentItem != null) {
      // Progression par item (ex: 3/5 expériences)
      completedWeight += stepWeight * (currentItem / totalItems);
    } else {
      // 50% de l'étape en cours si pas d'items
      completedWeight += stepWeight * 0.5;
    }
  }

  return Math.round((completedWeight / totalWeight) * 100);
}

/**
 * Indicateur de progression pour les tâches improve-cv
 * Affiche les étapes avec progression temps réel via SSE
 */
function ImprovementProgressIndicator({ task }) {
  const { t } = useLanguage();
  const { getProgress } = usePipelineProgressContext();

  const progress = getProgress(task.id);
  const percentage = calculateImprovementProgress(progress);

  const locale = t("common.locale") || 'fr-FR';
  const createdAt = new Date(task.createdAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  });

  const isFinished = task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled';

  // Status label
  const statusLabel = task.status === 'completed'
    ? (t('taskQueue.status.completed') || 'Terminé')
    : task.status === 'failed'
      ? (t('taskQueue.status.failed') || 'Échec')
      : task.status === 'cancelled'
        ? (t('taskQueue.status.cancelled') || 'Annulé')
        : (t('taskQueue.status.queued') || 'En attente');

  // Classes pour la barre
  const barClasses = task.status === 'failed' || task.status === 'cancelled'
    ? 'bg-gradient-to-r from-red-500 to-red-400'
    : task.status === 'completed'
      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
      : 'bg-gradient-to-r from-violet-500 via-purple-400 to-fuchsia-400';

  // Classes pour le status
  const statusColorClasses = task.status === 'completed'
    ? 'text-emerald-400'
    : task.status === 'failed' || task.status === 'cancelled'
      ? 'text-red-400'
      : 'text-white/60';

  // Déterminer l'étape courante à afficher
  let currentStepLabel = t('taskQueue.taskTypes.improveCv') || 'Amélioration CV';
  if (progress && task.status === 'running') {
    const stepKey = progress.currentStep;
    if (stepKey && IMPROVEMENT_STEP_LABELS[stepKey]) {
      currentStepLabel = IMPROVEMENT_STEP_LABELS[stepKey];
      // Ajouter le compteur si disponible
      if (progress.totalItems && progress.totalItems > 0 && progress.currentItem != null) {
        currentStepLabel += ` (${progress.currentItem}/${progress.totalItems})`;
      }
    }
  }

  if (isFinished) {
    return (
      <div className="py-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-white truncate flex-1 mr-2">
            {t('taskQueue.taskTypes.improveCv') || 'Amélioration CV'}
          </span>
          <span className={`text-xs font-medium ${statusColorClasses}`}>
            {statusLabel}
          </span>
        </div>
        <div className="text-[10px] text-white/50 mt-0.5">
          {createdAt} <span className="text-white/30">|</span> {t('taskQueue.taskTypes.improveCv') || 'Amélioration CV'}
        </div>
      </div>
    );
  }

  return (
    <div className="py-1">
      {/* Ligne 1: Heure | Description + Pourcentage */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-2">
          <span className="text-[10px] text-white/50 flex-shrink-0">{createdAt}</span>
          <span className="text-white/30">|</span>
          <span className="text-xs font-medium text-white truncate">
            {t('taskQueue.taskTypes.improveCv') || 'Amélioration CV'}
          </span>
        </div>
        <span className="text-xs font-medium text-purple-400 tabular-nums flex-shrink-0">
          {task.status === 'running' ? `${percentage}%` : '—'}
        </span>
      </div>

      {/* Ligne 2: Barre de progression */}
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barClasses} ${task.status === 'queued' ? 'animate-pulse' : ''}`}
          style={{ width: `${Math.max(task.status === 'queued' ? 8 : percentage, 2)}%` }}
        />
      </div>

      {/* Ligne 3: Étape courante */}
      <div className="text-[10px] text-white/50 mt-0.5">
        {task.status === 'running' ? currentStepLabel : statusLabel}
      </div>
    </div>
  );
}

/**
 * Indicateur de progression pour les tâches cv_generation
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
  const { getProgress } = usePipelineProgressContext();

  const locale = t("common.locale") || 'fr-FR'; // fr-FR ou en-US
  const createdAt = new Date(task.createdAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Pour cv_generation, utiliser le statut SSE s'il est disponible (plus à jour que le polling)
  let effectiveStatus = task.status;
  if (task.type === 'cv_generation') {
    const sseProgress = getProgress(task.id);
    if (sseProgress?.status && sseProgress.status !== 'running') {
      effectiveStatus = sseProgress.status;
    }
  }

  const canCancel = effectiveStatus === 'queued' || effectiveStatus === 'running';

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
  } else if (task.type === 'cv_generation') {
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
    // Sinon vérifier le result (pour generation, import, template-creation, cv_generation)
    else if (task.result && task.status === 'completed') {
      // task.result est déjà un objet (parsé par l'API)
      const result = typeof task.result === 'string' ? JSON.parse(task.result) : task.result;
      // cv_generation utilise 'filename', les autres utilisent 'file' ou 'files'
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

  // Layout spécial pour cv_generation : PipelineProgressIndicator prend toute la largeur
  if (task.type === 'cv_generation') {
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

  // Layout spécial pour improve-cv : ImprovementProgressIndicator avec progression SSE
  if (task.type === 'improve-cv') {
    return (
      <div
        className={`p-3 border border-white/20 rounded-lg bg-white/5 ${isClickable ? 'cursor-pointer hover:bg-white/10 transition-all duration-200' : ''}`}
        onClick={handleClick}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <ImprovementProgressIndicator task={task} />
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
