"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";

export default function ConditionalFooter() {
  const pathname = usePathname();

  // Ne pas afficher le Footer sur la page principale (CV), la page Mon compte et toutes les pages d'authentification
  if (pathname === "/" || pathname === "/account" || pathname.startsWith("/auth")) {
    return <></>;
  }

  return <Footer />;
}
