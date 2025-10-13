import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/session";
import AccountSettings from "@/components/account/AccountSettings";
import Link from "next/link";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export default async function AccountPage(){
  const session = await auth();
  if (!session?.user?.id){
    redirect("/auth?mode=login");
  }

  // Récupérer les informations détaillées de l'utilisateur
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      passwordHash: true,
      accounts: {
        select: {
          provider: true,
        },
      },
    },
  });

  // Déterminer si l'utilisateur est OAuth (pas de passwordHash ou a des comptes OAuth)
  const isOAuthUser = !dbUser?.passwordHash || (dbUser?.accounts?.length > 0);
  const oauthProviders = dbUser?.accounts?.map(acc => acc.provider) || [];

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="space-y-1">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 mb-4 transition-colors"
        >
          <span>←</span>
          <span>Retour aux CVs</span>
        </Link>
        <h1 className="text-2xl font-semibold">Mon compte</h1>
        <p className="text-sm text-neutral-600">Gérez vos informations personnelles et vos préférences de sécurité.</p>
      </div>
      <AccountSettings
        user={session.user}
        isOAuthUser={isOAuthUser}
        oauthProviders={oauthProviders}
      />
    </main>
  );
}
