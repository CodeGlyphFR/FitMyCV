"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

// French translations (split by category)
import frUi from "@/locales/fr/ui.json";
import frErrors from "@/locales/fr/errors.json";
import frAuth from "@/locales/fr/auth.json";
import frCv from "@/locales/fr/cv.json";
import frEnums from "@/locales/fr/enums.json";
import frSubscription from "@/locales/fr/subscription.json";
import frTasks from "@/locales/fr/tasks.json";
import frOnboarding from "@/locales/fr/onboarding.json";
import frAccount from "@/locales/fr/account.json";

// English translations (split by category)
import enUi from "@/locales/en/ui.json";
import enErrors from "@/locales/en/errors.json";
import enAuth from "@/locales/en/auth.json";
import enCv from "@/locales/en/cv.json";
import enEnums from "@/locales/en/enums.json";
import enSubscription from "@/locales/en/subscription.json";
import enTasks from "@/locales/en/tasks.json";
import enOnboarding from "@/locales/en/onboarding.json";
import enAccount from "@/locales/en/account.json";

// Spanish translations (split by category)
import esUi from "@/locales/es/ui.json";
import esErrors from "@/locales/es/errors.json";
import esAuth from "@/locales/es/auth.json";
import esCv from "@/locales/es/cv.json";
import esEnums from "@/locales/es/enums.json";
import esSubscription from "@/locales/es/subscription.json";
import esTasks from "@/locales/es/tasks.json";
import esOnboarding from "@/locales/es/onboarding.json";
import esAccount from "@/locales/es/account.json";

// German translations (split by category)
import deUi from "@/locales/de/ui.json";
import deErrors from "@/locales/de/errors.json";
import deAuth from "@/locales/de/auth.json";
import deCv from "@/locales/de/cv.json";
import deEnums from "@/locales/de/enums.json";
import deSubscription from "@/locales/de/subscription.json";
import deTasks from "@/locales/de/tasks.json";
import deOnboarding from "@/locales/de/onboarding.json";
import deAccount from "@/locales/de/account.json";

const translations = {
  fr: { ...frUi, ...frErrors, ...frAuth, ...frCv, ...frEnums, ...frSubscription, ...frTasks, ...frOnboarding, ...frAccount },
  en: { ...enUi, ...enErrors, ...enAuth, ...enCv, ...enEnums, ...enSubscription, ...enTasks, ...enOnboarding, ...enAccount },
  es: { ...esUi, ...esErrors, ...esAuth, ...esCv, ...esEnums, ...esSubscription, ...esTasks, ...esOnboarding, ...esAccount },
  de: { ...deUi, ...deErrors, ...deAuth, ...deCv, ...deEnums, ...deSubscription, ...deTasks, ...deOnboarding, ...deAccount },
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
        if (savedLanguage && ["fr", "en", "es", "de"].includes(savedLanguage)) {
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
