import { useState, useEffect } from 'react';
import { ONBOARDING_TIMINGS } from '@/lib/onboarding/onboardingConfig';
import { onboardingLogger } from '@/lib/utils/onboardingLogger';

/**
 * Hook to track an element's position efficiently
 * Uses event-driven approach with ResizeObserver and RAF throttling
 * Provides synchronized position updates for all components that need it
 *
 * RETRY BEHAVIOR:
 * - If element doesn't exist at mount, retries every 100ms for up to 5 seconds
 * - Returns null if element not found after max retries
 * - Use case: Handle race conditions where target element renders after tooltip/highlight
 *
 * @param {string} targetSelector - CSS selector for the target element
 * @param {boolean} enabled - Whether position tracking is enabled
 * @returns {Object|null} - Plain object with rect properties, or null if not available
 *
 * @example
 * // Tooltip for element that appears after async operation
 * const rect = useElementPosition('.dynamic-button', true);
 * if (!rect) return <LoadingSpinner />; // Element not ready yet
 * return <Tooltip position={rect} />;
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
    let elementFound = false; // Prevent double setup if element found during retry

    const MAX_RETRIES = ONBOARDING_TIMINGS.ELEMENT_POSITION_MAX_RETRIES;
    const RETRY_INTERVAL = ONBOARDING_TIMINGS.ELEMENT_POSITION_RETRY_INTERVAL;

    // Throttled update using RAF (prevents multiple updates in same frame)
    const throttledUpdate = () => {
      if (rafId !== null || isCleanedUp) return; // Already scheduled or cleaned up

      rafId = requestAnimationFrame(() => {
        if (!element || isCleanedUp) {
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

    // Setup position tracking for the found element
    const setupTracking = () => {
      // Initial update
      throttledUpdate();

      // Listen to events that cause position changes (event-driven, not continuous RAF)
      window.addEventListener('scroll', throttledUpdate, { passive: true, capture: true });
      window.addEventListener('resize', throttledUpdate, { passive: true });

      // Use ResizeObserver for element size changes (more efficient than RAF polling)
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(throttledUpdate);
        resizeObserver.observe(element);
      }

      // Use MutationObserver for DOM changes that might affect position
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
      if (isCleanedUp || elementFound) return; // Guard against double-execution

      try {
        element = document.querySelector(targetSelector);
      } catch (error) {
        onboardingLogger.error(`[useElementPosition] Invalid selector: "${targetSelector}"`, error);
        setRect(null);
        return;
      }

      if (!element) {
        // Element not found, retry if under max attempts
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          retryTimeout = setTimeout(tryFindElement, RETRY_INTERVAL);
          return;
        } else {
          // Max retries reached, give up
          onboardingLogger.warn(`[useElementPosition] Element not found after ${MAX_RETRIES} attempts: "${targetSelector}"`);
          setRect(null);
          return;
        }
      }

      // Element found! Mark as found to prevent double execution
      elementFound = true;

      // Cancel any pending retry (safety measure)
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }

      // Setup tracking
      setupTracking();
    };

    // Initial attempt to find element
    tryFindElement();

    // Cleanup
    return () => {
      isCleanedUp = true;

      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }

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
