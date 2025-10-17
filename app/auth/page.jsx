import { redirect } from "next/navigation";
import AuthScreen from "@/components/auth/AuthScreen";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export default async function AuthPage({ searchParams }){
  const session = await auth();
  if (session?.user?.id){
    redirect("/");
  }

  // Récupérer le paramètre registration_enabled depuis la base
  let registrationEnabled = true; // Valeur par défaut
  try {
    const setting = await prisma.setting.findUnique({
      where: { settingName: 'registration_enabled' },
    });
    if (setting) {
      registrationEnabled = setting.value === '1';
    }
  } catch (error) {
    console.error('[Auth Page] Erreur lors de la récupération du setting registration_enabled:', error);
    // En cas d'erreur, on laisse les inscriptions actives par défaut
  }

  const initialMode = searchParams?.mode === "register" ? "register" : "login";
  const availability = {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    apple: Boolean(
      process.env.APPLE_CLIENT_ID &&
      process.env.APPLE_CLIENT_SECRET &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      process.env.APPLE_PRIVATE_KEY
    ),
    github: Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET),
  };

  return <AuthScreen initialMode={initialMode} providerAvailability={availability} registrationEnabled={registrationEnabled} />;
}
