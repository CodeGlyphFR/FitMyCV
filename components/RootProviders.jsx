"use client";

import React from "react";
import { SessionProvider } from "next-auth/react";
import AdminProvider from "@/components/admin/AdminProvider";

export default function RootProviders({ session, children }){
  return (
    <SessionProvider session={session}>
      <AdminProvider>
        {children}
      </AdminProvider>
    </SessionProvider>
  );
}
