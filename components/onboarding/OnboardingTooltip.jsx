'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Tooltip personnalisé pour l'onboarding
 *
 * Affiche un tooltip stylisé (emerald accent) pointant vers un élément cible.
 * Position intelligente pour éviter les chevauchements avec topbar et checklist.
 *
 * Props:
 * - show: boolean - Afficher ou masquer le tooltip
 * - targetSelector: string - Sélecteur CSS de l'élément cible
 * - content: string | ReactNode - Contenu du tooltip
 * - position: string - Position souhaitée ('top' | 'bottom' | 'left' | 'right' | 'auto') - default: 'auto'
 * - onClose: function - Callback quand le tooltip est fermé
 * - closable: boolean - Afficher le bouton de fermeture - default: true
 * - persistent: boolean - Le tooltip reste affiché (pas de timeout auto-close) - default: false
 * - autoCloseDelay: number - Délai avant auto-close en ms (si pas persistent) - default: 0 (pas d'auto-close)
 * - maxWidth: number - Largeur max en pixels - default: 320
 * - minWidth: number - Largeur min en pixels - default: 280
 * - offset: number - Distance entre tooltip et élément en pixels - default: 12
 */
export default function OnboardingTooltip({
  show = false,
  targetSelector,
  content,
  position = 'auto',
  onClose,
  closable = true,
  persistent = false,
  autoCloseDelay = 0,
  maxWidth = 320,
  minWidth = 280,
  offset = 12,
}) {
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const [calculatedPosition, setCalculatedPosition] = useState(position);
  const [arrowOffset, setArrowOffset] = useState(0); // Décalage de l'arrow après clamping
  const tooltipRef = useRef(null);

  /**
   * Ajuster la position du tooltip pour qu'il reste dans le viewport
   * Prend en compte les transforms CSS pour éviter le débordement
   *
   * Utilise Math.max/Math.min pour un clamping correct au lieu de conditions if/else
   */
  const clampToViewport = (top, left, finalPosition, targetRect) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Utiliser maxWidth comme estimation si tooltip pas encore rendu
    const tooltipWidth = tooltipRef.current?.offsetWidth || maxWidth;
    const tooltipHeight = tooltipRef.current?.offsetHeight || 150;

    const margin = 10; // Marge minimale des bords du viewport

    let adjustedTop = top;
    let adjustedLeft = left;

    // Ajuster selon la position et les transforms CSS appliqués
    switch (finalPosition) {
      case 'top':
      case 'bottom':
        // Transform: -translate-x-1/2 centre le tooltip horizontalement
        // Donc le bord gauche réel = left - (tooltipWidth / 2)
        // On doit s'assurer que: margin <= (left - tooltipWidth/2) <= viewportWidth - tooltipWidth - margin

        const minLeft = margin + (tooltipWidth / 2);
        const maxLeft = viewportWidth - margin - (tooltipWidth / 2);
        adjustedLeft = Math.max(minLeft, Math.min(maxLeft, left));

        // Clamp vertical
        if (finalPosition === 'top') {
          // Transform: -translate-y-full
          const tooltipTop = top - tooltipHeight;
          if (tooltipTop < margin) {
            adjustedTop = tooltipHeight + margin;
          }
        } else {
          // Position bottom
          const tooltipBottom = top + tooltipHeight;
          if (tooltipBottom > viewportHeight - margin) {
            adjustedTop = viewportHeight - tooltipHeight - margin;
          }
        }
        break;

      case 'left':
        // Transform: -translate-x-full -translate-y-1/2
        const minLeftPos = margin + tooltipWidth;
        adjustedLeft = Math.max(minLeftPos, left);

        const minTopPos = margin + (tooltipHeight / 2);
        const maxTopPos = viewportHeight - margin - (tooltipHeight / 2);
        adjustedTop = Math.max(minTopPos, Math.min(maxTopPos, top));
        break;

      case 'right':
        // Transform: -translate-y-1/2
        const maxRightPos = viewportWidth - margin - tooltipWidth;
        adjustedLeft = Math.min(maxRightPos, left);

        const minTopPosRight = margin + (tooltipHeight / 2);
        const maxTopPosRight = viewportHeight - margin - (tooltipHeight / 2);
        adjustedTop = Math.max(minTopPosRight, Math.min(maxTopPosRight, top));
        break;
    }

    return { top: adjustedTop, left: adjustedLeft };
  };

  /**
   * Calculer position intelligente du tooltip
   */
  const calculatePosition = () => {
    if (!targetSelector || !show) {
      setTooltipPosition(null);
      return;
    }

    const targetElement = document.querySelector(targetSelector);
    if (!targetElement) {
      console.warn(`[OnboardingTooltip] Element not found: ${targetSelector}`);
      setTooltipPosition(null);
      return;
    }

    const targetRect = targetElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Zones à éviter (topbar + checklist)
    const topbarHeight = 80; // Hauteur approximative topbar
    const checklistWidth = 320; // Largeur checklist (si visible)

    let finalPosition = position;

    // Position auto-intelligente
    if (position === 'auto') {
      // Préférer bottom si espace suffisant
      if (targetRect.bottom + offset + 100 < viewportHeight) {
        finalPosition = 'bottom';
      }
      // Sinon top
      else if (targetRect.top - offset - 100 > topbarHeight) {
        finalPosition = 'top';
      }
      // Sinon right (si pas de checklist)
      else if (targetRect.right + offset + maxWidth < viewportWidth) {
        finalPosition = 'right';
      }
      // Sinon left
      else {
        finalPosition = 'left';
      }
    }

    setCalculatedPosition(finalPosition);

    // Calculer coordonnées selon position
    let top, left;

    switch (finalPosition) {
      case 'top':
        top = targetRect.top - offset;
        left = targetRect.left + targetRect.width / 2;
        break;

      case 'bottom':
        top = targetRect.bottom + offset;
        left = targetRect.left + targetRect.width / 2;
        break;

      case 'left':
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.left - offset;
        break;

      case 'right':
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.right + offset;
        break;

      default:
        top = targetRect.bottom + offset;
        left = targetRect.left + targetRect.width / 2;
    }

    // Appliquer le clamping pour éviter le débordement du viewport
    const clampedPosition = clampToViewport(top, left, finalPosition, targetRect);

    // Calculer le décalage de l'arrow pour qu'elle pointe toujours vers l'élément cible
    // Pour top/bottom: décalage horizontal, pour left/right: décalage vertical
    let arrowOffsetValue = 0;
    if (finalPosition === 'top' || finalPosition === 'bottom') {
      arrowOffsetValue = left - clampedPosition.left;
    } else if (finalPosition === 'left' || finalPosition === 'right') {
      arrowOffsetValue = top - clampedPosition.top;
    }
    setArrowOffset(arrowOffsetValue);

    setTooltipPosition(clampedPosition);
  };

  /**
   * Mise à jour position
   */
  useEffect(() => {
    if (!show) {
      setTooltipPosition(null);
      return;
    }

    calculatePosition();

    const handleUpdate = () => calculatePosition();

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    const interval = setInterval(handleUpdate, 200);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
      clearInterval(interval);
    };
  }, [show, targetSelector, position]); // offset retiré pour éviter boucle infinie (objet recréé à chaque render)

  /**
   * Auto-close après délai
   */
  useEffect(() => {
    if (!show || persistent || !autoCloseDelay || !onClose) return;

    const timer = setTimeout(() => {
      onClose();
    }, autoCloseDelay);

    return () => clearTimeout(timer);
  }, [show, persistent, autoCloseDelay, onClose]);

  /**
   * Fermer le tooltip au clic sur l'élément cible
   * L'action native du bouton est préservée (pas de preventDefault)
   */
  useEffect(() => {
    if (!show || !targetSelector || !onClose) return;

    const targetElement = document.querySelector(targetSelector);
    if (!targetElement) return;

    const handleTargetClick = () => {
      // Fermer le tooltip sans bloquer l'action native
      onClose();
    };

    targetElement.addEventListener('click', handleTargetClick);

    return () => {
      targetElement.removeEventListener('click', handleTargetClick);
    };
  }, [show, targetSelector, onClose]);

  // Handler close
  const handleClose = () => {
    if (onClose) onClose();
  };

  // Ne pas render si pas show ou pas de position
  if (!show || !tooltipPosition) return null;

  // Classes de transformation selon position
  const transformClasses = {
    top: '-translate-x-1/2 -translate-y-full',
    bottom: '-translate-x-1/2',
    left: '-translate-y-1/2 -translate-x-full',
    right: '-translate-y-1/2',
  };

  // Position de la flèche (sans le positionnement horizontal/vertical qui sera calculé dynamiquement)
  const arrowPositionClasses = {
    top: 'bottom-[-8px] rotate-180',
    bottom: 'top-[-8px]',
    left: 'right-[-8px] rotate-90',
    right: 'left-[-8px] -rotate-90',
  };

  // Calcul du style de positionnement de l'arrow avec le décalage
  const getArrowStyle = () => {
    const baseStyle = {
      clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
    };

    // Clamper l'arrowOffset pour qu'il reste dans les limites du tooltip
    // Utiliser les dimensions réelles ou les valeurs par défaut
    const tooltipWidth = tooltipRef.current?.offsetWidth || minWidth;
    const tooltipHeight = tooltipRef.current?.offsetHeight || 100;
    const margin = 20; // Marge de sécurité pour garder l'arrow visible

    if (calculatedPosition === 'top' || calculatedPosition === 'bottom') {
      // Clamper horizontalement
      const maxOffset = (tooltipWidth / 2) - margin;
      const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, arrowOffset));
      return {
        ...baseStyle,
        left: `calc(50% + ${clampedOffset}px)`,
        transform: 'translateX(-50%)',
      };
    } else {
      // left/right: clamper verticalement
      const maxOffset = (tooltipHeight / 2) - margin;
      const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, arrowOffset));
      return {
        ...baseStyle,
        top: `calc(50% + ${clampedOffset}px)`,
        transform: 'translateY(-50%)',
      };
    }
  };

  const tooltipContent = (
    <div
      ref={tooltipRef}
      className={`
        fixed z-[10005]
        ${transformClasses[calculatedPosition] || transformClasses.bottom}
        animate-tooltip-fade-in
      `}
      style={{
        top: tooltipPosition.top,
        left: tooltipPosition.left,
        maxWidth,
        minWidth,
      }}
      role="tooltip"
      aria-hidden={!show}
    >
      {/* Flèche */}
      <div
        className={`
          absolute w-4 h-4
          bg-emerald-500
          ${arrowPositionClasses[calculatedPosition] || arrowPositionClasses.bottom}
        `}
        style={getArrowStyle()}
      />

      {/* Contenu */}
      <div
        className="
          bg-emerald-500
          text-white
          rounded-xl
          px-4 py-3
          shadow-2xl
          border-2 border-emerald-400
        "
      >
        <div className="flex items-start justify-between gap-3">
          {/* Texte */}
          <div className="text-sm leading-relaxed">
            {content}
          </div>

          {/* Bouton fermeture */}
          {closable && onClose && (
            <button
              onClick={handleClose}
              className="
                flex-shrink-0
                p-1 -mt-1 -mr-1
                text-white/70 hover:text-white
                hover:bg-white/10
                rounded
                transition-colors
              "
              aria-label="Fermer le tooltip"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Animation fade-in */}
      <style jsx>{`
        @keyframes tooltip-fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px) translateX(-50%);
          }
          to {
            opacity: 1;
            transform: translateY(0) translateX(-50%);
          }
        }

        .animate-tooltip-fade-in {
          animation: tooltip-fade-in 300ms ease-out;
        }
      `}</style>
    </div>
  );

  // Portal
  return typeof window !== 'undefined'
    ? createPortal(tooltipContent, document.body)
    : null;
}
