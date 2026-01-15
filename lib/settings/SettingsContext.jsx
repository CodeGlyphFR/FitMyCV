"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const SettingsContext = createContext();

// Valeurs par défaut (tout activé)
const defaultSettings = {
  registration_enabled: true,
  feature_manual_cv: true,
  feature_ai_generation: true,
  feature_import: true,
  feature_export: true,
  feature_match_score: true,
  feature_optimize: true,
  feature_history: true,
  feature_search_bar: true,
  feature_translate: true,
  feature_language_switcher: true,
  feature_edit_mode: true,
  feature_feedback: true,
};

export function SettingsProvider({ initialSettings, children }) {
  // Si on a des initialSettings (chargés côté serveur), on les utilise, sinon on utilise les valeurs par défaut
  const [settings, setSettings] = useState(initialSettings || defaultSettings);
  const [isLoading, setIsLoading] = useState(!initialSettings);
  const hasFetchedOnce = React.useRef(!!initialSettings);

  // Fonction pour récupérer les settings depuis l'API
  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/settings', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        console.warn('[SettingsProvider] Erreur lors de la récupération des settings, utilisation des valeurs par défaut');
        return;
      }

      const data = await response.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('[SettingsProvider] Erreur lors de la récupération des settings:', error);
      // On garde les valeurs par défaut en cas d'erreur
    } finally {
      setIsLoading(false);
      hasFetchedOnce.current = true;
    }
  }, []);

  // Charger les settings au montage (sauf si on a déjà des initialSettings)
  useEffect(() => {
    if (!hasFetchedOnce.current) {
      fetchSettings();
    }
  }, [fetchSettings]);

  // Plus de polling - les settings sont maintenant mis à jour via SSE (event-driven)

  // Écouter les événements de mise à jour des settings
  useEffect(() => {
    const handleSettingsUpdate = () => {
      fetchSettings();
    };

    window.addEventListener('settings:updated', handleSettingsUpdate);
    return () => window.removeEventListener('settings:updated', handleSettingsUpdate);
  }, [fetchSettings]);

  // Fonction pour forcer le refresh des settings
  const refreshSettings = useCallback(() => {
    return fetchSettings();
  }, [fetchSettings]);

  const value = {
    settings,
    isLoading,
    refreshSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * Hook pour accéder aux settings depuis n'importe quel composant
 * Usage: const { settings, isLoading, refreshSettings } = useSettings();
 */
export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
