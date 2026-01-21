"use client";
import React from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const COUNTRY_CODES = [
  "FR", "US", "DE", "GB", "ES", "IT", "BE", "CH", "CA", "NL",
  "PT", "AT", "LU", "IE", "PL", "SE", "DK", "NO", "FI", "AU",
  "JP", "CN", "IN", "BR", "MX", "MA", "TN", "DZ", "SN", "CI"
];

export default function CountrySelect({ value, onChange, className, placeholder }) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [mounted, setMounted] = React.useState(false);
  const [position, setPosition] = React.useState({ top: 0, left: 0, width: 0 });
  const containerRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Build options sorted by translated name
  const allOptions = React.useMemo(() =>
    COUNTRY_CODES
      .map(code => ({ code, name: t(`countries.${code}`) || code }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [t]
  );

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return allOptions;
    const searchLower = search.toLowerCase();
    return allOptions.filter(opt =>
      opt.name.toLowerCase().includes(searchLower) ||
      opt.code.toLowerCase().includes(searchLower)
    );
  }, [allOptions, search]);

  // Get display value
  const displayValue = React.useMemo(() => {
    if (!value) return "";
    const option = allOptions.find(opt => opt.code === value);
    return option ? option.name : value;
  }, [value, allOptions]);

  // Update dropdown position
  const updatePosition = React.useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
  }, []);

  // Handle click outside to close
  React.useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e) {
      const clickedContainer = containerRef.current?.contains(e.target);
      const clickedDropdown = dropdownRef.current?.contains(e.target);
      if (!clickedContainer && !clickedDropdown) {
        setIsOpen(false);
        setSearch("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Update position on scroll/resize when open
  React.useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  // Handle keyboard navigation
  function handleKeyDown(e) {
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearch("");
    } else if (e.key === "Enter" && filteredOptions.length > 0) {
      e.preventDefault();
      onChange(filteredOptions[0].code);
      setIsOpen(false);
      setSearch("");
    }
  }

  function handleSelect(code) {
    onChange(code);
    setIsOpen(false);
    setSearch("");
  }

  function handleOpen() {
    updatePosition();
    setIsOpen(true);
    setSearch("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  // Dropdown via portal
  const dropdown = isOpen && mounted ? createPortal(
    <div
      ref={dropdownRef}
      className="fixed max-h-48 overflow-y-auto rounded-lg border border-white/20 bg-gray-800 shadow-2xl"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        zIndex: 99999
      }}
    >
      {filteredOptions.length === 0 ? (
        <div className="px-3 py-2 text-sm text-white/50">
          {t("common.noResults")}
        </div>
      ) : (
        <>
          {/* Option pour vider la sélection */}
          {!search && value && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelect("");
              }}
              className="w-full px-3 py-2 text-left text-sm cursor-pointer hover:bg-white/10 transition-colors text-white/50 italic border-b border-white/10"
            >
              {t("common.clear") || "—"}
            </div>
          )}
          {filteredOptions.map(({ code, name }) => (
          <div
            key={code}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSelect(code);
            }}
            className={`w-full px-3 py-2 text-left text-sm cursor-pointer hover:bg-white/10 transition-colors ${
              value === code ? "bg-emerald-500/20 text-emerald-300" : "text-white"
            }`}
          >
            {name}
          </div>
        ))}
        </>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Button always present to maintain height */}
      <button
        type="button"
        onClick={handleOpen}
        className={`${className} w-full text-left flex items-center justify-between gap-2 ${isOpen ? "invisible" : ""}`}
      >
        <span className={`truncate ${value ? "" : "text-white/50"}`}>
          {displayValue || placeholder}
        </span>
        <svg className="w-4 h-4 opacity-60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {/* Input overlaid when open */}
      {isOpen && (
        <input
          ref={inputRef}
          type="text"
          className={`${className} w-full absolute inset-0 !bg-gray-900`}
          placeholder={placeholder}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      )}

      {/* Dropdown rendered via portal */}
      {dropdown}
    </div>
  );
}
