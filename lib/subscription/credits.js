/**
 * Système de gestion des crédits utilisateur
 *
 * Fonctions principales :
 * - getCreditBalance() : Récupère la balance de crédits
 * - debitCredit() : Débite des crédits (avec transaction atomique)
 * - refundCredit() : Rembourse des crédits suite à une annulation
 * - grantCredits() : Attribution de crédits (achat, bonus, parrainage)
 */

import prisma from '@/lib/prisma';

/**
 * Récupère la balance de crédits d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<{balance: number, totalPurchased: number, totalUsed: number, totalRefunded: number, totalGifted: number}>}
 */
export async function getCreditBalance(userId) {
  let creditBalance = await prisma.creditBalance.findUnique({
    where: { userId },
  });

  // Créer la balance si elle n'existe pas
  if (!creditBalance) {
    creditBalance = await prisma.creditBalance.create({
      data: {
        userId,
        balance: 0,
        totalPurchased: 0,
        totalUsed: 0,
        totalRefunded: 0,
        totalGifted: 0,
      },
    });
  }

  return creditBalance;
}

/**
 * Débite des crédits du compte utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {number} amount - Nombre de crédits à débiter (positif)
 * @param {string} type - Type de transaction (usage, cv_creation)
 * @param {object} metadata - Métadonnées additionnelles {featureName?, taskId?, cvFileId?}
 * @returns {Promise<{success: boolean, transaction?: object, error?: string}>}
 */
export async function debitCredit(userId, amount, type = 'usage', metadata = {}) {
  if (amount <= 0) {
    return { success: false, error: 'Le montant doit être supérieur à 0' };
  }

  try {
    // Transaction atomique pour garantir la cohérence
    const result = await prisma.$transaction(async (tx) => {
      // Vérifier la balance actuelle
      const balance = await tx.creditBalance.findUnique({
        where: { userId },
      });

      if (!balance || balance.balance < amount) {
        throw new Error('Crédits insuffisants');
      }

      // Créer la transaction de débit
      const transaction = await tx.creditTransaction.create({
        data: {
          userId,
          amount: -amount, // Négatif pour débit
          type,
          featureName: metadata.featureName || null,
          taskId: metadata.taskId || null,
          cvFileId: metadata.cvFileId || null,
          metadata: metadata.extra ? JSON.stringify(metadata.extra) : null,
        },
      });

      // Mettre à jour la balance
      const updatedBalance = await tx.creditBalance.update({
        where: { userId },
        data: {
          balance: { decrement: amount },
          totalUsed: { increment: amount },
        },
      });

      return { transaction, balance: updatedBalance };
    });

    console.log(`[Credits] Débit de ${amount} crédit(s) pour user ${userId} (type: ${type})`);
    return { success: true, transaction: result.transaction, balance: result.balance.balance };
  } catch (error) {
    console.error('[Credits] Erreur lors du débit:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors du débit de crédits',
    };
  }
}

/**
 * Débite des crédits sans vérifier la balance (utilisé pour chargebacks)
 * Permet des balances négatives
 * @param {string} userId - ID de l'utilisateur
 * @param {number} amount - Nombre de crédits à débiter (positif)
 * @param {string} type - Type de transaction (chargeback)
 * @param {object} metadata - Métadonnées additionnelles
 * @returns {Promise<{success: boolean, transaction?: object, newBalance?: number, error?: string}>}
 */
export async function debitCredits(userId, amount, type = 'chargeback', metadata = {}) {
  if (amount <= 0) {
    return { success: false, error: 'Le montant doit être supérieur à 0' };
  }

  try {
    // Transaction atomique
    const result = await prisma.$transaction(async (tx) => {
      // Créer la transaction de débit
      const transaction = await tx.creditTransaction.create({
        data: {
          userId,
          amount: -amount, // Négatif pour débit
          type,
          relatedTransactionId: metadata.relatedTransactionId || null,
          metadata: JSON.stringify(metadata),
        },
      });

      // Mettre à jour ou créer la balance (SANS vérifier si suffisant)
      const updatedBalance = await tx.creditBalance.upsert({
        where: { userId },
        create: {
          userId,
          balance: -amount, // Balance négative si pas de balance existante
          totalUsed: amount,
        },
        update: {
          balance: { decrement: amount }, // Peut devenir négatif
          totalUsed: { increment: amount },
        },
      });

      return { transaction, balance: updatedBalance };
    });

    console.log(`[Credits] Débit forcé de ${amount} crédit(s) pour user ${userId} (type: ${type}), nouvelle balance: ${result.balance.balance}`);
    return {
      success: true,
      transaction: result.transaction,
      newBalance: result.balance.balance,
    };
  } catch (error) {
    console.error('[Credits] Erreur lors du débit forcé:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors du débit de crédits',
    };
  }
}

/**
 * Rembourse des crédits suite à une annulation ou échec
 * @param {string} userId - ID de l'utilisateur
 * @param {string} originalTransactionId - ID de la transaction d'origine à rembourser
 * @param {string} reason - Raison du remboursement
 * @returns {Promise<{success: boolean, transaction?: object, error?: string}>}
 */
export async function refundCredit(userId, originalTransactionId, reason = 'Remboursement automatique') {
  try {
    // Transaction atomique
    const result = await prisma.$transaction(async (tx) => {
      // Récupérer la transaction d'origine
      const originalTransaction = await tx.creditTransaction.findUnique({
        where: { id: originalTransactionId },
      });

      if (!originalTransaction) {
        throw new Error('Transaction d\'origine introuvable');
      }

      if (originalTransaction.userId !== userId) {
        throw new Error('Transaction n\'appartient pas à cet utilisateur');
      }

      if (originalTransaction.refunded) {
        throw new Error('Transaction déjà remboursée');
      }

      if (originalTransaction.amount >= 0) {
        throw new Error('Seules les transactions de débit peuvent être remboursées');
      }

      const refundAmount = Math.abs(originalTransaction.amount);

      // Créer la transaction de remboursement
      const refundTransaction = await tx.creditTransaction.create({
        data: {
          userId,
          amount: refundAmount, // Positif pour remboursement
          type: 'refund',
          featureName: originalTransaction.featureName,
          taskId: originalTransaction.taskId,
          relatedTransactionId: originalTransactionId,
          metadata: JSON.stringify({ reason }),
        },
      });

      // Marquer la transaction d'origine comme remboursée
      await tx.creditTransaction.update({
        where: { id: originalTransactionId },
        data: { refunded: true },
      });

      // Mettre à jour la balance
      const updatedBalance = await tx.creditBalance.update({
        where: { userId },
        data: {
          balance: { increment: refundAmount },
          totalRefunded: { increment: refundAmount },
        },
      });

      return { refundTransaction, balance: updatedBalance };
    });

    console.log(`[Credits] Remboursement de ${Math.abs(result.refundTransaction.amount)} crédit(s) pour user ${userId}`);
    return { success: true, transaction: result.refundTransaction, balance: result.balance.balance };
  } catch (error) {
    console.error('[Credits] Erreur lors du remboursement:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors du remboursement de crédits',
    };
  }
}

/**
 * Attribue des crédits à un utilisateur (achat, bonus, parrainage)
 * @param {string} userId - ID de l'utilisateur
 * @param {number} amount - Nombre de crédits à attribuer (positif)
 * @param {string} type - Type de transaction (purchase, gift)
 * @param {object} metadata - Métadonnées {stripePaymentIntentId?, source?}
 * @returns {Promise<{success: boolean, transaction?: object, error?: string}>}
 */
export async function grantCredits(userId, amount, type = 'purchase', metadata = {}) {
  if (amount <= 0) {
    return { success: false, error: 'Le montant doit être supérieur à 0' };
  }

  try {
    // Vérification d'idempotence: si stripePaymentIntentId existe déjà, retourner succès
    // Cela évite les doublons lors des retries de webhook Stripe
    if (metadata.stripePaymentIntentId) {
      const existingTransaction = await prisma.creditTransaction.findFirst({
        where: { stripePaymentIntentId: metadata.stripePaymentIntentId },
      });

      if (existingTransaction) {
        console.log(`[Credits] Transaction déjà traitée pour paymentIntent ${metadata.stripePaymentIntentId}`);
        return {
          success: true,
          transaction: existingTransaction,
          alreadyProcessed: true,
        };
      }
    }

    // Transaction atomique
    const result = await prisma.$transaction(async (tx) => {
      // Créer la transaction d'attribution
      const transaction = await tx.creditTransaction.create({
        data: {
          userId,
          amount, // Positif pour attribution
          type,
          stripePaymentIntentId: metadata.stripePaymentIntentId || null,
          metadata: metadata.source ? JSON.stringify({ source: metadata.source }) : null,
        },
      });

      // Mettre à jour ou créer la balance
      const balance = await tx.creditBalance.upsert({
        where: { userId },
        create: {
          userId,
          balance: amount,
          totalPurchased: type === 'purchase' ? amount : 0,
          totalGifted: type === 'gift' ? amount : 0,
        },
        update: {
          balance: { increment: amount },
          totalPurchased: type === 'purchase' ? { increment: amount } : undefined,
          totalGifted: type === 'gift' ? { increment: amount } : undefined,
        },
      });

      return { transaction, balance };
    });

    console.log(`[Credits] Attribution de ${amount} crédit(s) pour user ${userId} (type: ${type})`);
    return { success: true, transaction: result.transaction, balance: result.balance.balance };
  } catch (error) {
    console.error('[Credits] Erreur lors de l\'attribution:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de l\'attribution de crédits',
    };
  }
}

/**
 * Récupère l'historique des transactions de crédits
 * @param {string} userId - ID de l'utilisateur
 * @param {object} options - Options de pagination {limit?, offset?, type?}
 * @returns {Promise<Array>}
 */
export async function getCreditTransactions(userId, options = {}) {
  const { limit = 50, offset = 0, type = null } = options;

  return await prisma.creditTransaction.findMany({
    where: {
      userId,
      ...(type && { type }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}
