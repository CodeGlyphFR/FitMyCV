import "./globals.css";
import React from "react";
import { Oswald } from "next/font/google";

const oswald = Oswald({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-oswald",
  display: "swap",
});
import ConditionalTopBar from "@/components/layout/ConditionalTopBar";
import ConditionalTopBarSpacer from "@/components/layout/ConditionalTopBarSpacer";
import ConditionalFooter from "@/components/layout/ConditionalFooter";
import ConditionalMainWrapper from "@/components/layout/ConditionalMainWrapper";
import CookieBanner from "@/components/cookies/CookieBanner";
import FeedbackButton from "@/components/feedback/FeedbackButton";
import RootProviders from "@/components/providers/RootProviders";
import LoadingOverlay from "@/components/ui/LoadingOverlay";
import GlobalBackground from "@/components/layout/GlobalBackground";
import IconPreloader from "@/components/ui/IconPreloader";
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
    <html lang="fr" className={oswald.variable} suppressHydrationWarning>
      <head>
        {/* Préchargement des ressources critiques pour LCP */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Pré-chargement des icônes du dropdown CV pour iOS */}
        <IconPreloader />
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

          /* ============================================
             INITIAL LOADING OVERLAY (CSS pur)
             Visible IMMÉDIATEMENT au chargement
             Supprimé par React LoadingOverlay
             ============================================ */
          #initial-loading-overlay {
            position: fixed;
            /* Étendre au-delà des bords + safe areas iOS Safari */
            top: calc(-100px - env(safe-area-inset-top, 0px));
            left: calc(-100px - env(safe-area-inset-left, 0px));
            right: calc(-100px - env(safe-area-inset-right, 0px));
            bottom: calc(-100px - env(safe-area-inset-bottom, 0px));
            /* Dimensions incluant les safe areas pour iOS 26+ Safari */
            width: calc(100vw + 200px + env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px));
            height: calc(100vh + 200px + env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px));
            max-height: calc(100dvh + 200px + env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px));
            background-color: rgb(2, 6, 23);
            z-index: 999999999;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            overscroll-behavior: none;
            -webkit-overflow-scrolling: touch;
          }

          /* Spinner container */
          #initial-loading-overlay .spinner-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1.5rem;
          }

          /* Spinner wrapper */
          #initial-loading-overlay .spinner {
            position: relative;
            width: 64px;
            height: 64px;
          }

          /* Outer ring */
          #initial-loading-overlay .spinner-outer {
            position: absolute;
            inset: 0;
            border-radius: 9999px;
            border: 4px solid rgba(255, 255, 255, 0.2);
          }

          /* Spinning ring */
          #initial-loading-overlay .spinner-spinning {
            position: absolute;
            inset: 0;
            border-radius: 9999px;
            border: 4px solid transparent;
            border-top-color: white;
            border-right-color: white;
            animation: spin 1s linear infinite;
          }

          /* Inner pulsing dot */
          #initial-loading-overlay .spinner-dot {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 12px;
            height: 12px;
            border-radius: 9999px;
            background-color: white;
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }

          /* Animations */
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }

          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }

          /* Fade out quand React prend le relais */
          #initial-loading-overlay.hiding {
            opacity: 0;
            transition: opacity 300ms ease-out;
            pointer-events: none;
          }
        `}} />
      </head>
      <body className="min-h-screen antialiased flex flex-col">
        {/* Initial loading overlay - CSS pur, visible IMMÉDIATEMENT */}
        <div id="initial-loading-overlay">
          <div className="spinner-container">
            <div className="spinner">
              <div className="spinner-outer"></div>
              <div className="spinner-spinning"></div>
              <div className="spinner-dot"></div>
            </div>
          </div>
        </div>

        <RootProviders session={session} initialSettings={initialSettings}>
          <GlobalBackground />
          <div className="relative z-10 flex flex-col min-h-screen">
            {/* TopBar en position fixed */}
            <ConditionalTopBar />
            {/* Spacer pour compenser la TopBar retirée du flux */}
            <ConditionalTopBarSpacer />
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
          <LoadingOverlay />
        </RootProviders>
      </body>
    </html>
  );
}
