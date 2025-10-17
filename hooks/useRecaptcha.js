import { useCallback } from 'react';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';

/**
 * Hook personnalisé pour utiliser reCAPTCHA v3
 *
 * @example
 * const { executeRecaptcha, verifyRecaptcha } = useRecaptcha();
 *
 * // Obtenir un token
 * const token = await executeRecaptcha('submit_form');
 *
 * // Vérifier via l'API
 * const isValid = await verifyRecaptcha(token);
 */
export function useRecaptcha() {
  const { executeRecaptcha: executeGoogleRecaptcha } = useGoogleReCaptcha();

  /**
   * Exécute reCAPTCHA et retourne un token
   * @param {string} action - L'action effectuée (ex: 'submit_form', 'login', 'signup')
   * @returns {Promise<string|null>} Token reCAPTCHA ou null en cas d'erreur
   */
  const executeRecaptcha = useCallback(async (action = 'submit') => {
    if (!executeGoogleRecaptcha) {
      console.warn('[useRecaptcha] reCAPTCHA not ready yet');
      return null;
    }

    try {
      const token = await executeGoogleRecaptcha(action);
      return token;
    } catch (error) {
      console.error('[useRecaptcha] Error executing reCAPTCHA:', error);
      return null;
    }
  }, [executeGoogleRecaptcha]);

  /**
   * Vérifie un token reCAPTCHA via l'API backend
   * @param {string} token - Token reCAPTCHA à vérifier
   * @param {string} action - L'action qui a généré le token
   * @returns {Promise<{success: boolean, score?: number, error?: string}>}
   */
  const verifyRecaptcha = useCallback(async (token, action = 'submit') => {
    if (!token) {
      return { success: false, error: 'No token provided' };
    }

    try {
      const response = await fetch('/api/recaptcha/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, action }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[useRecaptcha] Error verifying reCAPTCHA:', error);
      return { success: false, error: error.message };
    }
  }, []);

  /**
   * Exécute et vérifie reCAPTCHA en une seule étape
   * @param {string} action - L'action effectuée
   * @returns {Promise<{success: boolean, score?: number, token?: string, error?: string}>}
   */
  const executeAndVerify = useCallback(async (action = 'submit') => {
    const token = await executeRecaptcha(action);
    if (!token) {
      return { success: false, error: 'Failed to get reCAPTCHA token' };
    }
    const result = await verifyRecaptcha(token, action);
    // Retourner le token en plus du résultat de vérification
    return { ...result, token };
  }, [executeRecaptcha, verifyRecaptcha]);

  return {
    executeRecaptcha,
    verifyRecaptcha,
    executeAndVerify,
  };
}
