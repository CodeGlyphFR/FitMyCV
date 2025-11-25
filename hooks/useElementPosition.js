import { useState, useEffect } from 'react';

/**
 * Hook to track an element's position efficiently
 * Uses event-driven approach with ResizeObserver and RAF throttling
 * Provides synchronized position updates for all components that need it
 *
 * @param {string} targetSelector - CSS selector for the target element
 * @param {boolean} enabled - Whether position tracking is enabled
 * @returns {Object|null} - Plain object with rect properties, or null if not available
 */
export function useElementPosition(targetSelector, enabled = true) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!targetSelector || !enabled) {
      setRect(null);
      return;
    }

    let rafId = null;
    let element = null;

    // Try to find element
    try {
      element = document.querySelector(targetSelector);
    } catch (error) {
      console.error(`[useElementPosition] Invalid selector: "${targetSelector}"`, error);
      setRect(null);
      return;
    }

    if (!element) {
      setRect(null);
      return;
    }

    // Throttled update using RAF (prevents multiple updates in same frame)
    const throttledUpdate = () => {
      if (rafId !== null) return; // Already scheduled

      rafId = requestAnimationFrame(() => {
        if (!element) {
          setRect(null);
          rafId = null;
          return;
        }

        const domRect = element.getBoundingClientRect();

        // Convert DOMRect to plain object (DOMRect objects have different identity each time)
        const newRect = {
          top: domRect.top,
          left: domRect.left,
          right: domRect.right,
          bottom: domRect.bottom,
          width: domRect.width,
          height: domRect.height,
          x: domRect.x,
          y: domRect.y,
        };

        // Only update if position changed (prevent unnecessary re-renders)
        setRect((prevRect) => {
          if (!prevRect) return newRect;

          // Compare with 1px tolerance (sub-pixel rendering)
          const changed =
            Math.abs(prevRect.top - newRect.top) >= 1 ||
            Math.abs(prevRect.left - newRect.left) >= 1 ||
            Math.abs(prevRect.width - newRect.width) >= 1 ||
            Math.abs(prevRect.height - newRect.height) >= 1;

          return changed ? newRect : prevRect;
        });

        rafId = null;
      });
    };

    // Initial update
    throttledUpdate();

    // Listen to events that cause position changes (event-driven, not continuous RAF)
    window.addEventListener('scroll', throttledUpdate, { passive: true, capture: true });
    window.addEventListener('resize', throttledUpdate, { passive: true });

    // Use ResizeObserver for element size changes (more efficient than RAF polling)
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(throttledUpdate);
      resizeObserver.observe(element);
    }

    // Use MutationObserver for DOM changes that might affect position
    let mutationObserver = null;
    if (typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver(throttledUpdate);
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
    }

    // Cleanup
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', throttledUpdate, { capture: true });
      window.removeEventListener('resize', throttledUpdate);

      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      if (mutationObserver) {
        mutationObserver.disconnect();
      }
    };
  }, [targetSelector, enabled]);

  return rect;
}
