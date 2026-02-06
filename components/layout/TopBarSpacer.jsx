"use client";

/**
 * Spacer pour compenser la hauteur de la TopBar en position fixed.
 * La TopBar ayant été retirée du flux normal avec position: fixed,
 * ce composant prend sa place pour éviter que le contenu soit caché dessous.
 *
 * Hauteur responsive :
 * - Mobile (< 976px) : 115px (TopBar sur 2 lignes)
 * - Desktop (≥ 976px) : 57px (TopBar sur 1 ligne)
 *   Calcul desktop : padding-top (12px) + contenu h-8 (32px) + padding-bottom (12px) + border (1px) = 57px
 */
export default function TopBarSpacer() {
  return (
    <div
      className="no-print h-[115px] topbar:h-[57px]"
      style={{
        paddingTop: 'env(safe-area-inset-top)'
      }}
      aria-hidden="true"
    />
  );
}
