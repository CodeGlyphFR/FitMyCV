import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/session";
import SubscriptionsPage from "@/components/subscription/SubscriptionsPage";

export const metadata = {
  title: "Abonnements & Crédits - FitMyCV.io",
  description: "Gérez votre abonnement et vos crédits",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SubscriptionsRoute() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth?mode=login");
  }

  return <SubscriptionsPage user={session.user} />;
}
