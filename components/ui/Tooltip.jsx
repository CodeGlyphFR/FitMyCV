"use client";

import React from "react";
import { Info } from "lucide-react";

/**
 * Composant Tooltip simple pour afficher des informations contextuelles
 * @param {Object} props
 * @param {string} props.content - Le texte du tooltip
 * @param {React.ReactNode} props.children - L'élément déclencheur (optionnel, utilise une icône Info par défaut)
 * @param {string} props.position - Position du tooltip: 'top' | 'bottom' | 'left' | 'right' (défaut: 'top')
 */
export default function Tooltip({ content, children, position = "top" }) {
  const [isVisible, setIsVisible] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    // Détecter si c'est un appareil tactile
    setIsMobile('ontouchstart' in window);
  }, []);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-900",
    left: "left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-900",
    right: "right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-900",
  };

  const handleClick = () => {
    if (isMobile) {
      setIsVisible(!isVisible);
    }
  };

  return (
    <div className="relative inline-flex">
      {/* Trigger */}
      <div
        onMouseEnter={() => !isMobile && setIsVisible(true)}
        onMouseLeave={() => !isMobile && setIsVisible(false)}
        onFocus={() => !isMobile && setIsVisible(true)}
        onBlur={() => !isMobile && setIsVisible(false)}
        onClick={handleClick}
        className="inline-flex items-center cursor-help"
        tabIndex={0}
        role="button"
        aria-label="Afficher l'info-bulle"
      >
        {children || <Info size={16} className="text-white/60 hover:text-white/80 transition-colors" />}
      </div>

      {/* Tooltip */}
      {isVisible && (
        <div
          className={`
            absolute z-50 px-3 py-2 text-xs text-white bg-gray-900 rounded-lg shadow-lg
            max-w-xs pointer-events-none
            ${positionClasses[position]}
            animate-in fade-in zoom-in-95 duration-200
          `}
          role="tooltip"
        >
          {content}
          {/* Arrow */}
          <div
            className={`
              absolute w-0 h-0 border-4
              ${arrowClasses[position]}
            `}
          />
        </div>
      )}
    </div>
  );
}
