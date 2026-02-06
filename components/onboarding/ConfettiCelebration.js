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
 * Joue un son d'applaudissements synthétisé via Web Audio API
 * (bruit filtré avec enveloppe qui simule des claps répétés)
 */
function playApplauseSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const duration = 2.0;

    // Bruit blanc filtré pour simuler des applaudissements
    const bufferSize = ctx.sampleRate * duration;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    // Filtre passe-bande pour un son de clap
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 3000;
    bandpass.Q.value = 0.5;

    // Enveloppe avec pulsations (simule des claps individuels)
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);

    // Série de claps qui montent puis descendent
    const clapCount = 14;
    for (let i = 0; i < clapCount; i++) {
      const t = now + i * 0.14;
      const peak = i < 7 ? 0.06 + i * 0.012 : 0.12 - (i - 7) * 0.012;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(Math.max(peak, 0.02), t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    }

    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + duration);

    // Accord final de victoire : C5, E5, G5 (triade majeure)
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const start = now + 1.6 + i * 0.08;
      oscGain.gain.setValueAtTime(0, start);
      oscGain.gain.linearRampToValueAtTime(0.12, start + 0.03);
      oscGain.gain.exponentialRampToValueAtTime(0.001, start + 0.8);
      osc.start(start);
      osc.stop(start + 0.8);
    });

    setTimeout(() => ctx.close(), 3500);
  } catch (e) {
    // Audio non disponible, skip silencieusement
  }
}

/**
 * Déclenche la célébration finale de l'onboarding (confetti spectaculaire + applaudissements)
 * Retourne une Promise qui resolve après la durée de la célébration
 * @param {number} duration - Durée en ms avant de résoudre (défaut: 2500ms)
 */
export function triggerFinalCelebration(duration = 2500) {
  return new Promise((resolve) => {
    try {
      playApplauseSound();

      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99999';
      document.body.appendChild(canvas);

      const finalConfetti = confetti.create(canvas, { resize: true });

      // Salve initiale puissante
      finalConfetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#10B981', '#34D399', '#6EE7B7', '#A78BFA', '#60A5FA', '#FBBF24', '#F59E0B'],
      });

      // Salves latérales
      setTimeout(() => {
        finalConfetti({
          particleCount: 60,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.5 },
          colors: ['#10B981', '#34D399', '#A78BFA', '#FBBF24'],
        });
        finalConfetti({
          particleCount: 60,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.5 },
          colors: ['#10B981', '#34D399', '#A78BFA', '#FBBF24'],
        });
      }, 300);

      // Deuxième vague
      setTimeout(() => {
        finalConfetti({
          particleCount: 80,
          spread: 90,
          origin: { y: 0.4 },
          colors: ['#10B981', '#6EE7B7', '#60A5FA', '#FBBF24', '#F59E0B'],
        });
      }, 700);

      // Nettoyage du canvas
      setTimeout(() => canvas.remove(), 4000);
    } catch (error) {
      onboardingLogger.error('[Onboarding] Erreur final celebration:', error);
    }

    setTimeout(resolve, duration);
  });
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
