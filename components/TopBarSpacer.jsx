"use client";

/**
 * Spacer pour compenser la hauteur de la TopBar en position fixed.
 * La TopBar ayant été retirée du flux normal avec position: fixed,
 * ce composant prend sa place pour éviter que le contenu soit caché dessous.
 *
 * Hauteur : 115px = min-h-[60px] + p-3 (24px) + border-b (1px) + marge supplémentaire (30px)
 */
export default function TopBarSpacer() {
  return (
    <div
      className="no-print"
      style={{
        height: 'calc(115px + env(safe-area-inset-top))',
        minHeight: 'calc(115px + env(safe-area-inset-top))'
      }}
      aria-hidden="true"
    />
  );
}
