"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import AdminProvider from "@/components/admin/AdminProvider";
import NotificationProvider from "@/components/notifications/NotificationProvider";
import NotificationContainer from "@/components/notifications/NotificationContainer";
import BackgroundTasksProvider from "@/components/BackgroundTasksProvider";
import RealtimeRefreshProvider from "@/components/RealtimeRefreshProvider";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function RootProviders({ session, children }){
  const pathname = usePathname();
  const isAuthPage = pathname === "/auth";

  return (
    <SessionProvider session={session}>
      <LanguageProvider>
        <AdminProvider>
          <NotificationProvider>
            {isAuthPage ? (
              <>
                {children}
                <NotificationContainer />
                <LanguageSwitcher />
              </>
            ) : (
              <RealtimeRefreshProvider>
                <BackgroundTasksProvider>
                  {children}
                  <NotificationContainer />
                  <LanguageSwitcher />
                </BackgroundTasksProvider>
              </RealtimeRefreshProvider>
            )}
          </NotificationProvider>
        </AdminProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}
