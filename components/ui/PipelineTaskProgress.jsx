"use client";

import React from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * PipelineTaskProgress - Progression visuelle du pipeline CV v2
 *
 * Affiche une série de points représentant les étapes du pipeline:
 * Classification → Expériences → Projets → Extras → Skills → Summary → Finalisation
 *
 * @param {Object} props
 * @param {number} props.currentOffer - Index de l'offre en cours (0-based)
 * @param {number} props.totalOffers - Nombre total d'offres
 * @param {string} props.currentPhase - Phase en cours (classify, batches, recompose)
 * @param {string} props.currentStep - Étape en cours (classify, experiences, projects, extras, skills, summary, recompose)
 * @param {string} props.status - Statut global (running, completed, failed)
 * @param {Object} props.completedSteps - Map des étapes terminées { classify: true, experiences: true, ... }
 * @param {string} props.className - Classes CSS additionnelles
 */
export default function PipelineTaskProgress({
  currentOffer = 0,
  totalOffers = 1,
  currentStep = null,
  status = 'running',
  completedSteps = {},
  className = '',
}) {
  const { t } = useLanguage();

  // Définition des étapes dans l'ordre (les labels sont traduits via i18n)
  const stepIds = ['classify', 'experiences', 'projects', 'extras', 'skills', 'summary', 'recompose'];
  const steps = stepIds.map(id => ({
    id,
    label: t(`taskQueue.steps.${id}`) || id,
  }));

  // Déterminer l'état de chaque étape
  const getStepState = (stepId) => {
    // Si la tâche est terminée, toutes les étapes sont complétées
    if (status === 'completed') {
      return 'completed';
    }

    // Si la tâche a échoué, marquer selon l'état connu
    if (status === 'failed') {
      if (completedSteps[stepId]) {
        return 'completed';
      }
      if (stepId === currentStep) {
        return 'failed';
      }
      return 'pending';
    }

    // Étape terminée
    if (completedSteps[stepId]) {
      return 'completed';
    }

    // Étape en cours
    if (stepId === currentStep) {
      return 'running';
    }

    // Étape à venir
    return 'pending';
  };

  // Classes CSS pour chaque état
  const getStepClasses = (state) => {
    switch (state) {
      case 'completed':
        return 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]';
      case 'running':
        return 'bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.7)]';
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
        {steps.map((step, index) => {
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
