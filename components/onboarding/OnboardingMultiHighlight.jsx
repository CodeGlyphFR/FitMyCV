'use client';

import { Fragment, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Composant MultiHighlight pour afficher des anneaux pulsants sur PLUSIEURS éléments
 *
 * Utilisé pour highlighter tous les boutons kebab du CV pendant l'onboarding step 1.
 * Rend uniquement les anneaux (ring + glow), sans backdrop blur.
 * Les animations CSS sont fournies par OnboardingHighlight (rendu en parallèle).
 *
 * @param {string} selector - Sélecteur CSS pour trouver tous les éléments à highlighter
 * @param {string} excludeSelector - Sélecteur CSS des éléments à exclure (évite le double ring)
 * @param {boolean} show - Afficher ou masquer les highlights
 * @param {number} borderRadius - Border radius des anneaux - default: 12
 */
export default function OnboardingMultiHighlight({
  selector,
  excludeSelector,
  show = false,
  borderRadius = 12,
}) {
  const [rects, setRects] = useState([]);

  useEffect(() => {
    if (!selector || !show) {
      setRects([]);
      return;
    }

    let rafId = null;
    let isCleanedUp = false;

    // Core read + update (shared by scroll and throttled paths)
    const readAndUpdate = () => {
      if (isCleanedUp) return;

      const elements = document.querySelectorAll(selector);
      const newRects = [];

      elements.forEach(el => {
        if (excludeSelector && el.matches(excludeSelector)) return;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          newRects.push({ top: r.top, left: r.left, width: r.width, height: r.height });
        }
      });

      setRects(prev => {
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

    // Synchronous for scroll (instant tracking)
    const scrollUpdate = () => {
      if (isCleanedUp) return;
      readAndUpdate();
    };

    // RAF-throttled for resize/mutation
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
  }, [selector, excludeSelector, show]);

  if (!show || rects.length === 0) return null;

  const content = (
    <div className="fixed inset-0 z-[10001] pointer-events-none" role="presentation" aria-hidden="true">
      {rects.map((rect, i) => (
        <Fragment key={i}>
          {/* Ring pulsant vert */}
          <div
            className="absolute pointer-events-none animate-pulse-ring-onboarding"
            style={{
              top: rect.top - 4,
              left: rect.left - 4,
              width: rect.width + 8,
              height: rect.height + 8,
              borderRadius,
            }}
          />
          {/* Glow effect */}
          <div
            className="absolute pointer-events-none animate-glow-pulse-onboarding"
            style={{
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 12,
              borderRadius: borderRadius + 2,
              boxShadow: '0 0 40px 15px rgba(16, 185, 129, 0.5)',
            }}
          />
        </Fragment>
      ))}
    </div>
  );

  return typeof window !== 'undefined'
    ? createPortal(content, document.body)
    : null;
}
