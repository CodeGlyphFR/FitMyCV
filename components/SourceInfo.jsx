"use client";
import React from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function SourceInfo({ sourceType, sourceValue, jobOfferInfo, sourceCvInfo }) {
  const { t, locale } = useLanguage();
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

  // N'afficher le bouton que pour les sources "link" ou "pdf"
  if (!sourceType || (sourceType !== "link" && sourceType !== "pdf")) return null;

  const getTooltipContent = () => {
    if (sourceType === "link") {
      return {
        title: t("sourceInfo.createdFromLink"),
        value: sourceValue,
        icon: "🔗"
      };
    }
    if (sourceType === "pdf") {
      return {
        title: t("sourceInfo.createdFromPdf"),
        value: sourceValue,
        icon: "📄"
      };
    }
    return null;
  };

  // Formater la date pour l'affichage
  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Extraire le domaine d'une URL (ex: "linkedin.com" depuis "https://www.linkedin.com/jobs/...")
  const extractDomain = (url) => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      // Enlever le "www." si présent
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  const handleButtonClick = () => {
    if (isMobile) {
      // Sur mobile: toggle le tooltip
      setIsOpen(!isOpen);
    } else {
      // Sur desktop: ouvrir directement le lien de l'offre d'emploi
      if (jobOfferInfo?.url) {
        window.open(jobOfferInfo.url, "_blank", "noopener,noreferrer");
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

  const isClickable = !!jobOfferInfo?.url;
  const content = getTooltipContent();
  const showTooltip = isMobile ? isOpen : isHovered;

  return (
    <div
      ref={containerRef}
      className="no-print relative z-10"
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => !isMobile && setIsHovered(false)}
    >
      <button
        onClick={handleButtonClick}
        className={`
          transition-all duration-300
          ${isClickable ? "cursor-pointer hover:scale-110" : "cursor-default"}
          ${showTooltip ? "drop-shadow-xl" : ""}
        `}
        type="button"
      >
        <img src="/icons/infos.png" alt="Info" className="h-4 w-4 opacity-70 hover:opacity-100 transition-opacity" />
      </button>

      {/* Tooltip animé */}
      <div
        className={`absolute top-0 right-full mr-2 transition-all duration-300 ease-out origin-right z-10 ${
          isMobile ? "" : "pointer-events-none"
        } ${
          showTooltip
            ? "opacity-100 scale-x-100 translate-x-0"
            : "opacity-0 scale-x-0 translate-x-2"
        }`}
      >
        <div className="border-2 border-emerald-400/30 bg-gray-900/95 rounded-lg shadow-2xl px-3 py-2 min-w-[200px] max-w-[300px]">
          {/* Flèche pointant vers le bouton */}
          <div className="absolute top-2 -right-1.5 w-3 h-3 bg-gray-900/95 border-r-2 border-t-2 border-emerald-400/30 rotate-45"></div>

          {/* Contenu */}
          <div className="relative z-10 space-y-2">
            {/* Offre d'emploi */}
            {jobOfferInfo && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">🔗</span>
                  <span className="text-xs font-semibold text-emerald-300 drop-shadow">{t("sourceInfo.jobOfferLink")}</span>
                </div>
                <div className="text-xs text-white/90 drop-shadow">
                  {jobOfferInfo.title && (
                    <div className="font-medium">{jobOfferInfo.title}</div>
                  )}
                  {jobOfferInfo.url && (
                    <div className="text-white/60 text-[10px] mt-0.5">
                      <a
                        href={jobOfferInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400/70 hover:text-emerald-300 hover:underline transition-colors duration-200"
                        onClick={handleLinkClick}
                      >
                        {extractDomain(jobOfferInfo.url)}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CV source */}
            {sourceCvInfo && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">📄</span>
                  <span className="text-xs font-semibold text-emerald-300 drop-shadow">{t("sourceInfo.sourceCv")}</span>
                </div>
                <div className="text-xs text-white/90 drop-shadow">
                  <div className="font-medium">{sourceCvInfo.title}</div>
                  {sourceCvInfo.createdAt && (
                    <div className="text-white/60 text-[10px] mt-0.5">
                      {t("sourceInfo.createdOn")} {formatDate(sourceCvInfo.createdAt)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Fallback: ancienne info si pas de nouvelles données */}
            {!jobOfferInfo && !sourceCvInfo && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{content?.icon}</span>
                  <span className="text-xs font-semibold text-emerald-300 drop-shadow">{content?.title}</span>
                </div>
                <div className="text-xs text-white/90 drop-shadow break-all">
                  {isClickable ? (
                    <a
                      href={sourceValue}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 hover:underline transition-colors duration-200"
                      onClick={handleLinkClick}
                    >
                      {content?.value}
                    </a>
                  ) : (
                    <span>{content?.value}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
