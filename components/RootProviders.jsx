"use client";

import React from "react";
import { SessionProvider } from "next-auth/react";
import AdminProvider from "@/components/admin/AdminProvider";
import NotificationProvider from "@/components/notifications/NotificationProvider";
import NotificationContainer from "@/components/notifications/NotificationContainer";
import BackgroundTasksProvider from "@/components/BackgroundTasksProvider";

export default function RootProviders({ session, children }){
  return (
    <SessionProvider session={session}>
      <AdminProvider>
        <NotificationProvider>
          <BackgroundTasksProvider>
            {children}
            <NotificationContainer />
          </BackgroundTasksProvider>
        </NotificationProvider>
      </AdminProvider>
    </SessionProvider>
  );
}
