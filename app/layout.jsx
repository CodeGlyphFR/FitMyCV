import "./globals.css";
import React from "react";
import TopBar from "@/components/TopBar";
import RootProviders from "@/components/RootProviders";
import { auth } from "@/lib/auth/session";
import { SITE_TITLE } from "@/lib/site";

export const metadata = {
  title: SITE_TITLE,
  description: "Compatible avec les parser ATS",
};

export default async function RootLayout(props){
  const session = await auth();
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">
        <RootProviders session={session}>
          <TopBar />
          {props.children}
        </RootProviders>
      </body>
    </html>
  );
}
