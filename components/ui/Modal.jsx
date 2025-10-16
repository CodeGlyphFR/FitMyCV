"use client";
import React from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function Modal({ open, onClose, title, children, size = "default" }){
  const { t } = useLanguage();
  const [mounted, setMounted] = React.useState(false);
  const scrollYRef = React.useRef(0);

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

  if(!open || !mounted) return null;
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
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-md bg-black/40"
        onClick={onClose}
        onTouchEnd={(e) => {
          e.preventDefault();
          onClose();
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
          className={`relative z-10 w-full ${maxWidthClass} rounded-2xl border-2 border-white/30 bg-white/15 backdrop-blur-xl shadow-2xl`}
          onClick={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          style={{
            pointerEvents: 'auto',
            maxHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            touchAction: 'auto'
          }}
        >
          <div className="flex items-center justify-between p-4 pb-2 flex-shrink-0">
            <div className="font-semibold text-emerald-300 drop-shadow-lg">{title || t("common.confirmation")}</div>
          </div>
          <div
            className="text-white/90 overflow-y-auto overflow-x-hidden flex-1 px-4 pb-4"
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
