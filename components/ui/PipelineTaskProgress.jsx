"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { usePipelineProgressContext } from '@/components/providers/PipelineProgressProvider';
import { PIPELINE_STEPS, calculateOfferProgress } from '@/hooks/usePipelineProgress';

/**
 * Composant pour animer la transition du texte d'étape (effet "Sims")
 * Le texte sort vers la gauche et le nouveau entre depuis la droite
 */
function AnimatedStepLabel({ text, className = '' }) {
  return (
    <div className={`relative overflow-hidden h-[14px] pr-2 ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={text}
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -30, opacity: 0 }}
          transition={{
            x: { type: 'spring', stiffness: 400, damping: 30 },
            opacity: { duration: 0.12 }
          }}
          className="absolute inset-0"
        >
          {text}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * Labels traduits pour chaque étape
 */
const STEP_LABELS = {
  extraction: 'taskQueue.steps.extraction',
  classify: 'taskQueue.steps.classify',
  experiences: 'taskQueue.steps.experiences',
  projects: 'taskQueue.steps.projects',
  extras: 'taskQueue.steps.extras',
  skills: 'taskQueue.steps.skills',
  summary: 'taskQueue.steps.summary',
  recompose: 'taskQueue.steps.recompose',
};

/**
 * Fallback labels (si pas de traduction)
 */
const STEP_FALLBACKS = {
  extraction: 'Extraction',
  classify: 'Classification',
  experiences: 'Experiences',
  projects: 'Projets',
  extras: 'Extras',
  skills: 'Competences',
  summary: 'Resume',
  recompose: 'Finalisation',
};

/**
 * Ligne de progression pour une offre
 *
 * En cours:
 * Heure | Titre de l'offre                                         x %
 * ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
 * Étape en cours (ex: Expériences 3/5)
 *
 * Terminé:
 * Titre de l'offre                                              Terminé
 * Heure | Génération de CV IA
 */
function OfferProgressLine({ offer, t, createdAt }) {
  const progress = calculateOfferProgress(offer);
  const status = offer.status;
  const isFinished = status === 'completed' || status === 'failed' || status === 'cancelled';

  // Titre de l'offre (jobTitle ou URL tronquée ou fallback)
  const offerIndex = typeof offer.offerIndex === 'number' ? offer.offerIndex + 1 : 1;
  const offerTitle = offer.jobTitle || (offer.sourceUrl ? truncateUrl(offer.sourceUrl) : `Offre ${offerIndex}`);

  // Déterminer le step courant à afficher
  // Priorité : premier step "running" dans l'ordre du pipeline
  // Cela permet d'afficher le step le plus avancé quand plusieurs steps tournent en parallèle
  const runningSteps = offer.runningSteps || {};
  const displayStep = PIPELINE_STEPS.find(step => runningSteps[step]) || offer.currentStep;

  // Récupérer currentItem/totalItems pour le step affiché (depuis runningSteps si disponible)
  const stepData = typeof runningSteps[displayStep] === 'object' ? runningSteps[displayStep] : {};
  const currentItem = stepData.currentItem ?? offer.currentItem ?? null;
  const totalItems = stepData.totalItems ?? offer.totalItems ?? null;

  // Label de l'étape en cours
  let stepLabel = '';
  if (displayStep) {
    const translationKey = STEP_LABELS[displayStep];
    const label = (translationKey && t(translationKey)) || STEP_FALLBACKS[displayStep] || displayStep;
    if (currentItem != null && totalItems != null) {
      stepLabel = `${label} ${currentItem + 1}/${totalItems}`;
    } else {
      stepLabel = label;
    }
  } else {
    stepLabel = t('taskQueue.status.queued') || 'En attente';
  }

  // Status label
  const statusLabel = status === 'completed'
    ? (t('taskQueue.status.completed') || 'Terminé')
    : status === 'failed'
      ? (t('taskQueue.status.failed') || 'Échec')
      : status === 'cancelled'
        ? (t('taskQueue.status.cancelled') || 'Annulé')
        : '';

  // Feature name
  const featureName = t('taskQueue.messages.pipelineInProgress')?.replace(' en cours', '') || 'Génération CV IA';

  // Classes pour la barre
  const barClasses = status === 'failed' || status === 'cancelled'
    ? 'bg-gradient-to-r from-red-500 to-red-400'
    : status === 'completed'
      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
      : 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-green-400';

  // Classes pour le status (rouge pour failed et cancelled, comme les autres tâches)
  const statusColorClass = status === 'completed'
    ? 'text-emerald-400'
    : 'text-red-400';

  if (isFinished) {
    // Layout TERMINÉ
    return (
      <div className="py-1">
        {/* Ligne 1: Titre + Status */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-white truncate flex-1 mr-2">
            {offerTitle}
          </span>
          <span className={`text-xs font-medium ${statusColorClass}`}>
            {statusLabel}
          </span>
        </div>
        {/* Ligne 2: Heure | Feature name */}
        <div className="text-[10px] text-white/50 mt-0.5">
          {createdAt} <span className="text-white/30">|</span> {featureName}
        </div>
      </div>
    );
  }

  // Layout EN COURS
  return (
    <div className="py-1">
      {/* Ligne 1: Heure | Titre + Pourcentage */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-2">
          <span className="text-[10px] text-white/50 flex-shrink-0">{createdAt}</span>
          <span className="text-white/30">|</span>
          <span className="text-xs font-medium text-white truncate">
            {offerTitle}
          </span>
        </div>
        <span className="text-xs font-medium text-emerald-400 tabular-nums flex-shrink-0">
          {progress}%
        </span>
      </div>

      {/* Ligne 2: Barre de progression */}
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barClasses}`}
          style={{ width: `${Math.max(progress, 2)}%` }}
        />
      </div>

      {/* Ligne 3: Étape en cours (avec animation de transition) */}
      <AnimatedStepLabel
        text={stepLabel}
        className="text-[10px] text-white/50 mt-0.5"
      />
    </div>
  );
}

/**
 * Tronque une URL pour l'affichage
 * Gère aussi les chemins file:// en extrayant juste le nom du fichier
 */
function truncateUrl(url) {
  // Pour les chemins file://, extraire juste le nom du fichier
  if (url && url.startsWith('file://')) {
    const filePath = url.replace('file://', '');
    const fileName = filePath.split('/').pop() || filePath;
    // Retirer l'extension .pdf et tronquer si nécessaire
    const displayName = fileName.replace(/\.pdf$/i, '');
    return displayName.length > 35 ? displayName.slice(0, 35) + '...' : displayName;
  }

  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.replace('www.', '');
    const path = urlObj.pathname.slice(0, 20);
    return `${host}${path}${urlObj.pathname.length > 20 ? '...' : ''}`;
  } catch {
    return url.slice(0, 30) + (url.length > 30 ? '...' : '');
  }
}

/**
 * PipelineTaskProgress - Progression visuelle du pipeline CV v2
 *
 * Affiche une ligne de progression par offre avec deux layouts:
 *
 * En cours:
 * Heure | Titre de l'offre                                         x %
 * ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
 * Étape en cours
 *
 * Terminé:
 * Titre de l'offre                                              Terminé
 * Heure | Génération de CV IA
 *
 * @param {Object} props
 * @param {string} props.taskId - ID de la tâche
 * @param {number} [props.totalOffers] - Nombre total d'offres (fallback si pas de SSE)
 * @param {string} [props.createdAt] - Heure de création formatée
 * @param {string} props.className - Classes CSS additionnelles
 */
export default function PipelineTaskProgress({
  taskId,
  totalOffers: fallbackTotalOffers = 1,
  createdAt = '',
  taskStatus = null,
  taskTitle = null,
  sourceUrl: fallbackSourceUrl = null,
  className = '',
}) {
  const { t } = useLanguage();
  const { getProgress, getOffersArray } = usePipelineProgressContext();

  // Récupérer la progression de la tâche
  const taskProgress = getProgress(taskId);
  const offers = getOffersArray(taskId);

  // Feature name pour l'affichage (utiliser taskTitle si disponible)
  const featureName = t('taskQueue.messages.pipelineInProgress')?.replace(' en cours', '') || 'Génération CV IA';
  const displayTitle = taskTitle || featureName;

  // Si la tâche est terminée selon BackgroundTask mais pas de données SSE,
  // afficher le statut de la BackgroundTask
  const isTaskFinished = taskStatus === 'completed' || taskStatus === 'failed' || taskStatus === 'cancelled';

  if (isTaskFinished && (!taskProgress || offers.length === 0)) {
    // Afficher le statut de la BackgroundTask comme fallback
    const statusLabel = taskStatus === 'completed'
      ? (t('taskQueue.status.completed') || 'Terminé')
      : taskStatus === 'cancelled'
        ? (t('taskQueue.status.cancelled') || 'Annulé')
        : (t('taskQueue.status.failed') || 'Échec');

    const statusColorClass = taskStatus === 'completed'
      ? 'text-emerald-400'
      : 'text-red-400';

    return (
      <div className={`${className}`}>
        <div className="py-1">
          {/* Ligne 1: Titre (depuis BackgroundTask.title ou fallback) + Status */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white truncate flex-1 mr-2">
              {displayTitle}
            </span>
            <span className={`text-xs font-medium ${statusColorClass}`}>
              {statusLabel}
            </span>
          </div>
          {/* Ligne 2: Heure | Type */}
          <div className="text-[10px] text-white/50 mt-0.5">
            {createdAt} <span className="text-white/30">|</span> {featureName}
          </div>
        </div>
      </div>
    );
  }

  // Si pas encore de données SSE et tâche en cours, afficher un placeholder
  if (!taskProgress || offers.length === 0) {
    return (
      <div className={`${className}`}>
        <div className="py-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-2">
              <span className="text-[10px] text-white/50 flex-shrink-0">{createdAt}</span>
              <span className="text-white/30">|</span>
              <span className="text-xs text-white/70">{t('taskQueue.status.queued') || 'En attente'}...</span>
            </div>
            <span className="text-xs text-white/40">—</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
            <div className="h-full w-[8%] rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-green-400 animate-pulse" />
          </div>
          <div className="text-[10px] text-white/40 mt-0.5">
            {t('taskQueue.messages.pipelineQueued') || 'Initialisation'}
          </div>
        </div>
      </div>
    );
  }

  // Si la tâche est terminée selon BackgroundTask, forcer le statut des offres
  // pour éviter les incohérences entre les données SSE et le statut réel
  // Injecter aussi fallbackSourceUrl si l'offre n'a pas de sourceUrl
  const finalOffers = offers.map(offer => ({
    ...offer,
    sourceUrl: offer.sourceUrl || fallbackSourceUrl,
    ...(isTaskFinished ? { status: taskStatus } : {}),
  }));

  // Limiter l'affichage à 3 offres max
  const displayedOffers = finalOffers.slice(0, 3);
  const hiddenCount = finalOffers.length - 3;

  return (
    <div className={`${className}`}>
      {/* Lignes de progression par offre */}
      <div className="divide-y divide-white/5">
        {displayedOffers.map((offer) => (
          <OfferProgressLine
            key={offer.offerId}
            offer={offer}
            t={t}
            createdAt={createdAt}
          />
        ))}
      </div>

      {/* Indicateur si plus de 3 offres */}
      {hiddenCount > 0 && (
        <div className="text-[10px] text-white/40 text-center py-1 border-t border-white/5">
          +{hiddenCount} {t('taskQueue.messages.moreOffers') || 'autre(s) offre(s)'}
        </div>
      )}
    </div>
  );
}

/**
 * Version compacte pour l'affichage dans TaskQueueModal (anciens 7 points)
 * Garde la rétrocompatibilité avec l'ancien système
 */
export function PipelineTaskProgressCompact({
  currentOffer = 0,
  totalOffers = 1,
  currentStep = null,
  status = 'running',
  completedSteps = {},
  className = '',
}) {
  const { t } = useLanguage();

  // Définition des étapes dans l'ordre
  const steps = PIPELINE_STEPS.map(id => ({
    id,
    label: t(`taskQueue.steps.${id}`) || STEP_FALLBACKS[id] || id,
  }));

  // Déterminer l'état de chaque étape
  const getStepState = (stepId) => {
    if (status === 'completed') return 'completed';
    if (status === 'failed') {
      if (completedSteps[stepId]) return 'completed';
      if (stepId === currentStep) return 'failed';
      return 'pending';
    }
    if (completedSteps[stepId]) return 'completed';
    if (stepId === currentStep) return 'running';
    return 'pending';
  };

  // Classes CSS pour chaque état
  const getStepClasses = (state) => {
    switch (state) {
      case 'completed':
        return 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211.1.5.0.6)]';
      case 'running':
        return 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211.1.5.0.7)]';
      case 'failed':
        return 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]';
      case 'pending':
      default:
        return 'bg-white/30';
    }
  };

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      {/* Indicateur multi-offres */}
      {totalOffers > 1 && (
        <div className="text-[10px] text-white/70 font-medium">
          {currentOffer + 1}/{totalOffers}
        </div>
      )}

      {/* Points de progression */}
      <div className="flex items-center gap-1">
        {steps.map((step) => {
          const state = getStepState(step.id);
          return (
            <div
              key={step.id}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${getStepClasses(state)}`}
              title={step.label}
            />
          );
        })}
      </div>
    </div>
  );
}
