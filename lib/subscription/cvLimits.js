/**
 * Système de gestion des CV (limites retirées)
 *
 * Règles :
 * - TOUS les utilisateurs peuvent créer un nombre illimité de CV
 * - Les crédits sont utilisés uniquement pour les features IA (pas pour créer des CV)
 * - Les fonctions de blocage/déblocage sont conservées pour compatibilité future
 */

import prisma from '@/lib/prisma';
import { getCreditBalance, debitCredit } from './credits';

/**
 * Vérifie si l'utilisateur peut créer un nouveau CV
 * SIMPLIFIÉ : Retourne toujours true (limitation de CV retirée)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<{canCreate: boolean, reason: string, requiresCredit: boolean, cvCount: number, limit: number}>}
 */
export async function canCreateNewCv(userId) {
  try {
    // Vérifier l'abonnement actif
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription) {
      return {
        canCreate: false,
        reason: 'Aucun abonnement actif',
        requiresCredit: false,
        cvCount: 0,
        limit: -1,
      };
    }

    if (subscription.status !== 'active') {
      return {
        canCreate: false,
        reason: `Abonnement ${subscription.status}`,
        requiresCredit: false,
        cvCount: 0,
        limit: -1,
      };
    }

    // Compter les CV non bloqués (pour info)
    const cvCount = await prisma.cvFile.count({
      where: {
        userId,
        blocked: false,
      },
    });

    // TOUJOURS autoriser la création (limitation retirée)
    return {
      canCreate: true,
      reason: 'Création de CV illimitée',
      requiresCredit: false,
      cvCount,
      limit: -1,
    };
  } catch (error) {
    console.error('[CvLimits] Erreur dans canCreateNewCv:', error);
    return {
      canCreate: false,
      reason: 'Erreur lors de la vérification',
      requiresCredit: false,
      cvCount: 0,
      limit: -1,
    };
  }
}

/**
 * Réserve un crédit pour créer un CV (DÉSACTIVÉ - CV illimités)
 * Cette fonction retourne toujours succès sans débiter de crédit
 * Conservée pour compatibilité avec le code existant
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @returns {Promise<{success: boolean, transactionId?: string, error?: string}>}
 */
export async function reserveCreditForCv(userId, filename) {
  try {
    // Vérifier si l'utilisateur peut créer des CV
    const check = await canCreateNewCv(userId);

    if (!check.canCreate) {
      return {
        success: false,
        error: check.reason,
      };
    }

    // Toujours autoriser sans débiter de crédit
    return {
      success: true,
      requiresCredit: false,
    };
  } catch (error) {
    console.error('[CvLimits] Erreur dans reserveCreditForCv:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de la vérification',
    };
  }
}

/**
 * Bloque les CV en excès lors d'un downgrade d'abonnement
 * @param {string} userId - ID de l'utilisateur
 * @param {Array<string>} cvIdsToBlock - IDs des CV à bloquer (choisis par l'utilisateur)
 * @param {string} reason - Raison du blocage
 * @returns {Promise<{success: boolean, blocked: number, error?: string}>}
 */
export async function blockCvsForDowngrade(userId, cvIdsToBlock, reason = 'Downgrade abonnement') {
  try {
    const result = await prisma.cvFile.updateMany({
      where: {
        id: { in: cvIdsToBlock },
        userId, // Sécurité : vérifier que les CV appartiennent bien à l'utilisateur
        blocked: false, // Ne bloquer que les CV non bloqués
      },
      data: {
        blocked: true,
        blockedAt: new Date(),
        blockedReason: reason,
      },
    });

    console.log(`[CvLimits] ${result.count} CV bloqués pour user ${userId}`);
    return {
      success: true,
      blocked: result.count,
    };
  } catch (error) {
    console.error('[CvLimits] Erreur dans blockCvsForDowngrade:', error);
    return {
      success: false,
      blocked: 0,
      error: error.message || 'Erreur lors du blocage des CV',
    };
  }
}

/**
 * Débloque des CV (upgrade ou réactivation d'abonnement)
 * @param {string} userId - ID de l'utilisateur
 * @param {Array<string>} cvIdsToUnblock - IDs des CV à débloquer
 * @returns {Promise<{success: boolean, unblocked: number, error?: string}>}
 */
export async function unblockCvs(userId, cvIdsToUnblock) {
  try {
    const result = await prisma.cvFile.updateMany({
      where: {
        id: { in: cvIdsToUnblock },
        userId,
        blocked: true,
      },
      data: {
        blocked: false,
        blockedAt: null,
        blockedReason: null,
      },
    });

    console.log(`[CvLimits] ${result.count} CV débloqués pour user ${userId}`);
    return {
      success: true,
      unblocked: result.count,
    };
  } catch (error) {
    console.error('[CvLimits] Erreur dans unblockCvs:', error);
    return {
      success: false,
      unblocked: 0,
      error: error.message || 'Erreur lors du déblocage des CV',
    };
  }
}

/**
 * Récupère les suggestions de CV à bloquer lors d'un downgrade
 * Priorité : CV créés avec crédits > CV les plus anciens
 * @param {string} userId - ID de l'utilisateur
 * @param {number} newLimit - Nouvelle limite de CV du plan
 * @returns {Promise<Array<{id: string, filename: string, createdWithCredit: boolean, createdAt: Date}>>}
 */
export async function getSuggestedCvsToBlock(userId, newLimit) {
  // Compter les CV non bloqués
  const totalCvs = await prisma.cvFile.count({
    where: {
      userId,
      blocked: false,
    },
  });

  if (totalCvs <= newLimit) {
    return []; // Pas besoin de bloquer
  }

  const numberToBlock = totalCvs - newLimit;

  // Récupérer tous les CV non bloqués, triés par priorité
  const allCvs = await prisma.cvFile.findMany({
    where: {
      userId,
      blocked: false,
    },
    select: {
      id: true,
      filename: true,
      createdWithCredit: true,
      createdAt: true,
    },
    orderBy: [
      { createdWithCredit: 'desc' }, // CV créés avec crédits en premier
      { createdAt: 'asc' }, // Puis par ancienneté
    ],
  });

  // Retourner les N premiers CV à bloquer
  return allCvs.slice(0, numberToBlock);
}

/**
 * Récupère les statistiques de CV pour un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<{total: number, active: number, blocked: number, createdWithCredits: number}>}
 */
export async function getCvStats(userId) {
  const [total, blocked, createdWithCredits] = await Promise.all([
    prisma.cvFile.count({ where: { userId } }),
    prisma.cvFile.count({ where: { userId, blocked: true } }),
    prisma.cvFile.count({ where: { userId, createdWithCredit: true } }),
  ]);

  return {
    total,
    active: total - blocked,
    blocked,
    createdWithCredits,
  };
}
