"use client";

import React from "react";
import { createPortal } from "react-dom";

// Types de CV disponibles
const CV_TYPES = [
  { id: "generate-cv", key: "generate-cv" },
  { id: "import-pdf", key: "import-pdf" },
  { id: "manual", key: "manual" },
  { id: "translate-cv", key: "translate-cv" },
  { id: "improve-cv", key: "improve-cv" },
  { id: "generate-cv-job-title", key: "generate-cv-job-title" },
  { id: "create-template", key: "create-template" },
];

// Langues disponibles
const CV_LANGUAGES = [
  { id: null, key: "all" },
  { id: "fr", key: "fr" },
  { id: "en", key: "en" },
  { id: "es", key: "es" },
  { id: "de", key: "de" },
];

// Plages de dates
const DATE_RANGES = [
  { id: null, key: "all" },
  { id: "24h", key: "24h" },
  { id: "7d", key: "7d" },
  { id: "30d", key: "30d" },
];

// Checkbox personnalisée style glassmorphism
function GlassCheckbox({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/10 rounded cursor-pointer transition-colors duration-150 group">
      <div
        onClick={(e) => {
          e.preventDefault();
          onChange();
        }}
        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 cursor-pointer ${
          checked
            ? 'bg-emerald-500 border-emerald-400'
            : 'bg-transparent border-white/50 group-hover:border-white/70'
        }`}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className="text-sm text-white/90">{label}</span>
    </label>
  );
}

// Select personnalisé style glassmorphism
function GlassSelect({ value, onChange, options, t, translationPrefix }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const selectRef = React.useRef(null);

  // Trouver l'option sélectionnée
  const selectedOption = options.find(opt => opt.id === value) || options[0];

  // Fermer au clic extérieur
  React.useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="px-3 py-1.5 relative" ref={selectRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-1.5 rounded-lg border border-white/40 bg-white/10 backdrop-blur-sm text-white text-sm flex items-center justify-between hover:bg-white/15 hover:border-white/50 transition-all duration-200"
      >
        <span className="text-white/90">{t(`${translationPrefix}.${selectedOption.key}`)}</span>
        <svg
          className={`w-4 h-4 text-white/70 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-3 right-3 top-full mt-1 rounded-lg border border-white/30 bg-slate-900/95 backdrop-blur-xl shadow-lg overflow-hidden z-10">
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                onChange(option.id);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-1.5 text-left text-sm transition-colors duration-150 ${
                option.id === value
                  ? 'bg-emerald-500/30 text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              {t(`${translationPrefix}.${option.key}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="px-3 py-1.5 text-xs uppercase text-white/50 font-medium tracking-wide">
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-white/15 my-1.5" />;
}

export default function FilterDropdown({
  isOpen,
  onClose,
  buttonRef,
  filters,
  toggleType,
  setLanguage,
  setDateRange,
  clearAllFilters,
  hasActiveFilters,
  t,
}) {
  const dropdownRef = React.useRef(null);
  const [rect, setRect] = React.useState(null);

  // Calculer la position du dropdown
  React.useEffect(() => {
    if (isOpen && buttonRef?.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      setRect(buttonRect);
    }
  }, [isOpen, buttonRef]);

  // Détecter si on est sur mobile
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Click outside handler
  React.useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        buttonRef?.current &&
        !buttonRef.current.contains(event.target)
      ) {
        onClose();
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose, buttonRef]);

  if (!isOpen || !rect) return null;

  const dropdownContent = (
    <>
      {/* Overlay transparent pour fermer au click */}
      <div
        className="fixed inset-0 z-[10001] bg-transparent"
        onClick={onClose}
      />

      {/* Menu dropdown */}
      <div
        ref={dropdownRef}
        style={{
          position: "fixed",
          top: rect.bottom + 8,
          ...(isMobile
            ? { right: 12 } // Mobile: aligné à droite avec marge
            : { left: Math.max(8, rect.left - 100) } // Desktop: relatif au bouton
          ),
          zIndex: 10002,
          minWidth: "200px",
          maxWidth: "260px",
        }}
        className="rounded-xl border border-white/25 bg-white/10 backdrop-blur-xl shadow-2xl py-2"
      >
        {/* Type de CV */}
        <SectionTitle>{t("topbar.filterCvType")}</SectionTitle>
        <div className="space-y-0">
          {CV_TYPES.map((type) => (
            <GlassCheckbox
              key={type.id}
              checked={filters.types.includes(type.id)}
              onChange={() => toggleType(type.id)}
              label={t(`topbar.cvTypes.${type.key}`)}
            />
          ))}
        </div>

        <Divider />

        {/* Langue du CV - Liste déroulante */}
        <SectionTitle>{t("topbar.filterCvLanguage")}</SectionTitle>
        <GlassSelect
          value={filters.language}
          onChange={setLanguage}
          options={CV_LANGUAGES}
          t={t}
          translationPrefix="topbar.cvLanguages"
        />

        <Divider />

        {/* Date de création - Liste déroulante */}
        <SectionTitle>{t("topbar.filterDateRange")}</SectionTitle>
        <GlassSelect
          value={filters.dateRange}
          onChange={setDateRange}
          options={DATE_RANGES}
          t={t}
          translationPrefix="topbar.dateRanges"
        />

        {/* Bouton effacer les filtres */}
        {hasActiveFilters && (
          <>
            <Divider />
            <button
              onClick={clearAllFilters}
              className="w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors duration-150 text-center"
            >
              {t("topbar.filterClearAll")}
            </button>
          </>
        )}
      </div>
    </>
  );

  return createPortal(dropdownContent, document.body);
}
