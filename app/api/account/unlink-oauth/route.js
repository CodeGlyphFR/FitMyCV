import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth/session";
import logger from "@/lib/security/secureLogger";

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
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const provider = body?.provider?.toLowerCase();

  if (!provider) {
    return NextResponse.json({ error: "Provider requis." }, { status: 400 });
  }

  // Vérifier les providers valides
  const validProviders = ["google", "github", "apple"];
  if (!validProviders.includes(provider)) {
    return NextResponse.json({ error: "Provider invalide." }, { status: 400 });
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
    return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
  }

  // Vérifier que le provider est lié
  const accountToUnlink = user.accounts.find(acc => acc.provider === provider);
  if (!accountToUnlink) {
    return NextResponse.json({
      error: "Ce provider n'est pas lié à votre compte."
    }, { status: 404 });
  }

  // Règle de protection : on ne peut pas délier si c'est le seul compte
  if (user.accounts.length <= 1) {
    return NextResponse.json({
      error: "Impossible de délier : vous devez avoir au moins un compte lié."
    }, { status: 400 });
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
    return NextResponse.json({
      error: "Erreur lors de la déliaison."
    }, { status: 500 });
  }
}
