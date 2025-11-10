"use client";

import { usePathname } from "next/navigation";
import TopBar from "@/components/TopBar";

export default function ConditionalTopBar() {
  const pathname = usePathname();

  // Ne pas afficher la TopBar sur les pages d'authentification et admin
  if (pathname.startsWith("/auth") || pathname.startsWith("/admin")) {
    return <></>;
  }

  return <TopBar />;
}
