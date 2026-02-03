"use client";

import { useState, useEffect } from "react";
import { MEDIA_QUERIES } from "@/lib/constants/breakpoints";

/**
 * Hook pour détecter le mode responsive de façon fiable
 *
 * Utilise matchMedia au lieu de mesurer la hauteur du conteneur,
 * ce qui est plus fiable et performant.
 *
 * @returns {{ isMobile: boolean, isDesktop: boolean }}
 *   - isMobile: true si la largeur est < TOPBAR_DESKTOP (1025px)
 *   - isDesktop: true si la largeur est >= TOPBAR_DESKTOP (1025px)
 */
export function useResponsiveMode() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Vérifier si on est côté client
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(MEDIA_QUERIES.IS_MOBILE);

    // État initial
    setIsMobile(mediaQuery.matches);

    // Listener pour les changements
    const handler = (e) => setIsMobile(e.matches);
    mediaQuery.addEventListener("change", handler);

    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return { isMobile, isDesktop: !isMobile };
}
