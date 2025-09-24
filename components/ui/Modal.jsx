"use client";
import React from "react";
import { createPortal } from "react-dom";

export default function Modal({ open, onClose, title, children }){
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(()=>{ setMounted(true); },[]);
  if(!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] overflow-y-auto">
      <div className="fixed inset-0 bg-black/30" onClick={onClose}></div>
      <div className="relative min-h-full flex items-start sm:items-center justify-center p-4">
        <div className="relative z-10 w-full max-w-lg rounded-2xl border bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">{title || "Confirmation"}</div>
            <button onClick={onClose} className="rounded border px-2 py-1 text-xs">Fermer</button>
          </div>
          <div>{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}
