/**
 * POST /api/checkout/subscription
 * Créer une session de checkout Stripe pour un abonnement
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import stripe from '@/lib/stripe';

export async function POST(request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const { planId, billingPeriod = 'monthly' } = body;

    // Validation
    if (!planId || typeof planId !== 'number') {
      return NextResponse.json(
        { error: 'planId requis' },
        { status: 400 }
      );
    }

    if (!['monthly', 'yearly'].includes(billingPeriod)) {
      return NextResponse.json(
        { error: 'billingPeriod invalide (monthly ou yearly)' },
        { status: 400 }
      );
    }

    // Récupérer le plan
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan introuvable' },
        { status: 404 }
      );
    }

    // Vérifier que le plan a un prix configuré
    const stripePriceId = billingPeriod === 'monthly'
      ? plan.stripePriceIdMonthly
      : plan.stripePriceIdYearly;

    if (!stripePriceId) {
      return NextResponse.json(
        { error: `Pas de prix ${billingPeriod} configuré pour ce plan` },
        { status: 400 }
      );
    }

    // Vérifier si l'utilisateur a déjà un abonnement Stripe actif
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId },
      select: {
        stripeSubscriptionId: true,
        stripePriceId: true,
        status: true,
      },
    });

    // Si l'utilisateur a un abonnement Stripe actif, mettre à jour au lieu de créer un nouveau
    if (existingSubscription?.stripeSubscriptionId && existingSubscription.status === 'active') {
      try {
        // Récupérer l'abonnement Stripe existant
        const stripeSubscription = await stripe.subscriptions.retrieve(existingSubscription.stripeSubscriptionId);

        // Vérifier la période de facturation actuelle
        const currentInterval = stripeSubscription.items.data[0]?.price?.recurring?.interval;
        const currentBillingPeriod = currentInterval === 'year' ? 'yearly' : 'monthly';

        // Récupérer le plan actuel depuis la DB pour comparer les tiers
        const currentDbSubscription = await prisma.subscription.findUnique({
          where: { userId },
          include: { plan: true },
        });

        const currentTier = currentDbSubscription?.plan?.tier || 0;
        const newTier = plan.tier;

        // Déterminer si c'est un upgrade ou downgrade
        // UPGRADE si : tier supérieur (peu importe période) OU (même tier ET mensuel → annuel)
        const isUpgrade = (
          newTier > currentTier ||
          (newTier === currentTier && currentBillingPeriod === 'monthly' && billingPeriod === 'yearly')
        );

        // DOWNGRADE si : tier inférieur (peu importe période) OU (même tier ET annuel → mensuel)
        const isDowngrade = (
          newTier < currentTier ||
          (newTier === currentTier && currentBillingPeriod === 'yearly' && billingPeriod === 'monthly')
        );

        console.log(`[Checkout Subscription] Changement: tier ${currentTier} → ${newTier}, ${currentBillingPeriod} → ${billingPeriod}, isUpgrade=${isUpgrade}, isDowngrade=${isDowngrade}`);

        // Pour UPGRADES : Modifier l'abonnement directement (prorata automatique)
        if (isUpgrade) {
          console.log(`[Checkout Subscription] Upgrade détecté, modification directe de l'abonnement avec prorata`);

          // Import de la fonction changeSubscription
          const { changeSubscription } = await import('@/lib/subscription/subscriptions');

          // Modifier l'abonnement Stripe (prorata automatique)
          const updatedSubscription = await stripe.subscriptions.update(
            existingSubscription.stripeSubscriptionId,
            {
              items: [{
                id: stripeSubscription.items.data[0].id,
                price: stripePriceId,
              }],
              proration_behavior: 'create_prorations', // Prorata automatique
              billing_cycle_anchor: 'now', // Nouveau cycle immédiatement
              metadata: {
                userId,
                planId: planId.toString(),
              },
            }
          );

          // Mettre à jour la DB immédiatement
          await changeSubscription(userId, planId, billingPeriod);

          console.log(`[Checkout Subscription] Upgrade effectué avec prorata, nouvel abonnement : ${updatedSubscription.id}`);

          return NextResponse.json({
            success: true,
            upgraded: true,
            subscriptionId: updatedSubscription.id,
            message: 'Abonnement upgradé avec succès',
          });
        }

        // Pour DOWNGRADES : Modifier l'abonnement directement (sans prorata, effectif au prochain cycle)
        if (isDowngrade) {
          const updateParams = {
            items: [{
              id: stripeSubscription.items.data[0].id,
              price: stripePriceId,
            }],
            proration_behavior: 'none',
            metadata: {
              userId,
              planId: planId.toString(),
            },
          };

          const updatedSubscription = await stripe.subscriptions.update(
            existingSubscription.stripeSubscriptionId,
            updateParams
          );

          console.log(`[Checkout Subscription] Downgrade : changement effectif le ${new Date(updatedSubscription.current_period_end * 1000).toLocaleDateString('fr-FR')}`);

          return NextResponse.json({
            success: true,
            scheduled: true,
            downgrade: true,
            effectiveDate: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
            subscriptionId: updatedSubscription.id,
            message: `Downgrade programmé pour le ${new Date(updatedSubscription.current_period_end * 1000).toLocaleDateString('fr-FR')}`,
          });
        }

        // Si ni upgrade ni downgrade (changement de plan au même tier), ne devrait pas arriver
        console.error('[Checkout Subscription] Cas non géré: ni upgrade ni downgrade');
        return NextResponse.json(
          { error: 'Changement de plan non supporté' },
          { status: 400 }
        );
      } catch (error) {
        console.error('[Checkout Subscription] Erreur mise à jour abonnement:', error);
        return NextResponse.json(
          { error: error.message || 'Erreur lors de la mise à jour de l\'abonnement' },
          { status: 500 }
        );
      }
    }

    // Sinon, créer une nouvelle session de checkout (nouvel abonnement)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, stripeCustomerId: true },
    });

    let stripeCustomerId = user?.stripeCustomerId;

    if (!stripeCustomerId || stripeCustomerId.startsWith('local_')) {
      // Créer un nouveau customer Stripe
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: {
          userId,
        },
      });

      stripeCustomerId = customer.id;

      // Mettre à jour la BDD
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId },
      });
    }

    // Créer la session de checkout
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      billing_address_collection: 'required',
      allow_promotion_codes: true, // Permettre les codes promo
      payment_method_types: ['card'],
      consent_collection: {
        terms_of_service: 'required', // Acceptation obligatoire des CGV
      },
      custom_text: {
        terms_of_service_acceptance: {
          message: `J'accepte les [Conditions Générales de Vente](${process.env.NEXT_PUBLIC_SITE_URL}/terms).`,
        },
      },
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account/subscriptions?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account/subscriptions?canceled=true`,
      metadata: {
        userId,
        planId: planId.toString(),
        billingPeriod,
      },
      subscription_data: {
        metadata: {
          userId,
          planId: planId.toString(),
        },
      },
    });

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });

  } catch (error) {
    console.error('[Checkout Subscription] Erreur:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création de la session' },
      { status: 500 }
    );
  }
}
