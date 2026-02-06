import { useState, useEffect } from 'react';
import { ONBOARDING_TIMINGS } from '@/lib/onboarding/onboardingConfig';
import { onboardingLogger } from '@/lib/utils/onboardingLogger';

/**
 * Hook to track an element's position efficiently
 * Uses event-driven approach with ResizeObserver and RAF throttling
 * Provides synchronized position updates for all components that need it
 *
 * SCROLL BEHAVIOR:
 * - Scroll events update positions synchronously (no RAF delay) for instant tracking
 * - Resize, ResizeObserver and MutationObserver use RAF throttling (less critical)
 *
 * RETRY BEHAVIOR:
 * - If element doesn't exist at mount, retries every 100ms for up to 5 seconds
 * - Returns null if element not found after max retries
 * - Use case: Handle race conditions where target element renders after tooltip/highlight
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
    let retryTimeout = null;
    let retryCount = 0;
    let resizeObserver = null;
    let mutationObserver = null;
    let isCleanedUp = false;
    let elementFound = false;

    const MAX_RETRIES = ONBOARDING_TIMINGS.ELEMENT_POSITION_MAX_RETRIES;
    const RETRY_INTERVAL = ONBOARDING_TIMINGS.ELEMENT_POSITION_RETRY_INTERVAL;

    // Core position read + state update (shared by all update paths)
    const readAndUpdate = () => {
      if (!element || isCleanedUp) {
        setRect(null);
        return;
      }

      const domRect = element.getBoundingClientRect();

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

      setRect((prevRect) => {
        if (!prevRect) return newRect;

        const changed =
          Math.abs(prevRect.top - newRect.top) >= 1 ||
          Math.abs(prevRect.left - newRect.left) >= 1 ||
          Math.abs(prevRect.width - newRect.width) >= 1 ||
          Math.abs(prevRect.height - newRect.height) >= 1;

        return changed ? newRect : prevRect;
      });
    };

    // Synchronous update for scroll (no RAF delay = instant tracking)
    const scrollUpdate = () => {
      if (isCleanedUp) return;
      readAndUpdate();
    };

    // RAF-throttled update for resize/mutation (less frequent, OK to defer)
    const throttledUpdate = () => {
      if (rafId !== null || isCleanedUp) return;

      rafId = requestAnimationFrame(() => {
        readAndUpdate();
        rafId = null;
      });
    };

    // Setup position tracking for the found element
    const setupTracking = () => {
      // Initial update
      readAndUpdate();

      // Scroll: synchronous for instant tracking
      window.addEventListener('scroll', scrollUpdate, { passive: true, capture: true });
      // Resize: RAF-throttled (less critical)
      window.addEventListener('resize', throttledUpdate, { passive: true });

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(throttledUpdate);
        resizeObserver.observe(element);
      }

      if (typeof MutationObserver !== 'undefined') {
        mutationObserver = new MutationObserver(throttledUpdate);
        mutationObserver.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class'],
        });
      }
    };

    // Try to find element with retry mechanism
    const tryFindElement = () => {
      if (isCleanedUp || elementFound) return;

      try {
        element = document.querySelector(targetSelector);
      } catch (error) {
        onboardingLogger.error(`[useElementPosition] Invalid selector: "${targetSelector}"`, error);
        setRect(null);
        return;
      }

      if (!element) {
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          retryTimeout = setTimeout(tryFindElement, RETRY_INTERVAL);
          return;
        } else {
          onboardingLogger.warn(`[useElementPosition] Element not found after ${MAX_RETRIES} attempts: "${targetSelector}"`);
          setRect(null);
          return;
        }
      }

      elementFound = true;

      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }

      setupTracking();
    };

    tryFindElement();

    return () => {
      isCleanedUp = true;

      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      window.removeEventListener('scroll', scrollUpdate, { capture: true });
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
