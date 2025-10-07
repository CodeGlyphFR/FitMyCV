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
    <div className="fixed inset-0 z-[10002] overflow-y-auto" style={{ touchAction: 'none' }}>
      <div
        className="fixed inset-0 bg-black/30"
        onClick={onClose}
        onTouchEnd={(e) => {
          // Prevent both touchend and click from firing
          e.preventDefault();
          onClose();
        }}
      ></div>
      <div className="relative min-h-full flex items-start sm:items-center justify-center p-4">
        <div
          className={`relative z-10 w-full ${maxWidthClass} rounded-2xl border bg-white p-4 shadow-lg`}
          onClick={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          style={{ touchAction: 'auto' }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">{title || t("common.confirmation")}</div>
          </div>
          <div>{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}
