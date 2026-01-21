"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import AdminProvider from "@/components/admin/AdminProvider";
import NotificationProvider from "@/components/notifications/NotificationProvider";
import NotificationContainer from "@/components/notifications/NotificationContainer";
import BackgroundTasksProvider from "@/components/providers/BackgroundTasksProvider";
import RealtimeRefreshProvider from "@/components/providers/RealtimeRefreshProvider";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { SettingsProvider } from "@/lib/settings/SettingsContext";
import { CreditCostsProvider } from "@/lib/creditCosts/CreditCostsContext";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import RecaptchaProvider from "@/components/providers/RecaptchaProvider";
import OnboardingProvider from "@/components/onboarding/OnboardingProvider";
import PipelineProgressProvider from "@/components/providers/PipelineProgressProvider";

export default function RootProviders({ session, initialSettings, children }){
  const pathname = usePathname();
  const isAuthPage = pathname === "/auth";

  return (
    <SessionProvider session={session}>
      <RecaptchaProvider>
        <SettingsProvider initialSettings={initialSettings}>
        <CreditCostsProvider>
        <LanguageProvider>
        <NotificationProvider>
        <AdminProvider>
        <OnboardingProvider>
            {isAuthPage ? (
              <>
                {children}
                <NotificationContainer />
                <LanguageSwitcher />
              </>
            ) : (
              <RealtimeRefreshProvider>
                <BackgroundTasksProvider>
                  <PipelineProgressProvider>
                    {children}
                    <NotificationContainer />
                    <LanguageSwitcher />
                  </PipelineProgressProvider>
                </BackgroundTasksProvider>
              </RealtimeRefreshProvider>
            )}
        </OnboardingProvider>
        </AdminProvider>
        </NotificationProvider>
        </LanguageProvider>
        </CreditCostsProvider>
      </SettingsProvider>
      </RecaptchaProvider>
    </SessionProvider>
  );
}
