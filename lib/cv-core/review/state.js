/**
 * Gestion de l'état de review des modifications CV
 *
 * Ce module gère l'initialisation, la récupération et la mise à jour
 * de l'état de review des modifications IA.
 */

import prisma from '@/lib/prisma';
import { computeDetailedChanges } from '../modifications/diff.js';

/**
 * Mettre à jour le statut d'un changement dans pendingChanges
 *
 * @param {Array} pendingChanges - Array des changements
 * @param {string} changeId - ID du changement à mettre à jour
 * @param {string} status - Nouveau statut ('accepted' | 'rejected')
 * @returns {Array} Array mis à jour
 */
export function updateChangeStatus(pendingChanges, changeId, status) {
  if (!pendingChanges || !Array.isArray(pendingChanges)) {
    return [];
  }

  return pendingChanges.map((change) => {
    if (change.id === changeId) {
      return {
        ...change,
        status,
        reviewedAt: new Date().toISOString(),
      };
    }
    return change;
  });
}

/**
 * Vérifier si tous les changements ont été reviewés
 *
 * @param {Array} pendingChanges - Array des changements
 * @returns {boolean} true si tous les changements sont accepted ou rejected
 */
export function allChangesReviewed(pendingChanges) {
  if (!pendingChanges || !Array.isArray(pendingChanges) || pendingChanges.length === 0) {
    return true;
  }

  return pendingChanges.every((change) => change.status !== 'pending');
}

/**
 * Calculer la progression de review
 *
 * @param {Array} pendingChanges - Array des changements
 * @returns {Object} { total, reviewed, pending, percentComplete }
 */
export function getReviewProgress(pendingChanges) {
  if (!pendingChanges || !Array.isArray(pendingChanges)) {
    return { total: 0, reviewed: 0, pending: 0, percentComplete: 100 };
  }

  const total = pendingChanges.length;
  const reviewed = pendingChanges.filter((c) => c.status !== 'pending').length;
  const pending = total - reviewed;
  const percentComplete = total > 0 ? Math.round((reviewed / total) * 100) : 100;

  return { total, reviewed, pending, percentComplete };
}

/**
 * Nettoyer l'état de review après que tous les changements ont été traités
 *
 * @param {string} cvFileId - ID du CvFile
 * @returns {Promise<void>}
 */
export async function clearReviewState(cvFileId) {
  await prisma.cvFile.update({
    where: { id: cvFileId },
    data: {
      pendingChanges: null,
      pendingSourceVersion: null,
    },
  });
}

/**
 * Initialiser l'état de review après une modification IA
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @param {Array} changesMade - Changements de l'IA
 * @param {number} sourceVersion - Version à comparer
 * @returns {Promise<Array>} Les changements détaillés initialisés
 */
export async function initializeReviewState(userId, filename, changesMade, sourceVersion) {
  console.log(`[initializeReviewState] Starting for ${filename}, sourceVersion=${sourceVersion}, changesMade=${changesMade?.length || 0}`);

  const cvFile = await prisma.cvFile.findUnique({
    where: { userId_filename: { userId, filename } },
    select: { id: true, content: true },
  });

  if (!cvFile) {
    throw new Error(`CV not found: ${filename}`);
  }

  console.log(`[initializeReviewState] CvFile found: ${cvFile.id}`);

  // Récupérer le contenu de la version source
  const sourceVersionRecord = await prisma.cvVersion.findFirst({
    where: {
      cvFileId: cvFile.id,
      version: sourceVersion,
    },
    select: { content: true },
  });

  console.log(`[initializeReviewState] Source version ${sourceVersion} found: ${!!sourceVersionRecord}`);

  const previousContent = sourceVersionRecord?.content || {};

  // Calculer les diffs détaillés
  const detailedChanges = computeDetailedChanges(
    cvFile.content,
    previousContent,
    changesMade
  );

  console.log(`[initializeReviewState] Computed ${detailedChanges.length} detailed changes`);

  // Sauvegarder l'état de review
  await prisma.cvFile.update({
    where: { id: cvFile.id },
    data: {
      pendingChanges: detailedChanges,
      pendingSourceVersion: sourceVersion,
    },
  });

  console.log(`[initializeReviewState] Review state saved to DB`);

  return detailedChanges;
}

/**
 * Récupérer l'état de review actuel d'un CV
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @returns {Promise<Object|null>} { pendingChanges, pendingSourceVersion, progress }
 */
export async function getReviewState(userId, filename) {
  const cvFile = await prisma.cvFile.findUnique({
    where: { userId_filename: { userId, filename } },
    select: {
      pendingChanges: true,
      pendingSourceVersion: true,
    },
  });

  if (!cvFile || !cvFile.pendingChanges) {
    return null;
  }

  const allChanges = cvFile.pendingChanges;
  const progress = getReviewProgress(allChanges);

  // Ne retourner que les changements encore pending au client
  // Les changements acceptés/rejetés sont conservés en DB pour l'historique mais pas affichés
  const pendingOnly = allChanges.filter(c => c.status === 'pending');

  return {
    pendingChanges: pendingOnly,
    pendingSourceVersion: cvFile.pendingSourceVersion,
    progress,
  };
}
