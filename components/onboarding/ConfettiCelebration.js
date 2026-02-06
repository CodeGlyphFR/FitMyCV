import confetti from 'canvas-confetti';
import { onboardingLogger } from '@/lib/utils/onboardingLogger';

/**
 * Joue un son de chime agréable via Web Audio API
 */
function playStepChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    // Deux notes ascendantes : C5, E5
    [523.25, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.start(start);
      osc.stop(start + 0.4);
    });

    setTimeout(() => ctx.close(), 1000);
  } catch (e) {
    // Audio non disponible, skip silencieusement
  }
}

/**
 * Déclenche l'animation de célébration entre les étapes (confetti centré + son)
 * Utilise un canvas dédié avec z-index garanti au-dessus des overlays d'onboarding
 */
export function triggerStepCelebration() {
  try {
    playStepChime();

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99999';
    document.body.appendChild(canvas);

    const stepConfetti = confetti.create(canvas, { resize: true });

    stepConfetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10B981', '#34D399', '#6EE7B7', '#A78BFA', '#60A5FA'],
    });

    setTimeout(() => {
      stepConfetti({
        particleCount: 40,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ['#10B981', '#34D399', '#6EE7B7', '#A78BFA', '#60A5FA'],
      });
      stepConfetti({
        particleCount: 40,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ['#10B981', '#34D399', '#6EE7B7', '#A78BFA', '#60A5FA'],
      });
    }, 200);

    // Nettoyage du canvas après l'animation
    setTimeout(() => {
      canvas.remove();
    }, 3000);
  } catch (error) {
    onboardingLogger.error('[Onboarding] Erreur step celebration:', error);
  }
}

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
