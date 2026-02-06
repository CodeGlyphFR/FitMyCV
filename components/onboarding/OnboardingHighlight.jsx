'use client';

import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useElementPosition } from '@/hooks/useElementPosition';

/**
 * Composant Highlight pour créer un spotlight sur un ou plusieurs éléments
 *
 * Crée un overlay sombre avec blur et des fenêtres circulaires douces autour des éléments cibles.
 * Utilise mask-image avec des radial-gradient pour un fondu progressif (pas de bords carrés).
 *
 * Props:
 * - targetSelector: string - Sélecteur CSS de l'élément principal à highlighter
 * - show: boolean - Afficher ou masquer le highlight
 * - blurEnabled: boolean - Si true, affiche le backdrop blur - default: true
 * - padding: number - Padding autour de l'élément (respiration) - default: 12
 * - borderRadius: number - Border radius des anneaux en pixels - default: 12
 * - backdropOpacity: number - Opacité du backdrop (0-100) - default: 50
 * - blurAmount: string - Niveau de blur CSS - default: '6px'
 * - additionalCutoutSelector: string - Sélecteur CSS pour des éléments supplémentaires à rendre visibles
 */
export default function OnboardingHighlight({
  targetSelector,
  show = false,
  blurEnabled = true,
  padding = 12,
  borderRadius = 12,
  backdropOpacity = 50,
  blurAmount = '6px',
  additionalCutoutSelector,
}) {
  const bounds = useElementPosition(targetSelector, show);

  // Track additional element positions for soft mask windows
  const [additionalRects, setAdditionalRects] = useState([]);

  useEffect(() => {
    if (!additionalCutoutSelector || !show || !blurEnabled) {
      setAdditionalRects([]);
      return;
    }

    let rafId = null;
    let isCleanedUp = false;

    const readAndUpdate = () => {
      if (isCleanedUp) return;

      const elements = document.querySelectorAll(additionalCutoutSelector);
      const newRects = [];

      elements.forEach(el => {
        if (targetSelector && el.matches(targetSelector)) return;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          newRects.push({ top: r.top, left: r.left, width: r.width, height: r.height });
        }
      });

      setAdditionalRects(prev => {
        if (prev.length !== newRects.length) return newRects;
        const changed = newRects.some((r, i) =>
          Math.abs(prev[i].top - r.top) >= 1 ||
          Math.abs(prev[i].left - r.left) >= 1 ||
          Math.abs(prev[i].width - r.width) >= 1 ||
          Math.abs(prev[i].height - r.height) >= 1
        );
        return changed ? newRects : prev;
      });
    };

    const scrollUpdate = () => {
      if (isCleanedUp) return;
      readAndUpdate();
    };

    const throttledUpdate = () => {
      if (rafId !== null || isCleanedUp) return;
      rafId = requestAnimationFrame(() => {
        readAndUpdate();
        rafId = null;
      });
    };

    readAndUpdate();

    window.addEventListener('scroll', scrollUpdate, { passive: true, capture: true });
    window.addEventListener('resize', throttledUpdate, { passive: true });

    const mutationObserver = new MutationObserver(throttledUpdate);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    return () => {
      isCleanedUp = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', scrollUpdate, { capture: true });
      window.removeEventListener('resize', throttledUpdate);
      mutationObserver.disconnect();
    };
  }, [additionalCutoutSelector, targetSelector, show, blurEnabled]);

  const rect = useMemo(() => {
    if (!bounds) return null;

    return {
      top: bounds.top - padding,
      left: bounds.left - padding,
      width: bounds.width + padding * 2,
      height: bounds.height + padding * 2,
      innerTop: bounds.top,
      innerLeft: bounds.left,
      innerWidth: bounds.width,
      innerHeight: bounds.height,
    };
  }, [bounds, padding]);

  if (!show || !rect) return null;

  // Construire les positions de tous les boutons (primaire + secondaires)
  const allPositions = [];

  // Bouton principal
  allPositions.push({
    cx: rect.innerLeft + rect.innerWidth / 2,
    cy: rect.innerTop + rect.innerHeight / 2,
    radius: Math.max(rect.innerWidth, rect.innerHeight) / 2,
  });

  // Boutons secondaires
  additionalRects.forEach(r => {
    allPositions.push({
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
      radius: Math.max(r.width, r.height) / 2,
    });
  });

  // Construire le mask-image avec des radial-gradient pour des fenêtres circulaires douces
  // Chaque gradient : transparent au centre (bouton visible) → noir à l'extérieur (blur visible)
  // mask-composite: intersect → le blur est visible partout SAUF aux cercles
  const fadeSize = 10;
  const gradients = allPositions.map(({ cx, cy, radius }) => {
    const innerR = radius + 6;
    const outerR = innerR + fadeSize;
    return `radial-gradient(circle ${outerR}px at ${cx}px ${cy}px, transparent ${innerR}px, black ${outerR}px)`;
  });

  const maskImage = gradients.join(', ');
  // mask-composite s'applique entre chaque paire de couches (N-1 valeurs pour N couches)
  const compositeValues = new Array(Math.max(gradients.length - 1, 0)).fill('intersect').join(', ');
  const webkitCompositeValues = new Array(Math.max(gradients.length - 1, 0)).fill('source-in').join(', ');

  // Style du backdrop avec mask au lieu de clip-path
  const backdropStyle = {
    backgroundColor: `rgba(0, 0, 0, ${backdropOpacity / 100})`,
    backdropFilter: `blur(${blurAmount})`,
    WebkitBackdropFilter: `blur(${blurAmount})`,
    maskImage: maskImage,
    WebkitMaskImage: maskImage,
  };

  // Ajouter mask-composite seulement si plusieurs couches
  if (gradients.length > 1) {
    backdropStyle.maskComposite = compositeValues;
    backdropStyle.WebkitMaskComposite = webkitCompositeValues;
  }

  const highlightContent = (
    <div
      className="fixed inset-0 z-[10001] pointer-events-none"
      role="presentation"
      aria-hidden="true"
    >
      {/* Backdrop avec blur - masqué aux positions des boutons avec un fondu circulaire doux */}
      {blurEnabled && (
        <div
          className="absolute inset-0 pointer-events-auto"
          style={backdropStyle}
        />
      )}

      {/* Ring pulsant vert autour de l'élément principal */}
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

      {/* Glow effect derrière l'élément principal */}
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

  return typeof window !== 'undefined'
    ? createPortal(highlightContent, document.body)
    : null;
}
