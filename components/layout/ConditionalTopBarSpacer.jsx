"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAdmin } from "@/components/admin/AdminProvider";
import TopBarSpacer from "@/components/layout/TopBarSpacer";

/**
 * Affiche le TopBarSpacer uniquement sur les pages où la TopBar est visible.
 * Compense la hauteur de la TopBar en position fixed.
 * Doit suivre exactement la même logique que TopBar.jsx pour éviter les gaps.
 */
export default function ConditionalTopBarSpacer() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { hasAnyCv } = useAdmin();

  // Ne pas afficher le spacer sur les pages d'authentification et admin
  if (pathname.startsWith("/auth") || pathname.startsWith("/admin")) {
    return null;
  }

  // Afficher le spacer pendant le chargement (TopBar visible en loading)
  if (status === "loading") {
    return <TopBarSpacer />;
  }

  // Ne pas afficher le spacer si l'utilisateur n'est pas authentifié
  const isAuthenticated = status === "authenticated" && session?.user;
  if (!isAuthenticated) {
    return null;
  }

  // Ne pas afficher le spacer si aucun CV (TopBar masquée)
  if (!hasAnyCv) {
    return null;
  }

  return <TopBarSpacer />;
}
