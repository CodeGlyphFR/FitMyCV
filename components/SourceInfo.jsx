"use client";
import React from "react";

export default function SourceInfo({ sourceType, sourceValue }) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const containerRef = React.useRef(null);

  // Détecter si on est sur mobile
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(pointer: coarse)').matches);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fermer le tooltip si on clique en dehors
  React.useEffect(() => {
    if (!isMobile || !isOpen) return;

    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, isOpen]);

  if (!sourceType) return null;

  const getTooltipContent = () => {
    if (sourceType === "link") {
      return {
        title: "Créé depuis un lien",
        value: sourceValue,
        icon: "🔗"
      };
    }
    if (sourceType === "pdf") {
      return {
        title: "Créé depuis un PDF",
        value: sourceValue,
        icon: "📄"
      };
    }
    return null;
  };

  const handleButtonClick = () => {
    if (isMobile) {
      // Sur mobile: toggle le tooltip
      setIsOpen(!isOpen);
    } else {
      // Sur desktop: ouvrir directement le lien si clickable
      if (sourceType === "link" && sourceValue) {
        window.open(sourceValue, "_blank", "noopener,noreferrer");
      }
    }
  };

  const handleLinkClick = (e) => {
    if (isMobile && !isOpen) {
      // Premier clic sur mobile: ne rien faire, le tooltip va s'ouvrir
      e.preventDefault();
    }
    // Second clic ou desktop: le lien s'ouvre normalement
  };

  const isClickable = sourceType === "link";
  const content = getTooltipContent();
  const showTooltip = isMobile ? isOpen : isHovered;

  return (
    <div
      ref={containerRef}
      className="no-print relative"
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => !isMobile && setIsHovered(false)}
    >
      <button
        onClick={handleButtonClick}
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full border bg-blue-50 text-blue-600 text-xs font-bold transition-all duration-200 ${
          isClickable ? "cursor-pointer hover:bg-blue-100 hover:shadow-md hover:scale-110" : "cursor-default"
        } ${showTooltip ? "ring-2 ring-blue-300 ring-opacity-50" : ""}`}
        type="button"
      >
        i
      </button>

      {/* Tooltip animé */}
      <div
        className={`absolute top-1/2 right-full mr-2 -translate-y-1/2 transition-all duration-300 ease-out origin-right ${
          isMobile ? "" : "pointer-events-none"
        } ${
          showTooltip
            ? "opacity-100 scale-x-100 translate-x-0"
            : "opacity-0 scale-x-0 translate-x-2"
        }`}
      >
        <div className="bg-white border border-blue-200 rounded-lg shadow-xl px-3 py-2 min-w-[200px] max-w-[300px]">
          {/* Flèche pointant vers le bouton */}
          <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-r border-t border-blue-200 rotate-45"></div>

          {/* Contenu */}
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{content?.icon}</span>
              <span className="text-xs font-semibold text-gray-700">{content?.title}</span>
            </div>
            <div className="text-xs text-gray-600 break-all">
              {isClickable ? (
                <a
                  href={sourceValue}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                  onClick={handleLinkClick}
                >
                  {content?.value}
                </a>
              ) : (
                <span>{content?.value}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
