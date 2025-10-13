"use client";

import { usePathname } from "next/navigation";

/**
 * Wrapper conditionnel pour le main et le footer placeholder
 * Sur les pages d'authentification, rend uniquement les children sans wrapper
 */
export default function ConditionalMainWrapper({ children, footerPlaceholder }) {
  const pathname = usePathname();

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
