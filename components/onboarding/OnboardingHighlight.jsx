'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Composant Highlight pour créer un spotlight sur un élément
 *
 * Crée un overlay sombre avec blur et un découpage (cutout) autour de l'élément cible.
 * L'overlay BLOQUE les clics sauf sur l'élément cible (via clip-path).
 *
 * Props:
 * - targetSelector: string - Sélecteur CSS de l'élément à highlighter
 * - show: boolean - Afficher ou masquer le highlight (ring + optionnellement blur)
 * - blurEnabled: boolean - Si true, affiche le backdrop blur qui bloque les clics - default: true
 * - padding: number - Padding autour de l'élément (respiration) - default: 12
 * - borderRadius: number - Border radius du cutout en pixels - default: 12
 * - backdropOpacity: number - Opacité du backdrop (0-100) - default: 50
 * - blurAmount: string - Niveau de blur CSS - default: '6px'
 */
export default function OnboardingHighlight({
  targetSelector,
  show = false,
  blurEnabled = true,
  padding = 12,
  borderRadius = 12,
  backdropOpacity = 50,
  blurAmount = '6px',
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
      // Position du cutout (avec padding)
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

    // Délai initial pour laisser le DOM se stabiliser
    const initialTimeout = setTimeout(updatePosition, 50);

    const handleUpdate = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    // Update interval (au cas où l'élément bouge dynamiquement)
    const interval = setInterval(handleUpdate, 150);

    return () => {
      clearTimeout(initialTimeout);
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
      clearInterval(interval);
    };
  }, [show, targetSelector, padding]);

  // Ne pas render si pas show ou pas de rect
  if (!show || !rect) return null;

  // Générer le clip-path polygon pour créer le "trou"
  // Le polygon dessine l'extérieur, puis revient pour découper l'intérieur
  const clipPath = `polygon(
    0% 0%,
    0% 100%,
    ${rect.left}px 100%,
    ${rect.left}px ${rect.top}px,
    ${rect.left + rect.width}px ${rect.top}px,
    ${rect.left + rect.width}px ${rect.top + rect.height}px,
    ${rect.left}px ${rect.top + rect.height}px,
    ${rect.left}px 100%,
    100% 100%,
    100% 0%
  )`;

  const highlightContent = (
    <div
      className="fixed inset-0 z-[10001] pointer-events-none"
      role="presentation"
      aria-hidden="true"
    >
      {/* Backdrop avec blur - BLOQUE les clics via clip-path (seulement si blurEnabled) */}
      {blurEnabled && (
        <div
          className="absolute inset-0 pointer-events-auto transition-opacity duration-300"
          style={{
            backgroundColor: `rgba(0, 0, 0, ${backdropOpacity / 100})`,
            backdropFilter: `blur(${blurAmount})`,
            WebkitBackdropFilter: `blur(${blurAmount})`,
            clipPath: clipPath,
          }}
        />
      )}

      {/* Ring pulsant vert autour de l'élément - pointer-events-none (toujours visible) */}
      <div
        className="absolute pointer-events-none animate-pulse-ring-onboarding"
        style={{
          top: rect.innerTop - 4,
          left: rect.innerLeft - 4,
          width: rect.innerWidth + 8,
          height: rect.innerHeight + 8,
          borderRadius: borderRadius,
        }}
      />

      {/* Glow effect derrière l'élément - pointer-events-none */}
      <div
        className="absolute pointer-events-none animate-glow-pulse-onboarding"
        style={{
          top: rect.innerTop - 6,
          left: rect.innerLeft - 6,
          width: rect.innerWidth + 12,
          height: rect.innerHeight + 12,
          borderRadius: borderRadius + 2,
          boxShadow: '0 0 40px 15px rgba(16, 185, 129, 0.5)',
        }}
      />

      {/* Styles d'animation */}
      <style jsx global>{`
        @keyframes pulse-ring-onboarding {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.8),
                        inset 0 0 0 3px rgba(16, 185, 129, 1);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(16, 185, 129, 0),
                        inset 0 0 0 3px rgba(52, 211, 153, 1);
          }
        }

        @keyframes glow-pulse-onboarding {
          0%, 100% {
            opacity: 0.7;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.03);
          }
        }

        .animate-pulse-ring-onboarding {
          animation: pulse-ring-onboarding 1.8s ease-in-out infinite;
        }

        .animate-glow-pulse-onboarding {
          animation: glow-pulse-onboarding 1.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );

  // Portal pour éviter problèmes z-index
  return typeof window !== 'undefined'
    ? createPortal(highlightContent, document.body)
    : null;
}
