import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/session";
import AccountSettings from "@/components/account/AccountSettings";
import prisma from "@/lib/prisma";
import { Suspense } from "react";

export const metadata = {
  title: "Mon compte - FitMyCv.ai",
  description: "Gérez vos informations personnelles et vos préférences",
};

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
    <main className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 pt-6 pb-2 space-y-6">
        <div className="space-y-1">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white mb-4 transition-colors drop-shadow"
          >
            <span>←</span>
            <span>Retour aux CVs</span>
          </a>
          <h1 className="text-2xl font-semibold text-white drop-shadow-lg">Mon compte</h1>
          <p className="text-sm text-white/70 drop-shadow">Gérez vos informations personnelles et vos préférences de sécurité.</p>
        </div>
        <Suspense fallback={<div className="text-center py-4 text-white/70">Chargement...</div>}>
          <AccountSettings
            user={session.user}
            isOAuthUser={isOAuthUser}
            oauthProviders={oauthProviders}
          />
        </Suspense>

        {/* Footer */}
        <div className="mt-2 mb-0 text-xs text-white/70 text-center space-y-2">
          <div>© 2025 FitMyCv.ai (v1.0.9.1)</div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-0 sm:gap-1 leading-none -space-y-3 sm:space-y-0">
            <div className="flex items-baseline justify-center gap-1 leading-none">
              <a href="/about" className="hover:text-white transition-colors">
                À propos
              </a>
              <span className="text-white/40">•</span>
              <a href="/cookies" className="hover:text-white transition-colors">
                Cookies
              </a>
              <span className="text-white/40 hidden sm:inline">•</span>
            </div>
            <div className="flex items-baseline justify-center gap-1 leading-none">
              <a href="/terms" className="hover:text-white transition-colors">
                Conditions générales
              </a>
              <span className="text-white/40">•</span>
              <a href="/privacy" className="hover:text-white transition-colors">
                Politique de confidentialité
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
