import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth/session";
import logger from "@/lib/security/secureLogger";
import stripe from "@/lib/stripe";
import { CommonErrors, AccountErrors } from "@/lib/api/apiErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request){
  const session = await auth();
  if (!session?.user?.id){
    return CommonErrors.notAuthenticated();
  }

  const body = await request.json().catch(() => null);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { accounts: { select: { provider: true } } }
  });
  if (!user){
    return CommonErrors.notFound('user');
  }

  // Déterminer si l'utilisateur est OAuth (pas de passwordHash ou a des comptes OAuth)
  const isOAuthUser = !user.passwordHash || (user.accounts?.length > 0);

  if (isOAuthUser) {
    // Pour les utilisateurs OAuth, valider avec l'email
    const email = body?.email ? String(body.email).toLowerCase().trim() : "";
    if (!email){
      return NextResponse.json({ error: "Merci de saisir votre email pour confirmer." }, { status: 400 });
    }
    if (email !== user.email){
      return NextResponse.json({ error: "L'email ne correspond pas à celui de votre compte." }, { status: 400 });
    }
  } else {
    // Pour les utilisateurs standard, valider avec le mot de passe
    const password = body?.password ? String(body.password) : "";
    if (!password){
      return NextResponse.json({ error: "Merci de saisir votre mot de passe pour confirmer." }, { status: 400 });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid){
      return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 400 });
    }
  }

  // Récupérer les informations Stripe avant suppression
  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
    select: {
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });

  // Annuler l'abonnement et supprimer le customer Stripe
  if (subscription) {
    try {
      logger.context('DELETE account', 'info', `Suppression des données Stripe pour user ${user.id}`);

      // 1. Annuler l'abonnement Stripe (sans remboursement)
      if (subscription.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(subscription.stripeSubscriptionId, {
            prorate: false, // Pas de remboursement
          });
          logger.context('DELETE account', 'info', `✅ Abonnement Stripe ${subscription.stripeSubscriptionId} annulé`);
        } catch (stripeError) {
          logger.context('DELETE account', 'warn', `⚠️ Erreur annulation abonnement Stripe: ${stripeError.message}`);
          // Continuer même si l'annulation échoue (peut-être déjà annulé)
        }
      }

      // 2. Supprimer le customer Stripe (supprime payment methods, adresses, etc.)
      if (subscription.stripeCustomerId) {
        try {
          await stripe.customers.del(subscription.stripeCustomerId);
          logger.context('DELETE account', 'info', `✅ Customer Stripe ${subscription.stripeCustomerId} supprimé (+ payment methods, adresses)`);
        } catch (stripeError) {
          logger.context('DELETE account', 'warn', `⚠️ Erreur suppression customer Stripe: ${stripeError.message}`);
          // Continuer même si la suppression échoue (peut-être déjà supprimé)
        }
      }
    } catch (error) {
      logger.context('DELETE account', 'error', `❌ Erreur lors de la suppression Stripe: ${error.message}`);
      // Ne pas bloquer la suppression du compte si Stripe échoue
    }
  } else {
    logger.context('DELETE account', 'info', `Aucune subscription Stripe trouvée pour user ${user.id}`);
  }

  // Supprimer l'utilisateur de la DB (les foreign keys avec onDelete: Cascade supprimeront automatiquement toutes les données liées)
  try {
    logger.context('DELETE account', 'info', `Suppression de l'utilisateur ${user.id} (cascade automatique activé)`);

    // La suppression de l'utilisateur supprimera automatiquement via cascade :
    // - Accounts, CvFiles, BackgroundTasks, LinkHistory, Feedbacks
    // - ConsentLogs, TelemetryEvents, FeatureUsage, OpenAIUsage, OpenAICalls
    // - Subscriptions, CreditBalance, CreditTransactions, FeatureUsageCounters
    // - Referrals, EmailVerificationTokens, AutoSignInTokens, EmailChangeRequests
    await prisma.user.delete({ where: { id: user.id } });

    logger.context('DELETE account', 'info', `✅ Utilisateur ${user.id} supprimé avec succès (+ toutes données liées via cascade)`);
  } catch (error) {
    logger.context('DELETE account', 'error', "❌ Erreur lors de la suppression:", error);
    return AccountErrors.deleteFailed();
  }

  // Supprimer tous les cookies de l'utilisateur
  try {
    const cookieStore = await cookies();

    // Liste des cookies à supprimer
    const cookiesToDelete = [
      'cvFile',
      'next-auth.session-token',
      'next-auth.csrf-token',
      'next-auth.callback-url',
      '__Secure-next-auth.session-token',
      '__Host-next-auth.csrf-token'
    ];

    for (const cookieName of cookiesToDelete) {
      cookieStore.delete(cookieName);
    }

    logger.context('DELETE account', 'info', '✅ Cookies supprimés');
  } catch (error) {
    logger.context('DELETE account', 'warn', "⚠️ Suppression des cookies impossible:", error);
  }

  return NextResponse.json({ ok: true });
}
