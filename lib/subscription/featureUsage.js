/**
 * Système de gestion des limites de features et compteurs mensuels
 *
 * Fonctions principales :
 * - canUseFeature() : Vérifie si l'utilisateur peut utiliser une feature
 * - incrementFeatureCounter() : Incrémente le compteur (débite crédit si nécessaire)
 * - refundFeatureUsage() : Rembourse un usage suite à échec task
 * - resetExpiredCounters() : Reset mensuel des compteurs
 */

import prisma from '@/lib/prisma';
import { getCreditBalance, debitCredit, refundCredit } from './credits';
import dbEmitter from '@/lib/events/dbEmitter';

/**
 * Récupère l'abonnement actuel de l'utilisateur avec les limites de features
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<{subscription: object, plan: object} | null>}
 */
async function getUserSubscriptionWithPlan(userId) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: {
      plan: {
        include: {
          featureLimits: true,
        },
      },
    },
  });

  return subscription;
}

/**
 * Récupère ou crée le compteur mensuel d'une feature
 * @param {string} userId - ID de l'utilisateur
 * @param {string} featureName - Nom de la feature
 * @param {Date} periodStart - Début de la période
 * @param {Date} periodEnd - Fin de la période
 * @returns {Promise<object>}
 */
async function getOrCreateFeatureCounter(userId, featureName, periodStart, periodEnd) {
  let counter = await prisma.featureUsageCounter.findUnique({
    where: {
      userId_featureName_periodStart: {
        userId,
        featureName,
        periodStart,
      },
    },
  });

  if (!counter) {
    counter = await prisma.featureUsageCounter.create({
      data: {
        userId,
        featureName,
        count: 0,
        periodStart,
        periodEnd,
      },
    });
  }

  return counter;
}

/**
 * Calcule la période de comptage actuelle (mensuelle, basée sur date d'anniversaire abonnement)
 * @param {object} subscription - Objet subscription
 * @returns {{periodStart: Date, periodEnd: Date}}
 */
function getCurrentPeriod(subscription) {
  const now = new Date();

  if (!subscription) {
    // Si pas d'abonnement, utiliser le mois calendaire
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { periodStart, periodEnd };
  }

  // Utiliser la date anniversaire de l'abonnement
  const subscriptionStart = new Date(subscription.currentPeriodStart);
  const dayOfMonth = subscriptionStart.getDate();

  // Calculer le début de la période actuelle
  let periodStart = new Date(now.getFullYear(), now.getMonth(), dayOfMonth, 0, 0, 0, 0);
  if (periodStart > now) {
    // Si la date anniversaire est dans le futur ce mois-ci, prendre le mois précédent
    periodStart = new Date(now.getFullYear(), now.getMonth() - 1, dayOfMonth, 0, 0, 0, 0);
  }

  // Calculer la fin de la période
  let periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  periodEnd.setMilliseconds(-1); // Dernier milliseconde du mois

  return { periodStart, periodEnd };
}

/**
 * Vérifie si l'utilisateur peut utiliser une feature
 * @param {string} userId - ID de l'utilisateur
 * @param {string} featureName - Nom de la feature (generate_cv, import_pdf, etc.)
 * @param {string} analysisLevel - Niveau d'analyse (pour features IA) - 'rapid', 'medium', 'deep'
 * @returns {Promise<{canUse: boolean, reason: string, useCredit: boolean, creditBalance?: number}>}
 */
export async function canUseFeature(userId, featureName, analysisLevel = null) {
  try {
    console.log(`[FeatureUsage] canUseFeature appelé: userId=${userId}, featureName=${featureName}, analysisLevel=${analysisLevel}`);

    // 0. Vérifier si la balance de crédits est négative (suite à chargeback)
    const creditBalance = await getCreditBalance(userId);
    if (creditBalance.balance < 0) {
      console.log(`[FeatureUsage] ❌ BLOQUÉ: Balance négative (${creditBalance.balance} crédits)`);
      return {
        canUse: false,
        reason: 'Votre balance de crédits est négative suite à un litige bancaire. Veuillez recharger des crédits pour continuer à utiliser le service.',
        useCredit: false,
        actionRequired: true,
        redirectUrl: '/account/subscriptions?tab=credits',
      };
    }

    // 1. Récupérer l'abonnement et les limites
    const subscription = await getUserSubscriptionWithPlan(userId);

    if (!subscription) {
      console.log(`[FeatureUsage] ❌ Aucun abonnement trouvé pour userId=${userId}`);
      return {
        canUse: false,
        reason: 'Aucun abonnement actif',
        useCredit: false,
      };
    }

    console.log(`[FeatureUsage] ✅ Abonnement trouvé: planId=${subscription.planId}, status=${subscription.status}, plan=${subscription.plan.name}`);

    if (subscription.status !== 'active') {
      console.log(`[FeatureUsage] ❌ Abonnement non actif: ${subscription.status}`);
      return {
        canUse: false,
        reason: `Abonnement ${subscription.status}`,
        useCredit: false,
      };
    }

    // 2. Trouver la limite de cette feature dans le plan
    const featureLimit = subscription.plan.featureLimits.find(
      (fl) => fl.featureName === featureName
    );

    console.log(`[FeatureUsage] Features disponibles dans le plan:`, subscription.plan.featureLimits.map(fl => fl.featureName));

    if (!featureLimit) {
      console.log(`[FeatureUsage] ❌ Feature "${featureName}" non trouvée dans le plan`);
      return {
        canUse: false,
        reason: 'Feature non disponible dans ce plan',
        useCredit: false,
      };
    }

    console.log(`[FeatureUsage] ✅ Feature limit trouvée: enabled=${featureLimit.isEnabled}, limit=${featureLimit.usageLimit}`);

    // Si la feature est désactivée, vérifier si des crédits sont disponibles
    if (!featureLimit.isEnabled) {
      console.log(`[FeatureUsage] ⚠️ Feature désactivée dans le plan → Vérification des crédits`);
      const creditBalanceCheck = await getCreditBalance(userId);
      console.log(`[FeatureUsage] Balance de crédits: ${creditBalanceCheck.balance}`);

      if (creditBalanceCheck.balance > 0) {
        console.log(`[FeatureUsage] ✅ Crédits disponibles → Autoriser malgré feature désactivée`);
        return {
          canUse: true,
          reason: 'Feature désactivée dans votre plan, utilisation d\'un crédit',
          useCredit: true,
          creditBalance: creditBalanceCheck.balance,
        };
      }

      console.log(`[FeatureUsage] ❌ BLOQUÉ: Feature désactivée et aucun crédit disponible`);
      return {
        canUse: false,
        reason: 'Cette fonctionnalité est désactivée dans votre plan d\'abonnement. Changez d\'abonnement ou achetez des crédits pour l\'utiliser.',
        useCredit: false,
        actionRequired: true,
        redirectUrl: '/account/subscriptions',
      };
    }

    // 3. Vérifier les niveaux d'analyse autorisés (si applicable)
    if (analysisLevel && featureLimit.allowedAnalysisLevels) {
      const allowedLevels = JSON.parse(featureLimit.allowedAnalysisLevels);
      if (!allowedLevels.includes(analysisLevel)) {
        return {
          canUse: false,
          reason: `Niveau d'analyse "${analysisLevel}" non disponible dans ce plan`,
          useCredit: false,
        };
      }
    }

    // 4. Si limite = -1 (illimité), autoriser
    if (featureLimit.usageLimit === -1) {
      console.log(`[FeatureUsage] ✅ Limite illimitée pour ${featureName}`);
      return {
        canUse: true,
        reason: 'Limite illimitée',
        useCredit: false,
      };
    }

    // 5. Vérifier le compteur mensuel
    const { periodStart, periodEnd } = getCurrentPeriod(subscription);
    console.log(`[FeatureUsage] Période actuelle: ${periodStart.toISOString()} → ${periodEnd.toISOString()}`);

    const counter = await getOrCreateFeatureCounter(userId, featureName, periodStart, periodEnd);
    console.log(`[FeatureUsage] 📊 Compteur actuel: count=${counter.count}, limit=${featureLimit.usageLimit}`);

    if (counter.count < featureLimit.usageLimit) {
      console.log(`[FeatureUsage] ✅ Limite non atteinte (${counter.count}/${featureLimit.usageLimit}) → AUTORISER`);
      return {
        canUse: true,
        reason: `Limite non atteinte (${counter.count}/${featureLimit.usageLimit})`,
        useCredit: false,
      };
    }

    console.log(`[FeatureUsage] ⚠️ Limite atteinte (${counter.count}/${featureLimit.usageLimit}) → Vérification des crédits`);

    // 6. Limite atteinte → Vérifier si des crédits sont disponibles
    const creditBalanceFinal = await getCreditBalance(userId);
    console.log(`[FeatureUsage] Balance de crédits: ${creditBalanceFinal.balance}`);

    if (creditBalanceFinal.balance > 0) {
      console.log(`[FeatureUsage] ✅ Crédits disponibles → Utilisation d'un crédit`);
      return {
        canUse: true,
        reason: 'Limite atteinte, utilisation d\'un crédit',
        useCredit: true,
        creditBalance: creditBalanceFinal.balance,
      };
    }

    // 7. Pas de crédits disponibles
    console.log(`[FeatureUsage] ❌ BLOQUÉ: Limite atteinte (${counter.count}/${featureLimit.usageLimit}) et aucun crédit disponible`);
    return {
      canUse: false,
      reason: 'Vous avez atteint votre limite mensuelle pour cette fonctionnalité. Changez d\'abonnement ou achetez des crédits pour continuer.',
      useCredit: false,
      actionRequired: true,
      redirectUrl: '/account/subscriptions',
    };
  } catch (error) {
    console.error('[FeatureUsage] Erreur dans canUseFeature:', error);
    return {
      canUse: false,
      reason: 'Erreur lors de la vérification des limites',
      useCredit: false,
    };
  }
}

/**
 * Incrémente le compteur de feature (et débite un crédit si nécessaire)
 * @param {string} userId - ID de l'utilisateur
 * @param {string} featureName - Nom de la feature
 * @param {object} metadata - Métadonnées {taskId?, analysisLevel?}
 * @returns {Promise<{success: boolean, usedCredit: boolean, transactionId?: string, error?: string}>}
 */
export async function incrementFeatureCounter(userId, featureName, metadata = {}) {
  try {
    console.log(`[FeatureUsage] incrementFeatureCounter appelé: userId=${userId}, feature=${featureName}, analysisLevel=${metadata.analysisLevel}`);

    // Vérifier si l'utilisateur peut utiliser la feature
    const check = await canUseFeature(userId, featureName, metadata.analysisLevel);
    console.log(`[FeatureUsage] canUseFeature résultat:`, check);

    if (!check.canUse) {
      console.log(`[FeatureUsage] Feature bloquée: ${check.reason}`);
      return {
        success: false,
        usedCredit: false,
        error: check.reason,
        actionRequired: check.actionRequired,
        redirectUrl: check.redirectUrl,
      };
    }

    // Si on doit utiliser un crédit
    if (check.useCredit) {
      console.log(`[FeatureUsage] Utilisation d'un crédit pour ${featureName}`);
      const debitResult = await debitCredit(userId, 1, 'usage', {
        featureName,
        taskId: metadata.taskId,
        extra: { analysisLevel: metadata.analysisLevel },
      });

      if (!debitResult.success) {
        console.log(`[FeatureUsage] Échec du débit du crédit: ${debitResult.error}`);
        return {
          success: false,
          usedCredit: false,
          error: debitResult.error,
        };
      }

      console.log(`[FeatureUsage] Crédit débité avec succès, transactionId=${debitResult.transaction.id}`);

      // Émettre événement SSE pour rafraîchir l'UI
      dbEmitter.emit('db:change', {
        entity: 'CreditBalance',
        id: userId,
        userId,
        data: { action: 'credit_used', featureName, transactionId: debitResult.transaction.id },
      });

      return {
        success: true,
        usedCredit: true,
        transactionId: debitResult.transaction.id,
      };
    }

    // Sinon, incrémenter le compteur de l'abonnement
    console.log(`[FeatureUsage] Incrémentation du compteur d'abonnement pour ${featureName}`);
    const subscription = await getUserSubscriptionWithPlan(userId);
    const { periodStart, periodEnd } = getCurrentPeriod(subscription);

    const result = await prisma.featureUsageCounter.upsert({
      where: {
        userId_featureName_periodStart: {
          userId,
          featureName,
          periodStart,
        },
      },
      create: {
        userId,
        featureName,
        count: 1,
        periodStart,
        periodEnd,
      },
      update: {
        count: { increment: 1 },
      },
    });

    console.log(`[FeatureUsage] Compteur incrémenté: count=${result.count}`);

    // Émettre événement SSE pour rafraîchir l'UI
    dbEmitter.emit('db:change', {
      entity: 'FeatureUsageCounter',
      id: result.id,
      userId,
      data: { action: 'counter_incremented', featureName, count: result.count },
    });

    return {
      success: true,
      usedCredit: false,
      featureName,
      periodStart,
    };
  } catch (error) {
    console.error('[FeatureUsage] Erreur dans incrementFeatureCounter:', error);
    return {
      success: false,
      usedCredit: false,
      error: error.message || 'Erreur lors de l\'incrémentation du compteur',
    };
  }
}

/**
 * Rembourse un usage de feature suite à échec/annulation d'une task
 * @param {string} taskId - ID de la BackgroundTask
 * @returns {Promise<{success: boolean, refunded: boolean, error?: string}>}
 */
export async function refundFeatureUsage(taskId) {
  try {
    // Récupérer la task avec les infos de crédit
    const task = await prisma.backgroundTask.findUnique({
      where: { id: taskId },
      include: {
        creditTransaction: true,
      },
    });

    if (!task) {
      return { success: false, refunded: false, error: 'Task introuvable' };
    }

    // Si un crédit a été utilisé, le rembourser
    if (task.creditUsed && task.creditTransactionId) {
      const refundResult = await refundCredit(
        task.userId,
        task.creditTransactionId,
        `Échec de la tâche ${taskId}`
      );

      if (!refundResult.success) {
        return { success: false, refunded: false, error: refundResult.error };
      }

      console.log(`[FeatureUsage] Crédit remboursé pour task ${taskId}`);

      // Émettre événement SSE pour rafraîchir l'UI
      dbEmitter.emit('db:change', {
        entity: 'CreditBalance',
        id: task.userId,
        userId: task.userId,
        data: { action: 'credit_refunded', taskId },
      });

      return { success: true, refunded: true };
    }

    // Sinon, décrémenter le compteur d'abonnement
    if (task.featureName && task.featureCounterPeriodStart) {
      try {
        const result = await prisma.featureUsageCounter.updateMany({
          where: {
            userId: task.userId,
            featureName: task.featureName,
            periodStart: task.featureCounterPeriodStart,
            count: { gt: 0 }, // Ne décrémenter que si > 0
          },
          data: {
            count: { decrement: 1 },
          },
        });

        if (result.count > 0) {
          console.log(`[FeatureUsage] Compteur d'abonnement décrémenté pour task ${taskId}`);

          // Émettre événement SSE pour rafraîchir l'UI
          dbEmitter.emit('db:change', {
            entity: 'FeatureUsageCounter',
            id: task.userId,
            userId: task.userId,
            data: { action: 'counter_refunded', featureName: task.featureName, taskId },
          });

          return { success: true, refunded: true };
        } else {
          console.warn(`[FeatureUsage] Compteur introuvable ou déjà à 0 pour task ${taskId}`);
          return { success: true, refunded: false };
        }
      } catch (error) {
        console.error(`[FeatureUsage] Erreur lors du remboursement du compteur:`, error);
        return { success: true, refunded: false };
      }
    }

    console.log(`[FeatureUsage] Pas de crédit ni compteur à rembourser pour task ${taskId}`);
    return { success: true, refunded: false };
  } catch (error) {
    console.error('[FeatureUsage] Erreur dans refundFeatureUsage:', error);
    return {
      success: false,
      refunded: false,
      error: error.message || 'Erreur lors du remboursement',
    };
  }
}

/**
 * Reset tous les compteurs d'un utilisateur (utilisé lors du renouvellement d'abonnement)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<{deleted: number}>}
 */
export async function resetFeatureCounters(userId) {
  try {
    const result = await prisma.featureUsageCounter.deleteMany({
      where: { userId },
    });

    console.log(`[FeatureUsage] ${result.count} compteurs reset pour user ${userId}`);
    return { deleted: result.count };
  } catch (error) {
    console.error('[FeatureUsage] Erreur lors du reset des compteurs:', error);
    throw error;
  }
}

/**
 * Reset des compteurs expirés (à exécuter quotidiennement via cron)
 * Supprime les compteurs dont la période est terminée
 * @returns {Promise<{deleted: number}>}
 */
export async function resetExpiredCounters() {
  try {
    const now = new Date();

    const result = await prisma.featureUsageCounter.deleteMany({
      where: {
        periodEnd: {
          lt: now, // Supprime les compteurs dont periodEnd < maintenant
        },
      },
    });

    console.log(`[FeatureUsage] ${result.count} compteurs expirés supprimés`);
    return { deleted: result.count };
  } catch (error) {
    console.error('[FeatureUsage] Erreur lors du reset des compteurs:', error);
    throw error;
  }
}

/**
 * Récupère les compteurs actuels de toutes les features pour un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Array<{featureName: string, count: number, limit: number, periodEnd: Date}>>}
 */
export async function getUserFeatureCounters(userId) {
  const subscription = await getUserSubscriptionWithPlan(userId);

  if (!subscription) {
    return [];
  }

  const { periodStart, periodEnd } = getCurrentPeriod(subscription);

  const counters = await prisma.featureUsageCounter.findMany({
    where: {
      userId,
      periodStart,
    },
  });

  // Fusionner avec les limites du plan
  return subscription.plan.featureLimits.map((featureLimit) => {
    const counter = counters.find((c) => c.featureName === featureLimit.featureName);

    return {
      featureName: featureLimit.featureName,
      count: counter?.count || 0,
      limit: featureLimit.usageLimit,
      isEnabled: featureLimit.isEnabled,
      periodEnd,
    };
  });
}
