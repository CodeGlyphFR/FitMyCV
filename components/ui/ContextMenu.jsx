"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

/**
 * Menu contextuel (kebab ⋮) réutilisable
 *
 * @param {Array} items - Liste des items du menu
 *   - icon: LucideIcon (optionnel)
 *   - label: string
 *   - onClick: () => void
 *   - danger: boolean (optionnel) - Style rouge pour suppression
 * @param {string} className - Classes additionnelles pour le trigger
 */
export default function ContextMenu({ items, className = "", compact = false, dataOnboarding }) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, openUp: false });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  // Calcul de la position du menu
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuHeight = 80; // Estimation hauteur menu (2 items)
    const menuWidth = 144; // w-36 = 144px
    const padding = 8;

    // Vérifier s'il y a assez d'espace en bas
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const openUp = spaceBelow < menuHeight + padding;

    // Position horizontale : aligner à droite du trigger
    let left = triggerRect.right - menuWidth;
    // S'assurer que le menu ne sort pas à gauche
    if (left < padding) left = padding;

    // Position verticale
    let top;
    if (openUp) {
      top = triggerRect.top - menuHeight - 4;
    } else {
      top = triggerRect.bottom + 4;
    }

    setPosition({ top, left, openUp });
  }, []);

  // Ouvrir le menu
  const handleOpen = (e) => {
    e.stopPropagation();
    updatePosition();
    setIsOpen(true);
  };

  // Fermer le menu
  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Click sur un item
  const handleItemClick = (e, onClick) => {
    e.stopPropagation();
    handleClose();
    onClick?.();
  };

  // Fermeture sur click extérieur
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, handleClose]);

  // Fermeture sur Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleClose]);

  // Fermeture sur scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = () => {
      handleClose();
    };

    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [isOpen, handleClose]);

  // Recalcul position sur resize
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      updatePosition();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen, updatePosition]);

  return (
    <>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={`no-print flex items-center justify-center ${compact ? 'p-0' : 'p-1 hover:bg-white/10'} rounded text-white/50 hover:text-white transition-all duration-200 ${className}`}
        aria-label="Menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
        {...(compact ? { style: { minHeight: 0, minWidth: 0 } } : {})}
        {...(dataOnboarding ? { 'data-onboarding': dataOnboarding } : {})}
      >
        <MoreVertical className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      </button>

      {/* Menu dropdown via portal */}
      {isOpen && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className={`
            fixed z-[10002] w-36
            rounded-lg shadow-xl
            bg-slate-900/95 backdrop-blur-xl
            border border-white/30
            py-1
            animate-in fade-in duration-150
            ${position.openUp ? "slide-in-from-bottom-2" : "slide-in-from-top-2"}
          `}
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          {items.map((item, index) => {
            const Icon = item.icon;
            const isDanger = item.danger;

            return (
              <button
                key={index}
                type="button"
                role="menuitem"
                onClick={(e) => handleItemClick(e, item.onClick)}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                  transition-colors duration-150
                  ${isDanger
                    ? "text-red-400 hover:bg-red-500/20"
                    : "text-white hover:bg-white/10"
                  }
                `}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
