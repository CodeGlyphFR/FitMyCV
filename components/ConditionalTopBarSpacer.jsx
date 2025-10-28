"use client";

import { usePathname } from "next/navigation";
import TopBarSpacer from "@/components/TopBarSpacer";

/**
 * Affiche le TopBarSpacer uniquement sur les pages où la TopBar est visible.
 * Compense la hauteur de la TopBar en position fixed.
 */
export default function ConditionalTopBarSpacer() {
  const pathname = usePathname();

  // Ne pas afficher le spacer sur les pages d'authentification et admin
  // (même logique que ConditionalTopBar)
  if (pathname.startsWith("/auth") || pathname.startsWith("/admin")) {
    return null;
  }

  return <TopBarSpacer />;
}
