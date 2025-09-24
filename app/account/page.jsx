import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/session";
import AccountSettings from "@/components/account/AccountSettings";

export const runtime = "nodejs";

export default async function AccountPage(){
  const session = await auth();
  if (!session?.user?.id){
    redirect("/auth?mode=login");
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Mon compte</h1>
        <p className="text-sm text-neutral-600">Gérez vos informations personnelles et vos préférences de sécurité.</p>
      </div>
      <AccountSettings user={session.user} />
    </main>
  );
}
