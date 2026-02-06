import { useEffect, useRef } from 'react';
import { ONBOARDING_TIMINGS } from '@/lib/onboarding/onboardingConfig';
import { onboardingLogger } from '@/lib/utils/onboardingLogger';

const { BUTTON_POLLING_INTERVAL, BUTTON_POLLING_TIMEOUT } = ONBOARDING_TIMINGS;

/**
 * Hook pour intercepter le premier clic sur un bouton d'onboarding
 * @param {Object} options
 * @param {number} options.currentStep - Étape actuelle
 * @param {number} options.targetStep - Étape cible pour l'interception
 * @param {string} options.selector - Sélecteur du bouton
 * @param {Function} options.onFirstClick - Callback pour le premier clic
 * @param {Object} options.modalShownRef - Ref pour tracker si modal a été montré
 */
export function useButtonInterception({
  currentStep,
  targetStep,
  selector,
  onFirstClick,
  modalShownRef
}) {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (currentStep !== targetStep) return;

    let isCleanedUp = false;

    const handleButtonClick = (e) => {
      if (isCleanedUp) return;

      // Si modal déjà montré, laisser passer le clic normal
      if (modalShownRef.current) {
        onboardingLogger.log(`[Onboarding] Step ${targetStep}: Modal already shown, allowing normal button behavior`);
        return;
      }

      // Premier clic : intercepter
      e.preventDefault();
      e.stopPropagation();

      modalShownRef.current = true;
      onFirstClick(e);
    };

    // Polling pour trouver le bouton
    let attempts = 0;
    const maxAttempts = Math.ceil(BUTTON_POLLING_TIMEOUT / BUTTON_POLLING_INTERVAL);

    const attachListener = () => {
      if (isCleanedUp) return true;

      buttonRef.current = document.querySelector(selector);

      if (buttonRef.current) {
        buttonRef.current.addEventListener('click', handleButtonClick, { capture: true });
        return true;
      }

      attempts++;
      if (attempts >= maxAttempts) {
        onboardingLogger.error(`[Onboarding] Step ${targetStep}: Button not found after ${BUTTON_POLLING_TIMEOUT}ms`);
        return true;
      }

      return false;
    };

    const interval = setInterval(() => {
      if (attachListener()) clearInterval(interval);
    }, BUTTON_POLLING_INTERVAL);

    return () => {
      isCleanedUp = true;
      clearInterval(interval);
      if (buttonRef.current) {
        buttonRef.current.removeEventListener('click', handleButtonClick, { capture: true });
      }
    };
  }, [currentStep, targetStep, selector, onFirstClick, modalShownRef]);
}

/**
 * Hook pour intercepter via event delegation (pour boutons qui peuvent être re-rendered)
 */
export function useDelegatedButtonInterception({
  currentStep,
  targetStep,
  selector,
  onFirstClick,
  modalShownRef
}) {
  useEffect(() => {
    if (currentStep !== targetStep) return;

    let isCleanedUp = false;

    const handleButtonClick = (e) => {
      if (isCleanedUp) return;

      const button = e.target.closest(selector);
      if (!button) return;

      if (modalShownRef.current) {
        onboardingLogger.log(`[Onboarding] Step ${targetStep}: Modal already shown, allowing normal button behavior`);
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      modalShownRef.current = true;
      onFirstClick(e);
    };

    document.addEventListener('click', handleButtonClick, { capture: true });

    return () => {
      isCleanedUp = true;
      document.removeEventListener('click', handleButtonClick, { capture: true });
    };
  }, [currentStep, targetStep, selector, onFirstClick, modalShownRef]);
}
