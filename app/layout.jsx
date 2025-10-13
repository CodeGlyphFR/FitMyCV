import "./globals.css";
import React from "react";
import ConditionalTopBar from "@/components/ConditionalTopBar";
import ConditionalFooter from "@/components/ConditionalFooter";
import ConditionalMainWrapper from "@/components/ConditionalMainWrapper";
import CookieBanner from "@/components/cookies/CookieBanner";
import FeedbackButton from "@/components/feedback/FeedbackButton";
import RootProviders from "@/components/RootProviders";
import LoadingOverlay from "@/components/LoadingOverlay";
import { auth } from "@/lib/auth/session";
import { SITE_TITLE } from "@/lib/site";

export const metadata = {
  title: SITE_TITLE,
  description: "Compatible avec les parser ATS",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout(props){
  const session = await auth();
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
        <RootProviders session={session}>
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
          <CookieBanner />
          <FeedbackButton />
        </RootProviders>
      </body>
    </html>
  );
}
