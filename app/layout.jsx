import "./globals.css";
import React from "react";
import ConditionalTopBar from "@/components/ConditionalTopBar";
import ConditionalFooter from "@/components/ConditionalFooter";
import ConditionalMainWrapper from "@/components/ConditionalMainWrapper";
import CookieBanner from "@/components/cookies/CookieBanner";
import FeedbackButton from "@/components/feedback/FeedbackButton";
import RootProviders from "@/components/RootProviders";
import LoadingOverlay from "@/components/LoadingOverlay";
import GlobalBackground from "@/components/GlobalBackground";
import { auth } from "@/lib/auth/session";
import { SITE_TITLE } from "@/lib/site";
import prisma from "@/lib/prisma";

export const metadata = {
  title: SITE_TITLE,
  description: "Compatible avec les parser ATS",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout(props){
  const session = await auth();

  // Récupérer les settings côté serveur pour éviter le flash de contenu incorrect
  let initialSettings = {
    registration_enabled: true,
    feature_manual_cv: true,
    feature_ai_generation: true,
    feature_import: true,
    feature_export: true,
    feature_match_score: true,
    feature_optimize: true,
    feature_history: true,
    feature_search_bar: true,
    feature_translate: true,
    feature_language_switcher: true,
    feature_edit_mode: true,
    feature_feedback: true,
  };

  try {
    const allSettings = await prisma.setting.findMany();
    const settingsObject = {};
    allSettings.forEach((setting) => {
      settingsObject[setting.settingName] = setting.value === '1';
    });
    initialSettings = { ...initialSettings, ...settingsObject };
  } catch (error) {
    console.error('Error fetching settings in layout:', error);
    // On garde les valeurs par défaut en cas d'erreur
  }

  return (
    <html lang="fr">
      <head>
        {/* Préchargement des ressources critiques pour LCP */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* CSS critique inline pour éviter le blocage */}
        <style dangerouslySetInnerHTML={{__html: `
          /* Fonts system fallback pour éviter FOIT */
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          }
          /* Réserver l'espace pour éviter CLS */
          .footer-placeholder {
            height: 56px;
            min-height: 56px;
            max-height: 56px;
            overflow: visible;
          }
          /* Stabiliser le main pour éviter CLS */
          main {
            min-height: calc(100vh - 56px);
          }
        `}} />
      </head>
      <body className="min-h-screen antialiased flex flex-col">
        <RootProviders session={session} initialSettings={initialSettings}>
          <GlobalBackground />
          <div className="relative z-10 flex flex-col min-h-screen">
            <LoadingOverlay />
            {/* TopBar sans wrapper pour éviter l'espace vide */}
            <ConditionalTopBar />
            <ConditionalMainWrapper
              footerPlaceholder={
                <div className="footer-placeholder h-[56px]">
                  <ConditionalFooter />
                </div>
              }
            >
              {props.children}
            </ConditionalMainWrapper>
          </div>
          <CookieBanner />
          <FeedbackButton />
        </RootProviders>
      </body>
    </html>
  );
}
