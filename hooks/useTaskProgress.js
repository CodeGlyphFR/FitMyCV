"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { getDefaultDuration } from '@/lib/backgroundTasks/taskFeatureMapping';

/**
 * Phases de progression avec durées et cibles
 * Inspiré de l'EmptyState avec 4 phases réalistes
 */
const PROGRESS_PHASES = [
  { timePercent: 0.15, targetProgress: 20, easing: 'quadratic' },  // 0-15% temps → 0-20% progress
  { timePercent: 0.40, targetProgress: 50, easing: 'linear' },     // 15-55% temps → 20-50% progress
  { timePercent: 0.35, targetProgress: 80, easing: 'cubic' },      // 55-90% temps → 50-80% progress
  { timePercent: 0.10, targetProgress: 95, easing: 'quadratic' },  // 90-100% temps → 80-95% progress
];

/**
 * Fonctions d'easing
 */
const easingFunctions = {
  linear: (t) => t,
  quadratic: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  cubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

/**
 * Calcule la progression asymptotique quand on dépasse le temps estimé
 * Approche 99% sans jamais l'atteindre
 *
 * @param {number} overtimeRatio - Ratio temps écoulé au-delà de l'estimation (0 = juste dépassé, 1 = 2x le temps)
 * @returns {number} Progression entre 95 et 99
 */
function asymptoticProgress(overtimeRatio) {
  const k = 0.5; // Coefficient de décroissance
  // Formule: 95 + 4 * (1 - e^(-k * overtimeRatio))
  // À overtimeRatio=0: 95
  // À overtimeRatio=1: ~97.4
  // À overtimeRatio=2: ~98.5
  // À overtimeRatio→∞: 99
  return 95 + 4 * (1 - Math.exp(-k * overtimeRatio));
}

/**
 * Calcule la progression basée sur le temps écoulé et les phases
 *
 * @param {number} elapsed - Temps écoulé en ms
 * @param {number} estimated - Temps estimé total en ms
 * @returns {number} Progression de 0 à 99 (jamais 100 jusqu'à completion)
 */
function calculatePhasedProgress(elapsed, estimated) {
  const timeRatio = elapsed / estimated;

  // Si on a dépassé le temps estimé, utiliser la progression asymptotique
  if (timeRatio >= 1) {
    const overtimeRatio = timeRatio - 1;
    return Math.min(99, asymptoticProgress(overtimeRatio));
  }

  // Calculer dans quelle phase on est
  let accumulatedTime = 0;
  let accumulatedProgress = 0;

  for (const phase of PROGRESS_PHASES) {
    const phaseEndTime = accumulatedTime + phase.timePercent;

    if (timeRatio <= phaseEndTime) {
      // On est dans cette phase
      const phaseProgress = (timeRatio - accumulatedTime) / phase.timePercent;
      const easedProgress = easingFunctions[phase.easing](phaseProgress);
      const previousProgress = accumulatedProgress;
      const progressRange = phase.targetProgress - previousProgress;

      return previousProgress + easedProgress * progressRange;
    }

    accumulatedTime = phaseEndTime;
    accumulatedProgress = phase.targetProgress;
  }

  // Si on arrive ici, on est à la fin mais pas encore en overtime
  return 95;
}

/**
 * Hook personnalisé pour gérer la progression d'une tâche
 *
 * @param {Object} options
 * @param {string} options.taskId - ID unique de la tâche
 * @param {string} options.taskType - Type de tâche (generation, import-pdf, etc.)
 * @param {string} options.taskStatus - Statut actuel (running, completed, etc.)
 * @param {number} options.startTime - Timestamp de démarrage (task.createdAt)
 * @param {Object} options.payload - Payload de la tâche (optionnel)
 *
 * @returns {Object} { progress, isOvertime, estimatedDuration }
 */
export function useTaskProgress({
  taskId,
  taskType,
  taskStatus,
  startTime,
  payload = null,
}) {
  const [progress, setProgress] = useState(0);
  const [isOvertime, setIsOvertime] = useState(false);
  const [estimatedDuration, setEstimatedDuration] = useState(() => getDefaultDuration(taskType));

  const intervalRef = useRef(null);
  const completionAnimationRef = useRef(null);
  const hasFetchedRef = useRef(false);

  // Récupérer la durée estimée depuis l'API
  useEffect(() => {
    if (hasFetchedRef.current || taskStatus !== 'running') return;

    const fetchEstimatedDuration = async () => {
      try {
        const params = new URLSearchParams({ taskType });

        console.log(`[useTaskProgress] Fetching duration for taskType=${taskType}, params=${params.toString()}`);

        const response = await fetch(`/api/telemetry/average-task-duration?${params}`);
        if (response.ok) {
          const data = await response.json();
          console.log('[useTaskProgress] API response:', data);
          if (data.success && data.estimatedDuration) {
            console.log(`[useTaskProgress] Setting estimatedDuration to ${data.estimatedDuration}ms (${(data.estimatedDuration / 1000).toFixed(1)}s) from ${data.source}`);
            setEstimatedDuration(data.estimatedDuration);
          }
        } else {
          console.warn('[useTaskProgress] API response not ok:', response.status);
        }
      } catch (error) {
        // En cas d'erreur, garder la durée par défaut
        console.warn('[useTaskProgress] Failed to fetch estimated duration:', error);
      }
      hasFetchedRef.current = true;
    };

    fetchEstimatedDuration();
  }, [taskType, taskStatus, payload]);

  // Animation de progression
  useEffect(() => {
    // Si la tâche n'est pas en cours, ne pas animer
    if (taskStatus !== 'running') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Log initial de démarrage
    console.log(`[useTaskProgress] Starting animation for task ${taskId}, type=${taskType}, estimatedDuration=${estimatedDuration}ms (${(estimatedDuration / 1000).toFixed(1)}s)`);

    let logCounter = 0;
    // Démarrer l'intervalle d'animation (100ms comme EmptyState)
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTime;
      const newProgress = calculatePhasedProgress(elapsed, estimatedDuration);

      // Log toutes les 5 secondes (50 * 100ms)
      logCounter++;
      if (logCounter % 50 === 0) {
        console.log(`[useTaskProgress] Task ${taskId}: elapsed=${(elapsed / 1000).toFixed(1)}s / estimated=${(estimatedDuration / 1000).toFixed(1)}s, progress=${newProgress.toFixed(1)}%`);
      }

      setProgress(newProgress);
      setIsOvertime(elapsed >= estimatedDuration);
    }, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [taskStatus, startTime, estimatedDuration]);

  // Animation de completion (smooth vers 100%)
  useEffect(() => {
    if (taskStatus === 'completed') {
      // Stopper l'intervalle de progression
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Animer de la progression actuelle vers 100%
      const currentProgress = progress;
      const animationDuration = 400;
      const steps = 20;
      const stepDuration = animationDuration / steps;
      const progressIncrement = (100 - currentProgress) / steps;
      let step = 0;

      completionAnimationRef.current = setInterval(() => {
        step++;
        const newProgress = Math.min(100, currentProgress + progressIncrement * step);
        setProgress(newProgress);

        if (step >= steps) {
          clearInterval(completionAnimationRef.current);
          completionAnimationRef.current = null;
          setProgress(100);
        }
      }, stepDuration);
    }

    return () => {
      if (completionAnimationRef.current) {
        clearInterval(completionAnimationRef.current);
        completionAnimationRef.current = null;
      }
    };
  }, [taskStatus]);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (completionAnimationRef.current) clearInterval(completionAnimationRef.current);
    };
  }, []);

  return {
    progress,
    isOvertime,
    estimatedDuration,
  };
}

export default useTaskProgress;
