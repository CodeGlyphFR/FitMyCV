"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";

export default function ConditionalFooter() {
  const pathname = usePathname();

  // Ne pas afficher le Footer sur la page principale (CV), la page Mon compte et l'authentification
  if (pathname === "/" || pathname === "/account" || pathname === "/auth") {
    return <></>;
  }

  return <Footer />;
}
