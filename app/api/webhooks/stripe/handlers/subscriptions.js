/**
 * Stripe webhook handlers for subscription events
 */

import stripe from '@/lib/stripe';
import prisma from '@/lib/prisma';
import { cancelSubscription } from '@/lib/subscription/subscriptions';

/**
 * Gère la création/mise à jour d'un abonnement
 */
export async function handleSubscriptionUpdate(subscriptionData) {
  const userId = subscriptionData.metadata?.userId;

  if (!userId) {
    console.error('[Webhook] userId manquant dans metadata subscription');
    return;
  }

  // Récupérer l'objet subscription complet depuis Stripe API
  // car le webhook peut envoyer des données incomplètes
  let subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionData.id);
  } catch (error) {
    console.error('[Webhook] Erreur récupération subscription:', error);
    subscription = subscriptionData; // Fallback sur les données du webhook
  }

  // Déterminer la période de facturation
  const interval = subscription.items.data[0]?.price?.recurring?.interval;
  const billingPeriod = interval === 'year' ? 'yearly' : 'monthly';

  // Récupérer le stripePriceId pour identifier le plan
  const stripePriceId = subscription.items.data[0]?.price?.id;

  if (!stripePriceId) {
    console.error('[Webhook] stripePriceId manquant dans subscription');
    return;
  }

  // Trouver le plan correspondant au stripePriceId
  const priceField = billingPeriod === 'yearly' ? 'stripePriceIdYearly' : 'stripePriceIdMonthly';
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { [priceField]: stripePriceId }
  });

  if (!plan) {
    console.error('[Webhook] Plan introuvable pour stripePriceId:', stripePriceId, 'billingPeriod:', billingPeriod);
    return;
  }

  const planId = plan.id;

  // Vérifier les dates
  if (!subscription.current_period_start || !subscription.current_period_end) {
    console.error('[Webhook] Dates de période manquantes dans subscription');
    console.error('[Webhook] Subscription ID:', subscription.id);
    return;
  }

  // Convertir les timestamps Unix (secondes) en dates JavaScript (millisecondes)
  const currentPeriodStart = new Date(subscription.current_period_start * 1000);
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  // Mettre à jour ou créer l'abonnement
  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (existingSubscription) {
    // Mise à jour
    await prisma.subscription.update({
      where: { userId },
      data: {
        stripeCustomerId: subscription.customer, // MAJ avec le vrai customer ID Stripe
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price?.id,
        planId,
        status: subscription.status,
        billingPeriod,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      },
    });
  } else {
    // Création
    await prisma.subscription.create({
      data: {
        userId,
        stripeCustomerId: subscription.customer,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price?.id,
        planId,
        status: subscription.status,
        billingPeriod,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
      },
    });
  }

  console.log(`[Webhook] Abonnement ${subscription.status} pour user ${userId}`);
}

/**
 * Gère la suppression d'un abonnement
 */
export async function handleSubscriptionDeleted(subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('[Webhook] userId manquant dans metadata subscription');
    return;
  }

  // Vérifier si l'utilisateur a un autre abonnement actif (cas upgrade)
  const currentSubscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeSubscriptionId: true, status: true },
  });

  // Si abonnement actif différent de celui supprimé = upgrade en cours
  if (currentSubscription?.stripeSubscriptionId &&
      currentSubscription.stripeSubscriptionId !== subscription.id &&
      currentSubscription.status === 'active') {
    console.log(`[Webhook] Suppression d'ancien abonnement (upgrade détecté), pas de downgrade`);
    return; // Ne rien faire
  }

  // Sinon, vraie suppression → downgrade vers Gratuit
  await cancelSubscription(userId, true);
  console.log(`[Webhook] Abonnement supprimé pour user ${userId}, downgrade vers Gratuit`);
}
