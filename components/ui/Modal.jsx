"use client";
import React from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function Modal({ open, onClose, title, children }){
  const { t } = useLanguage();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(()=>{ setMounted(true); },[]);

  // Désactiver le scroll quand la modal est ouverte
  React.useEffect(() => {
    if (open && mounted) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [open, mounted]);

  if(!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[10002] overflow-y-auto">
      <div className="fixed inset-0 bg-black/30" onClick={onClose}></div>
      <div className="relative min-h-full flex items-start sm:items-center justify-center p-4">
        <div className="relative z-10 w-full max-w-lg rounded-2xl border bg-white p-4 shadow-lg">
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
