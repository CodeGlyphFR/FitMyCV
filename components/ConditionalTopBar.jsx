"use client";

import { usePathname } from "next/navigation";
import TopBar from "@/components/TopBar";

export default function ConditionalTopBar() {
  const pathname = usePathname();

  // Ne pas afficher la TopBar sur la page de login
  if (pathname === "/auth") {
    return null;
  }

  return <TopBar />;
}
