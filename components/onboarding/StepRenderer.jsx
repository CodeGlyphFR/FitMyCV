'use client';

import React from 'react';
import OnboardingModal from './OnboardingModal';
import OnboardingTooltip from './OnboardingTooltip';
import OnboardingHighlight from './OnboardingHighlight';
import { Pencil } from 'lucide-react';

/**
 * Composant pour rendre une étape d'onboarding standard
 * (avec highlight, tooltip et modal optionnel)
 */
export default function StepRenderer({
  step,
  currentStep,
  modalOpen,
  tooltipClosed,
  currentScreen,
  IconComponent = Pencil,
  onModalNext,
  onModalPrev,
  onModalJumpTo,
  onModalComplete,
  onModalSkip,
  onModalClose,
  onTooltipClose,
  showSkipButton = true,
  modalSize = 'large',
  // Conditions supplémentaires pour l'affichage
  showHighlight = true,
  showTooltip = true,
  showModal = true,
  // Précondition pour l'étape (ex: cvGenerated pour step 4)
  preconditionMet = true
}) {
  if (!step || !preconditionMet) return null;

  return (
    <>
      {/* Highlight : ring toujours visible, blur seulement quand tooltip affichée */}
      {showHighlight && (
        <OnboardingHighlight
          show={!modalOpen && currentStep === step.id}
          blurEnabled={!tooltipClosed}
          targetSelector={step.targetSelector}
        />
      )}

      {/* Tooltip */}
      {showTooltip && step.tooltip && (
        <OnboardingTooltip
          show={!modalOpen && !tooltipClosed}
          targetSelector={step.targetSelector}
          content={step.tooltip.content}
          position={step.tooltip.position}
          closable={true}
          onClose={onTooltipClose}
        />
      )}

      {/* Modal carousel */}
      {showModal && step.modal && (
        <OnboardingModal
          open={modalOpen}
          screens={step.modal.screens}
          currentScreen={currentScreen}
          title={step.title}
          IconComponent={IconComponent}
          onNext={onModalNext}
          onPrev={onModalPrev}
          onJumpTo={onModalJumpTo}
          onComplete={onModalComplete}
          onSkip={onModalSkip}
          onClose={onModalClose}
          showSkipButton={showSkipButton}
          size={modalSize}
        />
      )}
    </>
  );
}

/**
 * Version simplifiée pour les étapes tooltip-only (sans modal)
 */
export function TooltipOnlyStep({
  step,
  currentStep,
  tooltipClosed,
  onTooltipClose,
  preconditionMet = true,
  persistent = false
}) {
  if (!step || !preconditionMet) return null;

  return (
    <>
      <OnboardingHighlight
        show={currentStep === step.id}
        blurEnabled={!tooltipClosed}
        targetSelector={step.targetSelector}
      />

      {step.tooltip && (
        <OnboardingTooltip
          show={!tooltipClosed}
          targetSelector={step.targetSelector}
          content={step.tooltip.content}
          position={step.tooltip.position}
          closable={true}
          persistent={persistent}
          onClose={onTooltipClose}
        />
      )}
    </>
  );
}
