'use client';

import { useEffect, useRef } from 'react';

/**
 * Generic hook for handling outside click detection with touch support.
 * Handles mousedown, touchstart, and Escape key events.
 *
 * @param {Object} options
 * @param {boolean} options.isOpen - Whether the dropdown/menu is open
 * @param {Function} options.onClose - Callback to close the dropdown/menu
 * @param {React.RefObject[]} [options.refs] - Array of refs to exclude from outside click
 * @param {string} [options.dataAttribute] - Data attribute selector to exclude (e.g., 'link-history-dropdown')
 * @param {Function} [options.shouldSkip] - Optional function that returns true to skip the click handling
 * @returns {void}
 */
export function useOutsideClick({
  isOpen,
  onClose,
  refs = [],
  dataAttribute = null,
  shouldSkip = null,
}) {
  // Keep track of touch to prevent double-firing on mobile
  const touchHandledRef = useRef(false);
  const touchTimeoutRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleClick(event) {
      // Handle touch/mouse coordination to prevent double-firing
      if (event.type === 'touchstart') {
        touchHandledRef.current = true;
        if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current);
        touchTimeoutRef.current = setTimeout(() => {
          touchHandledRef.current = false;
        }, 500);
      } else if (event.type === 'mousedown' && touchHandledRef.current) {
        return;
      }

      // Check if should skip
      if (shouldSkip && shouldSkip()) {
        return;
      }

      // Check if click is inside any of the provided refs
      for (const ref of refs) {
        const el = ref?.current;
        if (el && el.contains(event.target)) {
          return;
        }
      }

      // Check if click is inside a data-attribute selector
      if (dataAttribute && event.target.closest(`[data-${dataAttribute}="true"]`)) {
        return;
      }

      onClose();
    }

    function handleKey(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick, { passive: true });
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
      document.removeEventListener('keydown', handleKey);
      if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current);
    };
  }, [isOpen, onClose, refs, dataAttribute, shouldSkip]);
}
