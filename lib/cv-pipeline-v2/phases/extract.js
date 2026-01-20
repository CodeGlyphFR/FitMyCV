/**
 * Phase Extraction - Pipeline CV v2
 *
 * Extrait les offres d'emploi depuis les URLs ou fichiers PDF.
 * Cette phase est maintenant async pour permettre le suivi de progression.
 *
 * Pour chaque offre:
 * - Vérifie le cache (URL ou hash)
 * - Si pas en cache, appelle OpenAI pour extraire
 * - Met à jour CvGenerationOffer avec le jobOfferId
 * - Émet des événements SSE de progression
 */

import prisma from '@/lib/prisma';
import { getOrExtractJobOfferFromUrl, getOrExtractJobOfferFromPdf } from '@/lib/openai/extraction';

/**
 * Détermine si la source est un fichier local (préfixe file://)
 */
function isFileSource(sourceUrl) {
  return sourceUrl && sourceUrl.startsWith('file://');
}

/**
 * Extrait le chemin du fichier depuis une URL file://
 */
function extractFilePath(sourceUrl) {
  return sourceUrl.replace('file://', '');
}

/**
 * Exécute l'extraction d'une offre d'emploi depuis une URL ou un fichier PDF
 *
 * @param {Object} params
 * @param {string} params.offerId - ID de l'offre (CvGenerationOffer)
 * @param {string} params.sourceUrl - URL de l'offre ou chemin PDF (file://)
 * @param {string} params.userId - ID de l'utilisateur
 * @param {AbortSignal} [params.signal] - Signal pour annulation
 * @returns {Promise<Object>} - { success, jobOfferId, jobOffer, title, fromCache, error }
 */
export async function executeExtraction({ offerId, sourceUrl, userId, signal = null }) {
  const startTime = Date.now();
  const isPdfSource = isFileSource(sourceUrl);
  const displaySource = isPdfSource ? extractFilePath(sourceUrl).split('/').pop() : sourceUrl;

  console.log(`[extract] Starting extraction for offer ${offerId}: ${displaySource} (PDF: ${isPdfSource})`);

  // Créer une subtask pour tracker l'extraction
  const subtask = await prisma.cvGenerationSubtask.create({
    data: {
      offerId,
      type: 'extraction',
      status: 'running',
      input: isPdfSource ? { pdfPath: extractFilePath(sourceUrl) } : { url: sourceUrl },
    },
  });

  try {
    // Vérifier si annulé
    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    // Appeler la fonction d'extraction appropriée
    let result;
    if (isPdfSource) {
      const pdfPath = extractFilePath(sourceUrl);
      const pdfName = pdfPath.split('/').pop();
      result = await getOrExtractJobOfferFromPdf(userId, pdfPath, pdfName, signal);
    } else {
      result = await getOrExtractJobOfferFromUrl(userId, sourceUrl, signal);
    }

    const duration = Date.now() - startTime;

    // Mettre à jour la subtask avec le succès
    await prisma.cvGenerationSubtask.update({
      where: { id: subtask.id },
      data: {
        status: 'completed',
        output: {
          jobOfferId: result.jobOfferId,
          title: result.title,
          fromCache: result.fromCache,
        },
        durationMs: duration,
      },
    });

    // Mettre à jour l'offre avec le jobOfferId extrait
    await prisma.cvGenerationOffer.update({
      where: { id: offerId },
      data: {
        jobOfferId: result.jobOfferId,
      },
    });

    console.log(`[extract] Extraction completed for offer ${offerId}: ${result.title} (cache: ${result.fromCache}, ${duration}ms)`);

    return {
      success: true,
      jobOfferId: result.jobOfferId,
      jobOffer: result.extraction,
      title: result.title,
      fromCache: result.fromCache,
      duration,
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(`[extract] Extraction failed for offer ${offerId}:`, error.message);

    // Mettre à jour la subtask avec l'échec
    await prisma.cvGenerationSubtask.update({
      where: { id: subtask.id },
      data: {
        status: 'failed',
        error: error.message,
        durationMs: duration,
      },
    });

    return {
      success: false,
      error: error.message,
      duration,
    };
  }
}

/**
 * Récupère l'offre d'emploi depuis le cache ou la DB
 * Utilisé après l'extraction pour les phases suivantes
 *
 * @param {string} jobOfferId - ID de l'offre d'emploi
 * @returns {Promise<Object|null>} - L'offre d'emploi ou null
 */
export async function getJobOfferById(jobOfferId) {
  if (!jobOfferId) return null;

  const jobOffer = await prisma.jobOffer.findUnique({
    where: { id: jobOfferId },
    select: { content: true },
  });

  return jobOffer?.content || null;
}
