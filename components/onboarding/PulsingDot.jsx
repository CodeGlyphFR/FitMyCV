'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Point rouge pulsant pour indiquer un élément interactif
 *
 * Affiche un petit cercle rouge semi-transparent avec animation breathing
 * dans le coin supérieur droit de l'élément cible.
 *
 * Props:
 * - show: boolean - Afficher ou masquer le dot
 * - targetSelector: string - Sélecteur CSS de l'élément cible
 * - size: number - Taille du dot en pixels - default: 12
 * - color: string - Couleur du dot (RGB ou Tailwind) - default: 'rgb(239, 68, 68)' (red-500)
 * - offset: object - Offset { top, right, bottom, left } - default: { top: -6, right: -6 }
 * - animationDuration: number - Durée de l'animation en secondes - default: 1.5
 */
export default function PulsingDot({
  show = false,
  targetSelector,
  size = 12,
  color = 'rgb(239, 68, 68)', // red-500
  offset = { top: -6, right: -6 },
  animationDuration = 1.5,
}) {
  const [position, setPosition] = useState(null);

  /**
   * Calculer et mettre à jour la position du dot
   */
  const updatePosition = () => {
    if (!targetSelector || !show) {
      setPosition(null);
      return;
    }

    const element = document.querySelector(targetSelector);
    if (!element) {
      console.warn(`[PulsingDot] Element not found: ${targetSelector}`);
      setPosition(null);
      return;
    }

    const bounds = element.getBoundingClientRect();

    // Position dans le coin supérieur droit
    setPosition({
      top: bounds.top + (offset.top || 0),
      left: bounds.right + (offset.right || 0),
    });
  };

  /**
   * Mise à jour position sur scroll, resize, et changement show/targetSelector
   */
  useEffect(() => {
    if (!show) {
      setPosition(null);
      return;
    }

    updatePosition();

    // Listener resize et scroll
    const handleUpdate = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true); // Capture phase

    // Update interval (au cas où l'élément bouge)
    const interval = setInterval(handleUpdate, 200);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
      clearInterval(interval);
    };
  }, [show, targetSelector]); // offset retiré pour éviter boucle infinie (objet recréé à chaque render)

  // Ne pas render si pas show ou pas de position
  if (!show || !position) return null;

  const dotContent = (
    <div
      className="fixed z-[10006] pointer-events-none"
      style={{
        top: position.top,
        left: position.left,
        width: size,
        height: size,
      }}
      role="status"
      aria-live="polite"
      aria-label="Indicateur d'étape active"
    >
      {/* Cercle pulsant */}
      <div
        className="pulsing-dot-breathe"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: '50%',
          boxShadow: `0 0 ${size}px ${color}`,
        }}
      />

      {/* Animation breathing */}
      <style jsx>{`
        @keyframes breathe {
          0%, 100% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.3);
            opacity: 1;
          }
        }

        .pulsing-dot-breathe {
          animation: breathe ${animationDuration}s ease-in-out infinite;
        }
      `}</style>
    </div>
  );

  // Portal pour éviter problèmes z-index
  return typeof window !== 'undefined'
    ? createPortal(dotContent, document.body)
    : null;
}
