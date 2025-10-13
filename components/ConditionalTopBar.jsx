"use client";

import { usePathname } from "next/navigation";
import TopBar from "@/components/TopBar";

export default function ConditionalTopBar() {
  const pathname = usePathname();

  // Ne pas afficher la TopBar sur toutes les pages d'authentification
  if (pathname.startsWith("/auth")) {
    return <></>;
  }

  return <TopBar />;
}
