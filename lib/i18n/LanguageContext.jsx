"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import frTranslations from "@/locales/fr.json";
import enTranslations from "@/locales/en.json";
import esTranslations from "@/locales/es.json";

const translations = {
  fr: frTranslations,
  en: enTranslations,
  es: esTranslations,
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState("fr");
  const [isHydrated, setIsHydrated] = useState(false);

  // Load language from localStorage on mount
  useEffect(() => {
    setIsHydrated(true);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const savedLanguage = localStorage.getItem("preferredLanguage");
        if (savedLanguage && ["fr", "en", "es"].includes(savedLanguage)) {
          setLanguage(savedLanguage);
        }
      } catch (error) {
        console.warn("Failed to load language from localStorage:", error);
      }
    }
  }, []);

  // Save language to localStorage when it changes
  const changeLanguage = (newLanguage) => {
    setLanguage(newLanguage);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem("preferredLanguage", newLanguage);
        // Update HTML lang attribute for accessibility
        if (document.documentElement) {
          document.documentElement.lang = newLanguage;
        }
      } catch (error) {
        console.warn("Failed to save language to localStorage:", error);
      }
    }
  };

  // Get nested translation by path (e.g., "auth.title")
  const t = (path, vars = {}) => {
    const keys = path.split(".");
    let value = translations[language];

    for (const key of keys) {
      if (value && typeof value === "object") {
        value = value[key];
      } else {
        return path; // Return path if translation not found
      }
    }

    // Replace variables in translation
    if (typeof value === "string" && Object.keys(vars).length > 0) {
      return value.replace(/\{(\w+)\}/g, (match, key) => {
        return vars[key] !== undefined ? vars[key] : match;
      });
    }

    return value || path;
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
