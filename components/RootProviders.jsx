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
import { SettingsProvider } from "@/lib/settings/SettingsContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import RecaptchaProvider from "@/components/RecaptchaProvider";
import { TelemetryProvider } from "@/components/TelemetryProvider";

export default function RootProviders({ session, initialSettings, children }){
  const pathname = usePathname();
  const isAuthPage = pathname === "/auth";

  return (
    <SessionProvider session={session}>
      <RecaptchaProvider>
        <SettingsProvider initialSettings={initialSettings}>
        <LanguageProvider>
        <AdminProvider>
          <TelemetryProvider>
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
          </TelemetryProvider>
        </AdminProvider>
        </LanguageProvider>
      </SettingsProvider>
      </RecaptchaProvider>
    </SessionProvider>
  );
}
