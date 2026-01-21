import { useEffect, useRef } from 'react';

/**
 * Hook pour gérer l'accessibilité du modal (scroll, focus trap, Escape)
 * @param {boolean} isOpen - Si le modal est ouvert
 * @param {boolean} mounted - Si le composant est monté
 * @param {Function} onClose - Callback pour fermer le modal
 */
export function useModalAccessibility(isOpen, mounted, onClose) {
  const modalRef = useRef(null);
  const scrollYRef = useRef(0);
  const previousFocusRef = useRef(null);

  // Gestion du scroll body quand le modal est ouvert
  useEffect(() => {
    if (!isOpen || !mounted) return;

    scrollYRef.current = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollYRef.current}px`;
    document.body.style.width = '100%';
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.touchAction = 'none';

    return () => {
      const currentTop = parseInt(document.body.style.top || '0', 10);
      const restoreY = Math.abs(currentTop);

      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.paddingRight = '';
      document.body.style.touchAction = '';

      window.scrollTo(0, restoreY);
    };
  }, [isOpen, mounted]);

  // Focus management - save and restore focus
  useEffect(() => {
    if (!isOpen || !mounted || !modalRef.current) return;

    previousFocusRef.current = document.activeElement;

    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    return () => {
      if (previousFocusRef.current && previousFocusRef.current.focus) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, mounted]);

  // Focus trap - Tab key cycling
  useEffect(() => {
    if (!isOpen || !mounted || !modalRef.current) return;

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;

      const focusableElements = modalRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen, mounted]);

  // Gestion de la touche Escape
  useEffect(() => {
    if (!isOpen || !mounted) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, mounted, onClose]);

  return { modalRef };
}
