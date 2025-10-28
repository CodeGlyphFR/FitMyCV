"use client";
import React from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = "default",
  disableEscapeKey = false, // Permet de bloquer Escape pendant traitement
  disableBackdropClick = false // Permet de bloquer clic backdrop pendant traitement
}){
  const { t } = useLanguage();
  const [mounted, setMounted] = React.useState(false);
  const scrollYRef = React.useRef(0);
  const modalRef = React.useRef(null);
  const previousFocusRef = React.useRef(null);

  React.useEffect(()=>{ setMounted(true); },[]);

  // Déterminer la largeur maximale selon size
  const maxWidthClass = size === "large" ? "max-w-4xl" : "max-w-lg";

  // Désactiver le scroll quand la modal est ouverte
  React.useEffect(() => {
    if (open && mounted) {
      // Capturer la position de scroll dans une ref
      scrollYRef.current = window.scrollY;

      // Bloquer le scroll avec overflow
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;

      // Calculer la largeur de la scrollbar pour éviter le layout shift
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }

      return () => {
        // Restaurer les styles
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;

        // Restaurer la position de scroll
        window.scrollTo(0, scrollYRef.current);

        // Forcer un reflow pour s'assurer que tout est bien restauré
        requestAnimationFrame(() => {
          document.body.offsetHeight; // Force reflow
        });
      };
    }
  }, [open, mounted]);

  // Gestion du focus initial et restauration
  React.useEffect(() => {
    if (open && mounted && modalRef.current) {
      // Sauvegarder l'élément qui avait le focus
      previousFocusRef.current = document.activeElement;

      // Déplacer le focus vers le premier élément focusable de la modal
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      } else {
        modalRef.current.focus();
      }

      return () => {
        // Restaurer le focus à l'élément précédent
        if (previousFocusRef.current && previousFocusRef.current.focus) {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [open, mounted]);

  // Focus trap
  React.useEffect(() => {
    if (!open || !mounted || !modalRef.current) return;

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;

      const focusableElements = modalRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [open, mounted]);

  // Fermeture avec Escape
  React.useEffect(() => {
    if (!open || !mounted || disableEscapeKey) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, mounted, disableEscapeKey, onClose]);

  if(!open || !mounted) return null;

  const handleBackdropClick = () => {
    if (!disableBackdropClick) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed z-[10002]"
      style={{
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        touchAction: 'none'
      }}
      role="presentation"
    >
      {/* Backdrop - no blur for better iOS performance */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleBackdropClick}
        onTouchEnd={(e) => {
          e.preventDefault();
          handleBackdropClick();
        }}
        aria-hidden="true"
        style={{
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)'
        }}
      ></div>

      {/* Modal container - évite les safe-area */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          top: 'env(safe-area-inset-top)',
          left: 'env(safe-area-inset-left)',
          right: 'env(safe-area-inset-right)',
          bottom: 'env(safe-area-inset-bottom)',
          padding: '1rem',
          pointerEvents: 'none'
        }}
      >
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          tabIndex={-1}
          className={`relative z-10 w-full ${maxWidthClass} rounded-2xl border-2 border-white/30 bg-white/15 backdrop-blur-md ios-blur-medium gpu-accelerate shadow-2xl`}
          onClick={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          style={{
            pointerEvents: 'auto',
            maxHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            touchAction: 'auto',
            willChange: open ? 'transform, opacity' : 'auto'
          }}
        >
          <div className="flex items-center justify-between p-4 pb-2 flex-shrink-0">
            <div
              id="modal-title"
              className="font-semibold text-emerald-300 drop-shadow-lg"
            >
              {title || t("common.confirmation")}
            </div>
          </div>
          <div
            className="text-white/90 overflow-y-auto overflow-x-hidden flex-1 px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain'
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
