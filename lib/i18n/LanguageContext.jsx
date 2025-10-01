"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import frTranslations from "@/locales/fr.json";
import enTranslations from "@/locales/en.json";

const translations = {
  fr: frTranslations,
  en: enTranslations,
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState("fr");

  // Load language from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem("preferredLanguage");
    if (savedLanguage && (savedLanguage === "fr" || savedLanguage === "en")) {
      setLanguage(savedLanguage);
    }
  }, []);

  // Save language to localStorage when it changes
  const changeLanguage = (newLanguage) => {
    setLanguage(newLanguage);
    localStorage.setItem("preferredLanguage", newLanguage);
    // Update HTML lang attribute for accessibility
    document.documentElement.lang = newLanguage;
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
