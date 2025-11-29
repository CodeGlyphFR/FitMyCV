/**
 * Logger conditionnel pour le système d'onboarding
 *
 * En développement : Affiche tous les logs dans la console
 * En production : N'affiche que les erreurs et warnings
 *
 * Usage :
 * ```js
 * import { onboardingLogger } from '@/lib/utils/onboardingLogger';
 *
 * onboardingLogger.log('[OnboardingProvider] Step complété');
 * onboardingLogger.error('[OnboardingProvider] Error:', error);
 * onboardingLogger.warn('[OnboardingProvider] Warning:', warning);
 * ```
 */

const isDev = process.env.NODE_ENV === 'development';

export const onboardingLogger = {
  /**
   * Log informatif (affiché uniquement en développement)
   * @param {string} message - Message à logger
   * @param {...any} args - Arguments additionnels
   */
  log: (message, ...args) => {
    if (isDev) {
      console.log(message, ...args);
    }
  },

  /**
   * Log d'erreur (toujours affiché)
   * @param {string} message - Message d'erreur
   * @param {...any} args - Arguments additionnels (souvent l'objet Error)
   */
  error: (message, ...args) => {
    console.error(message, ...args);
  },

  /**
   * Log de warning (toujours affiché)
   * @param {string} message - Message de warning
   * @param {...any} args - Arguments additionnels
   */
  warn: (message, ...args) => {
    console.warn(message, ...args);
  },
};
