import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth/session";
import logger from "@/lib/security/secureLogger";
import { CommonErrors, AccountErrors, AuthErrors } from "@/lib/api/apiErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/account/unlink-oauth
 * Supprime un lien OAuth du compte utilisateur
 * Règle de protection : linkedAccounts.length > 1
 */
export async function DELETE(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return CommonErrors.notAuthenticated();
  }

  const body = await request.json().catch(() => null);
  const provider = body?.provider?.toLowerCase();

  if (!provider) {
    return AuthErrors.providerRequired();
  }

  // Vérifier les providers valides
  const validProviders = ["google", "github", "apple"];
  if (!validProviders.includes(provider)) {
    return AuthErrors.providerInvalid();
  }

  // Récupérer les comptes OAuth liés
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      accounts: {
        select: {
          id: true,
          provider: true,
        },
      },
    },
  });

  if (!user) {
    return CommonErrors.notFound('user');
  }

  // Vérifier que le provider est lié
  const accountToUnlink = user.accounts.find(acc => acc.provider === provider);
  if (!accountToUnlink) {
    return AuthErrors.providerNotLinked();
  }

  // Règle de protection : on ne peut pas délier si c'est le seul compte
  if (user.accounts.length <= 1) {
    return AuthErrors.cannotUnlinkLastProvider();
  }

  // Supprimer le lien OAuth
  try {
    await prisma.account.delete({
      where: { id: accountToUnlink.id },
    });

    logger.context('unlink-oauth', 'info', `Provider ${provider} délié pour user ${session.user.id}`);

    return NextResponse.json({ ok: true, provider });
  } catch (error) {
    logger.context('unlink-oauth', 'error', `Erreur déliaison ${provider}:`, error);
    return AccountErrors.unlinkFailed();
  }
}
