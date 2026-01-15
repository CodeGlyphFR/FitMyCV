"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useSettings } from "@/lib/settings/SettingsContext";

const languages = [
  { code: "fr", flag: "/icons/fr.svg", label: "Français" },
  { code: "en", flag: "/icons/gb.svg", label: "English" },
  { code: "es", flag: "/icons/es.svg", label: "Español" },
  { code: "de", flag: "/icons/de.svg", label: "Deutsch" },
];

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const { language, changeLanguage } = useLanguage();
  const { settings } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const currentLanguage = languages.find((lang) => lang.code === language);

  // Ne pas afficher sur les pages admin
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  // Ne pas afficher si la feature est désactivée
  if (!settings.feature_language_switcher) {
    return null;
  }

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
      className="fixed bottom-6 left-6 z-50 no-print pointer-events-auto"
      style={{
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        WebkitTransform: 'translateZ(0)',
        WebkitBackfaceVisibility: 'hidden',
        willChange: 'transform'
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
                w-10 h-10 rounded-full
                bg-white/20 backdrop-blur-xl border-2 border-white/30 shadow-2xl
                flex items-center justify-center
                overflow-hidden
                hover:shadow-sm-xl hover:bg-white/30
                transition-all duration-200
                cursor-pointer
                p-1
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
                width={28}
                height={28}
                className="object-cover"
              />
            </button>
          ))}
      </div>

      {/* Current language button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-10 h-10 rounded-full
          bg-white/20 backdrop-blur-xl border-2 border-white/30 shadow-2xl
          flex items-center justify-center
          overflow-hidden
          hover:shadow-sm-xl hover:bg-white/30
          transition-all duration-200
          cursor-pointer
          p-1
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
            width={28}
            height={28}
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
