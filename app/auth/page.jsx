import { redirect } from "next/navigation";
import AuthScreen from "@/components/auth/AuthScreen";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";

export const metadata = {
  title: "Connexion - FitMyCV.io",
  description: "Connectez-vous ou créez un compte pour accéder à vos CV personnalisés",
};

export const runtime = "nodejs";

export default async function AuthPage({ searchParams }){
  const session = await auth();
  if (session?.user?.id){
    redirect("/");
  }

  // Récupérer les settings registration_enabled et maintenance_enabled depuis la base
  let registrationEnabled = true; // Valeur par défaut
  let maintenanceEnabled = false; // Valeur par défaut
  try {
    const [regSetting, maintenanceSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { settingName: 'registration_enabled' } }),
      prisma.setting.findUnique({ where: { settingName: 'maintenance_enabled' } }),
    ]);
    if (regSetting) {
      registrationEnabled = regSetting.value === '1';
    }
    if (maintenanceSetting) {
      maintenanceEnabled = maintenanceSetting.value === '1';
    }
  } catch (error) {
    console.error('[Auth Page] Erreur lors de la récupération des settings:', error);
    // En cas d'erreur, on laisse les valeurs par défaut
  }

  const initialMode = searchParams?.mode === "register" ? "register" : "login";
  const oauthError = searchParams?.error || null;
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

  return <AuthScreen initialMode={initialMode} providerAvailability={availability} registrationEnabled={registrationEnabled} maintenanceEnabled={maintenanceEnabled} oauthError={oauthError} />;
}
