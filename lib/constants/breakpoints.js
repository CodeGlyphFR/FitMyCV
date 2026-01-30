/**
 * Breakpoints centralisés pour toute l'application
 *
 * Ces constantes définissent les points de bascule responsive.
 * Modifier ces valeurs affectera tous les composants qui les utilisent.
 */
export const BREAKPOINTS = {
  // Point de bascule mobile/desktop pour la TopBar
  // En dessous de cette valeur : mode mobile (2 lignes)
  // Au-dessus ou égal : mode desktop (1 ligne)
  TOPBAR_DESKTOP: 1025,

  // Breakpoint pour afficher le dropdown vs modal (TaskQueue)
  // En dessous : modal plein écran
  // Au-dessus ou égal : dropdown
  TASK_QUEUE_DROPDOWN: 1025,
};

/**
 * Media queries pré-construites pour utilisation avec matchMedia
 * Ces queries sont cohérentes avec les breakpoints définis ci-dessus
 */
export const MEDIA_QUERIES = {
  // true quand la largeur est inférieure à TOPBAR_DESKTOP (mode mobile)
  IS_MOBILE: `(max-width: ${BREAKPOINTS.TOPBAR_DESKTOP - 1}px)`,
  // true quand la largeur est supérieure ou égale à TOPBAR_DESKTOP (mode desktop)
  IS_DESKTOP: `(min-width: ${BREAKPOINTS.TOPBAR_DESKTOP}px)`,
};
