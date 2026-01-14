/**
 * Système de gestion des abonnements utilisateur
 *
 * Fonctions principales :
 * - getUserSubscription() : Récupère l'abonnement actuel
 * - assignDefaultPlan() : Attribue le plan Gratuit à l'inscription
 * - changeSubscription() : Upgrade/Downgrade de plan
 * - cancelSubscription() : Annulation d'abonnement
 */

import prisma from '@/lib/prisma';
import { blockCvsForDowngrade, unblockCvs, getCvStats } from './cvLimits';
import { isSubscriptionModeEnabled, getNumericSettingValue } from '@/lib/settings/settingsUtils';

/**
 * Récupère l'abonnement actuel d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<object | null>}
 */
export async function getUserSubscription(userId) {
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
 * Attribue le plan Gratuit par défaut à un nouvel utilisateur
 * Appelé automatiquement lors de l'inscription
 * @param {string} userId - ID de l'utilisateur
 * @param {string} stripeCustomerId - ID client Stripe (optionnel)
 * @returns {Promise<{success: boolean, subscription?: object, error?: string}>}
 */
export async function assignDefaultPlan(userId, stripeCustomerId = null) {
  try {
    // Vérifier le mode actif
    const subscriptionEnabled = await isSubscriptionModeEnabled();

    if (!subscriptionEnabled) {
      // MODE CRÉDITS UNIQUEMENT - Pas de Subscription, juste des crédits de bienvenue
      const welcomeCredits = await getNumericSettingValue('welcome_credits', 0);

      // Vérifier si la balance existe déjà
      const existingBalance = await prisma.creditBalance.findUnique({
        where: { userId },
      });

      if (!existingBalance) {
        await prisma.creditBalance.create({
          data: {
            userId,
            balance: welcomeCredits,
            totalGifted: welcomeCredits,
          },
        });

        // Créer transaction pour traçabilité
        if (welcomeCredits > 0) {
          await prisma.creditTransaction.create({
            data: {
              userId,
              amount: welcomeCredits,
              type: 'gift',
              metadata: JSON.stringify({ source: 'welcome_bonus' }),
            },
          });
        }

        console.log(`[Subscriptions] Mode crédits-only: ${welcomeCredits} crédits de bienvenue attribués à user ${userId}`);
      } else {
        console.log(`[Subscriptions] Mode crédits-only: user ${userId} a déjà une balance (${existingBalance.balance} crédits)`);
      }

      return { success: true, creditsOnlyMode: true, welcomeCredits };
    }

    // MODE ABONNEMENT - Comportement actuel

    // Trouver le plan gratuit (priceMonthly === 0)
    // Plus robuste que de chercher par nom car le nom peut changer
    const freePlan = await prisma.subscriptionPlan.findFirst({
      where: {
        priceMonthly: 0,
        priceYearly: 0,
      },
      orderBy: {
        id: 'asc', // En cas de plusieurs plans gratuits (legacy), prendre le premier
      },
    });

    if (!freePlan) {
      throw new Error('Aucun plan gratuit (0€) trouvé en base de données');
    }

    // Vérifier si l'utilisateur a déjà un abonnement
    const existing = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (existing) {
      console.log(`[Subscriptions] User ${userId} a déjà un abonnement`);
      return { success: true, subscription: existing };
    }

    // Créer un customer Stripe si pas fourni
    let finalStripeCustomerId = stripeCustomerId;
    if (!finalStripeCustomerId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, stripeCustomerId: true },
      });

      if (user?.stripeCustomerId) {
        finalStripeCustomerId = user.stripeCustomerId;
      } else {
        // On ne crée pas de customer Stripe pour le plan gratuit
        // Il sera créé lors du premier paiement
        finalStripeCustomerId = `local_${userId}`;
      }
    }

    // Créer l'abonnement
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setFullYear(periodEnd.getFullYear() + 10); // Gratuit = quasi permanent

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        stripeCustomerId: finalStripeCustomerId,
        planId: freePlan.id,
        status: 'active',
        billingPeriod: 'monthly',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      include: {
        plan: true,
      },
    });

    // Initialiser la balance de crédits (0 par défaut selon choix utilisateur)
    await prisma.creditBalance.create({
      data: {
        userId,
        balance: 0, // Pas de bonus initial
      },
    });

    console.log(`[Subscriptions] Plan Gratuit attribué à user ${userId}`);
    return { success: true, subscription };
  } catch (error) {
    console.error('[Subscriptions] Erreur dans assignDefaultPlan:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de l\'attribution du plan par défaut',
    };
  }
}

/**
 * Change le plan d'abonnement d'un utilisateur (upgrade/downgrade)
 * @param {string} userId - ID de l'utilisateur
 * @param {number} newPlanId - ID du nouveau plan
 * @param {object} options - Options {stripeSubscriptionId?, stripePriceId?, billingPeriod?}
 * @returns {Promise<{success: boolean, subscription?: object, needsCvBlocking?: boolean, suggestedCvs?: Array, error?: string}>}
 */
export async function changeSubscription(userId, newPlanId, options = {}) {
  try {
    // Récupérer l'abonnement actuel
    const currentSubscription = await getUserSubscription(userId);
    if (!currentSubscription) {
      return {
        success: false,
        error: 'Aucun abonnement existant',
      };
    }

    // Récupérer le nouveau plan
    const newPlan = await prisma.subscriptionPlan.findUnique({
      where: { id: newPlanId },
    });

    if (!newPlan) {
      return {
        success: false,
        error: 'Plan introuvable',
      };
    }

    const currentPlan = currentSubscription.plan;

    // NOTE: Blocage de CV lors du downgrade DÉSACTIVÉ (limitation retirée)

    // Mettre à jour l'abonnement
    const now = new Date();
    const periodEnd = new Date(now);

    if (options.billingPeriod === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const updatedSubscription = await prisma.subscription.update({
      where: { userId },
      data: {
        planId: newPlan.id,
        status: 'active',
        billingPeriod: options.billingPeriod || currentSubscription.billingPeriod,
        stripeSubscriptionId: options.stripeSubscriptionId || currentSubscription.stripeSubscriptionId,
        stripePriceId: options.stripePriceId || currentSubscription.stripePriceId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      include: {
        plan: {
          include: {
            featureLimits: true,
          },
        },
      },
    });

    console.log(`[Subscriptions] Plan changé pour user ${userId}: ${currentPlan.name} → ${newPlan.name}`);
    return { success: true, subscription: updatedSubscription };
  } catch (error) {
    console.error('[Subscriptions] Erreur dans changeSubscription:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors du changement d\'abonnement',
    };
  }
}

/**
 * Annule l'abonnement d'un utilisateur (retour au plan Gratuit)
 * @param {string} userId - ID de l'utilisateur
 * @param {boolean} immediate - Si true, annulation immédiate, sinon à la fin de la période
 * @returns {Promise<{success: boolean, subscription?: object, error?: string}>}
 */
export async function cancelSubscription(userId, immediate = false) {
  try {
    const currentSubscription = await getUserSubscription(userId);

    if (!currentSubscription) {
      return {
        success: false,
        error: 'Aucun abonnement à annuler',
      };
    }

    // Si annulation immédiate, downgrade vers Gratuit
    if (immediate) {
      const freePlan = await prisma.subscriptionPlan.findUnique({
        where: { name: 'Gratuit' },
      });

      if (!freePlan) {
        throw new Error('Plan Gratuit introuvable');
      }

      // NOTE: Blocage de CV lors du downgrade DÉSACTIVÉ (limitation retirée)

      // Downgrade vers Gratuit
      return await changeSubscription(userId, freePlan.id, {
        stripeSubscriptionId: null,
        stripePriceId: null,
      });
    }

    // Annulation différée (à la fin de la période)
    const updatedSubscription = await prisma.subscription.update({
      where: { userId },
      data: {
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
      },
      include: {
        plan: true,
      },
    });

    console.log(`[Subscriptions] Annulation programmée pour user ${userId} à la fin de la période`);
    return { success: true, subscription: updatedSubscription };
  } catch (error) {
    console.error('[Subscriptions] Erreur dans cancelSubscription:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de l\'annulation',
    };
  }
}

/**
 * Réactive un abonnement annulé (avant la fin de période)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<{success: boolean, subscription?: object, error?: string}>}
 */
export async function reactivateSubscription(userId) {
  try {
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      return {
        success: false,
        error: 'Aucun abonnement à réactiver',
      };
    }

    if (!subscription.cancelAtPeriodEnd) {
      return {
        success: false,
        error: 'Abonnement non annulé',
      };
    }

    const updatedSubscription = await prisma.subscription.update({
      where: { userId },
      data: {
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
      include: {
        plan: true,
      },
    });

    console.log(`[Subscriptions] Abonnement réactivé pour user ${userId}`);
    return { success: true, subscription: updatedSubscription };
  } catch (error) {
    console.error('[Subscriptions] Erreur dans reactivateSubscription:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de la réactivation',
    };
  }
}

/**
 * Récupère le résumé complet de l'abonnement utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<object>}
 */
export async function getSubscriptionSummary(userId) {
  // Vérifier le mode actif
  const subscriptionEnabled = await isSubscriptionModeEnabled();
  const creditsOnlyMode = !subscriptionEnabled;

  const subscription = await getUserSubscription(userId);
  const cvStats = await getCvStats(userId);
  const creditBalance = await prisma.creditBalance.findUnique({
    where: { userId },
  });

  // Récupérer les compteurs de features
  const { getUserFeatureCounters } = require('./featureUsage');
  const featureCounters = await getUserFeatureCounters(userId);

  // Récupérer le downgrade programmé depuis Stripe (si existe)
  let scheduledDowngrade = null;
  if (subscription?.stripeSubscriptionId && !subscription.stripeSubscriptionId.startsWith('local_')) {
    try {
      const stripe = require('@/lib/stripe').default;
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);

      // Vérifier si un schedule est attaché
      if (stripeSubscription.schedule) {
        const schedule = await stripe.subscriptionSchedules.retrieve(stripeSubscription.schedule);

        // Vérifier si le schedule a 2 phases (downgrade programmé)
        if (schedule.phases && schedule.phases.length >= 2) {
          const futurePhase = schedule.phases[1]; // Phase après current_period_end
          const futurePriceId = futurePhase.items[0]?.price;

          // Trouver le plan correspondant au price ID
          const allPlans = await prisma.subscriptionPlan.findMany();
          const targetPlan = allPlans.find(p =>
            p.stripePriceIdMonthly === futurePriceId || p.stripePriceIdYearly === futurePriceId
          );

          if (targetPlan) {
            scheduledDowngrade = {
              targetPlanId: targetPlan.id,
              targetBillingPeriod: futurePriceId === targetPlan.stripePriceIdMonthly ? 'monthly' : 'yearly',
              effectiveDate: new Date(futurePhase.start_date * 1000).toISOString(),
              scheduleId: schedule.id,
            };
          }
        }
      }
    } catch (error) {
      console.error('[Subscriptions] Erreur lors de la récupération du schedule:', error);
      // Ne pas bloquer si erreur Stripe, juste logger
    }
  }

  return {
    subscription,
    cvStats,
    creditBalance: creditBalance || { balance: 0, totalPurchased: 0, totalUsed: 0, totalRefunded: 0, totalGifted: 0 },
    featureCounters,
    scheduledDowngrade,
    creditsOnlyMode,
  };
}
