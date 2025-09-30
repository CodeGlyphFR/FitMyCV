import "./globals.css";
import React from "react";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/cookies/CookieBanner";
import RootProviders from "@/components/RootProviders";
import { auth } from "@/lib/auth/session";
import { SITE_TITLE } from "@/lib/site";

export const metadata = {
  title: SITE_TITLE,
  description: "Compatible avec les parser ATS",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
};

export default async function RootLayout(props){
  const session = await auth();
  return (
    <html lang="fr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className="min-h-screen antialiased flex flex-col">
        <RootProviders session={session}>
          <TopBar />
          <main className="flex-grow mb-0">
            {props.children}
          </main>
          <Footer />
          <CookieBanner />
        </RootProviders>
      </body>
    </html>
  );
}
