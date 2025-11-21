'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Composant Highlight pour créer un spotlight sur un élément
 *
 * Crée un overlay sombre avec un découpage (cutout) autour de l'élément cible
 * pour le mettre en évidence pendant l'onboarding.
 *
 * Props:
 * - targetSelector: string - Sélecteur CSS de l'élément à highlighter
 * - show: boolean - Afficher ou masquer le highlight
 * - padding: number - Padding autour de l'élément (respiration) - default: 8
 * - onBackdropClick: function - Callback quand on clique sur le backdrop
 * - ringColor: string - Couleur du ring autour de l'élément - default: 'emerald-400'
 * - ringWidth: number - Largeur du ring en pixels - default: 4
 * - backdropOpacity: number - Opacité du backdrop - default: 70
 */
export default function OnboardingHighlight({
  targetSelector,
  show = false,
  padding = 8,
  onBackdropClick,
  ringColor = 'emerald-400',
  ringWidth = 4,
  backdropOpacity = 70,
}) {
  const [rect, setRect] = useState(null);

  /**
   * Calculer et mettre à jour la position de l'élément cible
   */
  const updatePosition = () => {
    if (!targetSelector || !show) {
      setRect(null);
      return;
    }

    const element = document.querySelector(targetSelector);
    if (!element) {
      console.warn(`[OnboardingHighlight] Element not found: ${targetSelector}`);
      setRect(null);
      return;
    }

    const bounds = element.getBoundingClientRect();

    setRect({
      top: bounds.top - padding,
      left: bounds.left - padding,
      width: bounds.width + padding * 2,
      height: bounds.height + padding * 2,
      // Position originale (sans padding) pour le ring
      innerTop: bounds.top,
      innerLeft: bounds.left,
      innerWidth: bounds.width,
      innerHeight: bounds.height,
    });
  };

  /**
   * Mise à jour position sur scroll, resize, et changement show/targetSelector
   */
  useEffect(() => {
    if (!show) {
      setRect(null);
      return;
    }

    updatePosition();

    // Listener resize et scroll
    const handleUpdate = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true); // Capture phase pour tous scrolls

    // Update interval (au cas où l'élément bouge dynamiquement)
    const interval = setInterval(handleUpdate, 200);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
      clearInterval(interval);
    };
  }, [show, targetSelector, padding]);

  /**
   * Handler clic backdrop
   */
  const handleBackdropClick = (e) => {
    // Vérifier qu'on a bien cliqué sur le backdrop et pas sur l'élément
    if (e.target === e.currentTarget && onBackdropClick) {
      onBackdropClick();
    }
  };

  // Ne pas render si pas show ou pas de rect
  if (!show || !rect) return null;

  // Convertir ringColor en classe Tailwind
  const ringColorMap = {
    'emerald-400': 'ring-emerald-400',
    'emerald-500': 'ring-emerald-500',
    'sky-400': 'ring-sky-400',
    'blue-400': 'ring-blue-400',
  };

  const ringClass = ringColorMap[ringColor] || 'ring-emerald-400';

  const highlightContent = (
    <div
      className="fixed inset-0 z-[10003] pointer-events-none"
      role="presentation"
      aria-hidden="true"
    >
      {/* Backdrop avec blur */}
      <div
        className={`absolute inset-0 bg-black/${backdropOpacity} backdrop-blur-sm pointer-events-auto`}
        onClick={handleBackdropClick}
        style={{
          // Découpage (cutout) autour de l'élément
          clipPath: `polygon(
            0% 0%,
            0% 100%,
            100% 100%,
            100% 0%,
            0% 0%,
            ${rect.left}px ${rect.top}px,
            ${rect.left}px ${rect.top + rect.height}px,
            ${rect.left + rect.width}px ${rect.top + rect.height}px,
            ${rect.left + rect.width}px ${rect.top}px,
            ${rect.left}px ${rect.top}px
          )`,
        }}
      />

      {/* Ring/Border autour de l'élément */}
      <div
        className={`
          absolute
          ${ringClass}
          ring-${ringWidth}
          rounded-lg
          shadow-[0_0_40px_rgba(52,211,153,0.8)]
          pointer-events-none
          animate-pulse-subtle
        `}
        style={{
          top: rect.innerTop,
          left: rect.innerLeft,
          width: rect.innerWidth,
          height: rect.innerHeight,
        }}
      />

      {/* Custom animation pulse subtle */}
      <style jsx global>{`
        @keyframes pulse-subtle {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.02);
          }
        }

        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );

  // Portal pour éviter problèmes z-index
  return typeof window !== 'undefined'
    ? createPortal(highlightContent, document.body)
    : null;
}
