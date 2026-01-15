/**
 * CV Language detection utilities
 *
 * This module provides shared functions for detecting and persisting CV language.
 * Used by background jobs (import, generate, translate) and the mutate API.
 *
 * IMPORTANT: La langue est stockée en DB (CvFile.language), PAS dans le JSON CV.
 */

import { readUserCvFile } from '@/lib/cv/storage';
import prisma from '@/lib/prisma';
import { DEFAULT_LANGUAGE } from './languageConstants';

/**
 * Detects the language of a CV and persists it to the database (CvFile.language).
 *
 * This is a non-blocking operation - if detection fails, the default language is returned.
 * The language is stored in CvFile.language, NOT in the CV JSON content.
 *
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.filename - CV filename
 * @param {string} [params.cvContent] - CV content as JSON string (optional, will read from file if not provided)
 * @param {AbortSignal} [params.signal] - Abort signal for cancellation
 * @returns {Promise<string>} - Detected language code ('fr', 'en', 'es', 'de')
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

    // Stocker la langue en DB uniquement (pas dans le JSON)
    await prisma.cvFile.update({
      where: { userId_filename: { userId, filename } },
      data: { language: detectedLanguage }
    });

    console.log(`[detectAndPersistCvLanguage] Langue détectée et sauvegardée en DB: ${detectedLanguage}`);
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
 * Gets the language from a CV JSON content, with fallback to default.
 *
 * DEPRECATED: Préférer CvFile.language depuis la DB.
 * Cette fonction est conservée pour rétrocompatibilité avec les anciens CVs
 * qui ont encore la langue dans le JSON.
 *
 * @param {Object|string} cvContent - CV data object or JSON string
 * @returns {string} - Language code ('fr', 'en', 'es', 'de')
 */
export function getCvLanguage(cvContent) {
  try {
    const cv = typeof cvContent === 'string' ? JSON.parse(cvContent) : cvContent;
    return cv.language || DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}
