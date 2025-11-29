/**
 * CV Language detection utilities
 *
 * This module provides shared functions for detecting and persisting CV language.
 * Used by background jobs (import, generate, translate) and the mutate API.
 */

import { readUserCvFile, writeUserCvFile } from '@/lib/cv/storage';
import { DEFAULT_LANGUAGE } from './languageConstants';

/**
 * Detects the language of a CV and persists it to the CV JSON file.
 *
 * This is a non-blocking operation - if detection fails, the CV is preserved
 * without a language field (fallback to keyword detection).
 *
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.filename - CV filename
 * @param {string} [params.cvContent] - CV content as JSON string (optional, will read from file if not provided)
 * @param {AbortSignal} [params.signal] - Abort signal for cancellation
 * @returns {Promise<string>} - Detected language code ('fr' or 'en')
 */
export async function detectAndPersistCvLanguage({
  userId,
  filename,
  cvContent = null,
  signal = null,
}) {
  try {
    // Read CV if content not provided
    const content = cvContent || (await readUserCvFile(userId, filename));
    const cvData = JSON.parse(content);
    const summaryDescription = cvData?.summary?.description || '';

    // Dynamic import to avoid circular dependencies
    const { detectCvLanguageWithOpenAI } = await import('@/lib/openai/detectLanguage');

    const detectedLanguage = await detectCvLanguageWithOpenAI({
      summaryDescription,
      signal,
      userId,
    });

    // Update CV with detected language
    cvData.language = detectedLanguage;
    await writeUserCvFile(userId, filename, JSON.stringify(cvData, null, 2));

    console.log(`[detectAndPersistCvLanguage] Langue détectée et sauvegardée: ${detectedLanguage}`);
    return detectedLanguage;
  } catch (error) {
    if (error.message === 'Task cancelled' || signal?.aborted) {
      throw error; // Re-throw cancellations
    }
    console.error('[detectAndPersistCvLanguage] Erreur détection langue (non-bloquant):', error.message);
    return DEFAULT_LANGUAGE;
  }
}

/**
 * Detects language asynchronously without blocking the caller.
 * Fire-and-forget pattern for use in API routes where response should be immediate.
 *
 * @param {Object} params - Same as detectAndPersistCvLanguage
 * @returns {Promise<void>} - Resolves immediately, detection happens in background
 */
export function detectLanguageInBackground(params) {
  // Fire-and-forget - don't await
  detectAndPersistCvLanguage(params).catch((error) => {
    console.error('[detectLanguageInBackground] Background detection failed:', error.message);
  });
}

/**
 * Gets the language from a CV, with fallback to default.
 *
 * @param {Object|string} cvContent - CV data object or JSON string
 * @returns {string} - Language code ('fr' or 'en')
 */
export function getCvLanguage(cvContent) {
  try {
    const cv = typeof cvContent === 'string' ? JSON.parse(cvContent) : cvContent;
    return cv.language || DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}
