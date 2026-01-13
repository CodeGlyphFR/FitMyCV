"use client";

import React from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useTaskProgress } from '@/hooks/useTaskProgress';

/**
 * Labels des types de tâches
 */
const TASK_TYPE_LABELS = {
  import: 'taskQueue.taskTypes.import',
  generation: 'taskQueue.taskTypes.generation',
  'template-creation': 'taskQueue.taskTypes.templateCreation',
  'translate-cv': 'taskQueue.taskTypes.translateCv',
  'improve-cv': 'taskQueue.taskTypes.improveCv',
  'job-title-generation': 'taskQueue.taskTypes.jobTitleGeneration',
};

/**
 * Fallback labels (si pas de traduction)
 */
const TASK_TYPE_FALLBACKS = {
  import: 'Import PDF',
  generation: 'Génération CV',
  'template-creation': 'Création template',
  'translate-cv': 'Traduction CV',
  'improve-cv': 'Amélioration CV',
  'job-title-generation': 'Génération intitulé',
};

/**
 * GenericTaskProgressBar - Barre de progression style pipeline pour toutes les tâches
 *
 * Layout en cours:
 * Heure | Description                                                    x %
 * ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
 * Type de tâche
 *
 * Layout terminé:
 * Description                                                        Terminé
 * Heure | Type de tâche
 *
 * @param {Object} props
 * @param {Object} props.task - La tâche complète
 * @param {string} props.description - Description à afficher
 * @param {string} props.createdAt - Heure formatée
 * @param {string} props.className - Classes CSS additionnelles
 */
export default function GenericTaskProgressBar({
  task,
  description,
  createdAt,
  className = '',
}) {
  const { t } = useLanguage();
  const { progress } = useTaskProgress({
    taskId: task.id,
    taskType: task.type,
    taskStatus: task.status,
    startTime: Number(task.createdAt),
    payload: task.payload,
  });

  const status = task.status;
  const isFinished = status === 'completed' || status === 'failed' || status === 'cancelled';

  // Type de tâche traduit (vérifier que la clé existe avant d'appeler t())
  const taskTypeKey = TASK_TYPE_LABELS[task.type];
  const taskTypeLabel = taskTypeKey ? t(taskTypeKey) : (TASK_TYPE_FALLBACKS[task.type] || task.type);

  // Status label
  const statusLabel = status === 'completed'
    ? (t('taskQueue.status.completed') || 'Terminé')
    : status === 'failed'
      ? (t('taskQueue.status.failed') || 'Échec')
      : status === 'cancelled'
        ? (t('taskQueue.status.cancelled') || 'Annulé')
        : (t('taskQueue.status.queued') || 'En attente');

  // Classes pour la barre
  const barClasses = status === 'failed' || status === 'cancelled'
    ? 'bg-gradient-to-r from-red-500 to-red-400'
    : status === 'completed'
      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
      : 'bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-400';

  // Classes pour le status
  const statusColorClasses = status === 'completed'
    ? 'text-emerald-400'
    : status === 'failed' || status === 'cancelled'
      ? 'text-red-400'
      : 'text-white/60';

  if (isFinished) {
    // Layout TERMINÉ
    return (
      <div className={`py-1 ${className}`}>
        {/* Ligne 1: Description + Status */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-white truncate flex-1 mr-2" title={description}>
            {description}
          </span>
          <span className={`text-xs font-medium ${statusColorClasses}`}>
            {statusLabel}
          </span>
        </div>
        {/* Ligne 2: Heure | Type de tâche */}
        <div className="text-[10px] text-white/50 mt-0.5">
          {createdAt} <span className="text-white/30">|</span> {taskTypeLabel}
        </div>
      </div>
    );
  }

  // Layout EN COURS ou EN ATTENTE
  const displayProgress = status === 'running' ? Math.round(progress) : 0;
  const showProgressAnimation = status === 'queued';

  return (
    <div className={`py-1 ${className}`}>
      {/* Ligne 1: Heure | Description + Pourcentage */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-2">
          <span className="text-[10px] text-white/50 flex-shrink-0">{createdAt}</span>
          <span className="text-white/30">|</span>
          <span className="text-xs font-medium text-white truncate" title={description}>
            {description}
          </span>
        </div>
        <span className="text-xs font-medium text-blue-400 tabular-nums flex-shrink-0">
          {status === 'running' ? `${displayProgress}%` : '—'}
        </span>
      </div>

      {/* Ligne 2: Barre de progression */}
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barClasses} ${showProgressAnimation ? 'animate-pulse' : ''}`}
          style={{ width: `${Math.max(showProgressAnimation ? 8 : displayProgress, 2)}%` }}
        />
      </div>

      {/* Ligne 3: Type de tâche / Status */}
      <div className="text-[10px] text-white/50 mt-0.5">
        {status === 'running' ? taskTypeLabel : statusLabel}
      </div>
    </div>
  );
}
