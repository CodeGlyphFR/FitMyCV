/**
 * Actions de review des modifications CV
 *
 * Ce module gère les actions d'acceptation et de rejet
 * des modifications proposées par l'IA.
 */

import prisma from '@/lib/prisma';
import { updateChangeStatus, allChangesReviewed, getReviewProgress } from './state.js';
import { applyPartialRollback } from './rollback.js';

/**
 * Traiter une action de review (accept ou reject)
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @param {string} changeId - ID du changement
 * @param {string} action - 'accept' | 'reject'
 * @returns {Promise<Object>} { success, updatedChanges, cvUpdated, allReviewed }
 */
export async function processReviewAction(userId, filename, changeId, action) {
  if (!['accept', 'reject'].includes(action)) {
    throw new Error(`Invalid action: ${action}. Must be 'accept' or 'reject'`);
  }

  const cvFile = await prisma.cvFile.findUnique({
    where: { userId_filename: { userId, filename } },
    select: {
      id: true,
      content: true,
      pendingChanges: true,
      pendingSourceVersion: true,
    },
  });

  if (!cvFile || !cvFile.pendingChanges) {
    throw new Error(`No pending changes for CV: ${filename}`);
  }

  const pendingChanges = cvFile.pendingChanges;
  const change = pendingChanges.find((c) => c.id === changeId);

  if (!change) {
    throw new Error(`Change not found: ${changeId}`);
  }

  let updatedCv = cvFile.content;
  let cvUpdated = false;

  // Si reject, appliquer le rollback partiel
  if (action === 'reject') {
    updatedCv = applyPartialRollback(cvFile.content, change);
    cvUpdated = true;
  }

  // Mettre à jour le statut
  const updatedChanges = updateChangeStatus(pendingChanges, changeId, action === 'accept' ? 'accepted' : 'rejected');
  const allReviewed = allChangesReviewed(updatedChanges);

  // Mettre à jour la base de données
  const updateData = {
    pendingChanges: allReviewed ? null : updatedChanges,
    pendingSourceVersion: allReviewed ? null : cvFile.pendingSourceVersion,
  };

  if (cvUpdated) {
    updateData.content = updatedCv;
  }

  await prisma.cvFile.update({
    where: { id: cvFile.id },
    data: updateData,
  });

  return {
    success: true,
    updatedChanges: allReviewed ? [] : updatedChanges,
    cvUpdated,
    allReviewed,
    progress: getReviewProgress(allReviewed ? [] : updatedChanges),
  };
}

/**
 * Traiter plusieurs actions de review en batch (une seule opération DB)
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @param {string[]} changeIds - IDs des changements à traiter
 * @param {string} action - 'accept' | 'reject'
 * @returns {Promise<Object>} { success, updatedChanges, cvUpdated, allReviewed, processedCount }
 */
export async function processBatchReviewAction(userId, filename, changeIds, action) {
  if (!['accept', 'reject'].includes(action)) {
    throw new Error(`Invalid action: ${action}. Must be 'accept' or 'reject'`);
  }

  if (!changeIds || !Array.isArray(changeIds) || changeIds.length === 0) {
    throw new Error('No change IDs provided');
  }

  const cvFile = await prisma.cvFile.findUnique({
    where: { userId_filename: { userId, filename } },
    select: {
      id: true,
      content: true,
      pendingChanges: true,
      pendingSourceVersion: true,
    },
  });

  if (!cvFile || !cvFile.pendingChanges) {
    throw new Error(`No pending changes for CV: ${filename}`);
  }

  let pendingChanges = [...cvFile.pendingChanges];
  let updatedCv = JSON.parse(JSON.stringify(cvFile.content));
  let cvUpdated = false;
  let processedCount = 0;

  // Traiter tous les changements
  for (const changeId of changeIds) {
    const change = pendingChanges.find((c) => c.id === changeId);
    if (!change) {
      console.warn(`[processBatchReviewAction] Change not found: ${changeId}, skipping`);
      continue;
    }

    // Si reject, appliquer le rollback partiel
    if (action === 'reject') {
      try {
        updatedCv = applyPartialRollback(updatedCv, change);
        cvUpdated = true;
      } catch (error) {
        console.error(`[processBatchReviewAction] Rollback failed for ${changeId}:`, error);
      }
    }

    // Mettre à jour le statut
    pendingChanges = updateChangeStatus(
      pendingChanges,
      changeId,
      action === 'accept' ? 'accepted' : 'rejected'
    );
    processedCount++;
  }

  const allReviewed = allChangesReviewed(pendingChanges);

  // Une seule mise à jour de la base de données
  const updateData = {
    pendingChanges: allReviewed ? null : pendingChanges,
    pendingSourceVersion: allReviewed ? null : cvFile.pendingSourceVersion,
  };

  if (cvUpdated) {
    updateData.content = updatedCv;
  }

  await prisma.cvFile.update({
    where: { id: cvFile.id },
    data: updateData,
  });

  console.log(`[processBatchReviewAction] Processed ${processedCount}/${changeIds.length} changes for ${filename}`);

  return {
    success: true,
    updatedChanges: allReviewed ? [] : pendingChanges,
    cvUpdated,
    allReviewed,
    processedCount,
    progress: getReviewProgress(allReviewed ? [] : pendingChanges),
  };
}
