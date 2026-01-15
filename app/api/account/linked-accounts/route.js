import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth/session";
import { CommonErrors } from "@/lib/api/apiErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/account/linked-accounts
 * Retourne les comptes OAuth liés et les providers disponibles
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return CommonErrors.notAuthenticated();
  }

  // Récupérer les comptes OAuth liés
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      accounts: {
        select: {
          provider: true,
          providerAccountId: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    return CommonErrors.notFound('user');
  }

  // Formater les comptes liés
  const linkedAccounts = user.accounts.map(account => ({
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    linkedAt: account.createdAt,
  }));

  // Déterminer les providers disponibles (configurés via env)
  const availableProviders = {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET),
    apple: Boolean(
      process.env.APPLE_CLIENT_ID &&
      process.env.APPLE_CLIENT_SECRET &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      process.env.APPLE_PRIVATE_KEY
    ),
  };

  // Calculer canUnlink pour chaque provider lié
  // Règle : on peut délier seulement si linkedAccounts.length > 1
  const canUnlinkAny = linkedAccounts.length > 1;
  const canUnlink = {};
  for (const account of linkedAccounts) {
    canUnlink[account.provider] = canUnlinkAny;
  }

  return NextResponse.json({
    linkedAccounts,
    availableProviders,
    canUnlink,
  });
}
