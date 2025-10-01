"use client";

import React, { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const languages = [
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "en", flag: "🇬🇧", label: "English" },
];

export default function LanguageSwitcher() {
  const { language, changeLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const currentLanguage = languages.find((lang) => lang.code === language);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [isOpen]);

  const handleLanguageChange = (langCode) => {
    changeLanguage(langCode);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="fixed bottom-6 left-6 z-50 no-print"
      style={{
        // Prevent printing
        '@media print': {
          display: 'none'
        }
      }}
    >
      {/* Language options - appear above the button when open */}
      <div
        className={`
          absolute bottom-full left-0 mb-2
          flex flex-col gap-2
          transition-all duration-300 ease-out origin-bottom
          ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-75 translate-y-2 pointer-events-none'}
        `}
      >
        {languages
          .filter((lang) => lang.code !== language)
          .map((lang, index) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`
                w-12 h-12 rounded-full
                bg-white shadow-lg border-2 border-neutral-200
                flex items-center justify-center
                text-2xl
                hover:scale-110 hover:shadow-xl
                transition-all duration-200
                cursor-pointer
              `}
              style={{
                transitionDelay: isOpen ? `${index * 50}ms` : '0ms'
              }}
              title={lang.label}
              aria-label={`Switch to ${lang.label}`}
            >
              {lang.flag}
            </button>
          ))}
      </div>

      {/* Current language button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-14 h-14 rounded-full
          bg-white shadow-lg border-2 border-neutral-300
          flex items-center justify-center
          text-3xl
          hover:scale-110 hover:shadow-xl
          transition-all duration-200
          cursor-pointer
          ${isOpen ? 'scale-110 shadow-xl' : ''}
        `}
        title={currentLanguage?.label}
        aria-label="Language selector"
        aria-expanded={isOpen}
      >
        {currentLanguage?.flag}
      </button>

      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
