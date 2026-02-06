import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/session";
import AccountSettings from "@/components/account/AccountSettings";
import AccountPageHeader from "@/components/account/AccountPageHeader";
import AccountPageLoading from "@/components/account/AccountPageLoading";
import Footer from "@/components/layout/Footer";
import prisma from "@/lib/prisma";
import { Suspense } from "react";

export const metadata = {
  title: "Mon compte - FitMyCV.io",
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
        <AccountPageHeader />
        <Suspense fallback={<AccountPageLoading />}>
          <AccountSettings
            user={session.user}
            isOAuthUser={isOAuthUser}
            oauthProviders={oauthProviders}
          />
        </Suspense>
        <Footer />
      </div>
    </main>
  );
}
