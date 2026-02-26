"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Wrapper conditionnel pour le main et le footer placeholder
 * Sur les pages d'authentification, rend uniquement les children sans wrapper
 * Gère aussi le scroll-to-top sur changement de route (scroll container)
 */
export default function ConditionalMainWrapper({ children, footerPlaceholder }) {
  const pathname = usePathname();

  // Scroll to top du scroll container lors des navigations
  useEffect(() => {
    const container = document.getElementById('scroll-container');
    if (container) container.scrollTop = 0;
  }, [pathname]);

  // Pages d'authentification : pas de wrapper main ni footer placeholder
  if (pathname.startsWith("/auth")) {
    return <>{children}</>;
  }

  // Autres pages : structure normale avec main et footer placeholder
  return (
    <>
      <main className="flex-grow mb-0">
        {children}
      </main>
      {footerPlaceholder}
    </>
  );
}
