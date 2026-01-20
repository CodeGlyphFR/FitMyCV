import confetti from 'canvas-confetti';
import { onboardingLogger } from '@/lib/utils/onboardingLogger';

/**
 * Déclenche l'animation de confetti pour célébrer la complétion
 */
export function triggerCompletionConfetti() {
  try {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10B981', '#34D399', '#6EE7B7'],
    });

    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#10B981', '#34D399', '#6EE7B7'],
      });
    }, 250);

    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#10B981', '#34D399', '#6EE7B7'],
      });
    }, 400);
  } catch (error) {
    onboardingLogger.error('[Onboarding] Erreur confetti:', error);
  }
}
