"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const languages = [
  { code: "fr", flag: "/icons/fr.svg", label: "Français" },
  { code: "en", flag: "/icons/gb.svg", label: "English" },
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
      className="fixed bottom-6 left-6 z-40 no-print"
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
                w-8 h-8 rounded-full
                bg-white shadow-lg border border-neutral-200
                flex items-center justify-center
                overflow-hidden
                hover:shadow-xl
                transition-all duration-200
                cursor-pointer
                p-0.5
              `}
              style={{
                transitionDelay: isOpen ? `${index * 50}ms` : '0ms'
              }}
              title={lang.label}
              aria-label={`Switch to ${lang.label}`}
            >
              <Image
                src={lang.flag}
                alt={lang.label}
                width={24}
                height={24}
                className="object-cover"
              />
            </button>
          ))}
      </div>

      {/* Current language button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-8 h-8 rounded-full
          bg-white shadow-lg border border-neutral-300
          flex items-center justify-center
          overflow-hidden
          hover:shadow-xl
          transition-all duration-200
          cursor-pointer
          p-0.5
          ${isOpen ? 'shadow-xl' : ''}
        `}
        title={currentLanguage?.label}
        aria-label="Language selector"
        aria-expanded={isOpen}
      >
        {currentLanguage && (
          <Image
            src={currentLanguage.flag}
            alt={currentLanguage.label}
            width={24}
            height={24}
            className="object-cover"
          />
        )}
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
