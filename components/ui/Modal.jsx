"use client";
import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = "default",
  icon: IconComponent = null, // Icône Lucide optionnelle
  iconBg = "bg-emerald-500/20", // Couleur de fond de l'icône
  iconColor = "text-emerald-400", // Couleur de l'icône
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

      // Focus sur le conteneur du modal (aucun bouton pré-sélectionné)
      modalRef.current.focus();

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
        'button:not([disabled]):not([tabindex="-1"]), [href]:not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
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
      {/* Backdrop - solid dark overlay */}
      <div
        className="absolute inset-0 bg-black/70"
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
          className={`relative z-10 w-full ${maxWidthClass} rounded-xl border border-white/20 bg-[rgb(2,6,23)] shadow-2xl overflow-hidden outline-hidden`}
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
          {/* Header */}
          <div className="flex-shrink-0">
            <div className="flex items-center justify-between p-4 md:p-6">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Icône optionnelle */}
                {IconComponent && (
                  <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>
                    <IconComponent className={`w-5 h-5 ${iconColor}`} />
                  </div>
                )}
                <h2
                  id="modal-title"
                  className="text-lg font-bold text-emerald-400 truncate"
                >
                  {title || t("common.confirmation")}
                </h2>
              </div>
              {/* Bouton fermer */}
              <button
                onClick={onClose}
                tabIndex={-1}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors flex-shrink-0"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Divider */}
            <div className="border-b border-white/10" />
          </div>

          {/* Content */}
          <div
            className="text-white/90 overflow-y-auto overflow-x-hidden flex-1 p-4 md:p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
