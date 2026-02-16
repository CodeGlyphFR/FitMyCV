/**
 * URLs des stores pour l'extension navigateur FitMyCV.
 * Mettre à jour ces valeurs quand l'extension sera publiée.
 * `null` = pas encore disponible sur le store.
 */
export const EXTENSION_STORE = {
  chrome: null, // URL Chrome Web Store (quand publié)
  firefox: null, // URL Firefox Add-ons (quand publié)
  safari: null, // URL App Store Safari (quand publié)
};

/**
 * Icônes SVG inline pour chaque navigateur.
 * Utilisées dans le tutorial extension pour les boutons d'installation.
 */
export const BROWSER_ICONS = {
  chrome: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
      <circle cx="12" cy="12" r="10" fill="#4285F4" />
      <path d="M12 2a10 10 0 0 0-8.66 5h5.66l3-5.2A10 10 0 0 0 12 2Z" fill="#EA4335" />
      <path d="M3.34 7A10 10 0 0 0 7 20.66l3-5.2-3-5.2L3.34 7Z" fill="#FBBC05" />
      <path d="M7 20.66A10 10 0 0 0 22 12h-6l-3 5.2L7 20.66Z" fill="#34A853" />
      <circle cx="12" cy="12" r="4" fill="white" />
    </svg>
  ),
  firefox: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
      <circle cx="12" cy="12" r="10" fill="#FF9500" />
      <path d="M18.5 8.5c-.5-1.5-2-3-3.5-3.5.5 1 .5 2 0 3-1-2-3-3-5-3 2 2 2 4 1 6-1-1-1.5-2.5-1-4-2 1.5-3 4-2.5 6.5.5 2.5 2.5 4.5 5 5s5-1 6-3.5c1-2.5.5-5 0-6.5Z" fill="#FF4500" />
    </svg>
  ),
  safari: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
      <circle cx="12" cy="12" r="10" fill="#006CFF" />
      <polygon points="12,4 14,10 20,12 14,14 12,20 10,14 4,12 10,10" fill="white" />
      <polygon points="12,4 14,10 12,12" fill="#FF3B30" />
      <polygon points="12,12 10,14 12,20" fill="#FF3B30" />
    </svg>
  ),
};

/**
 * Détecte le navigateur courant pour orienter l'utilisateur
 * vers le bon store.
 */
export function detectBrowser() {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Chromium')) return 'safari';
  if (ua.includes('Edg') || ua.includes('Chrome')) return 'chrome';
  return 'unknown';
}
