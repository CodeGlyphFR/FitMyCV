'use client';

import { useState, useEffect } from 'react';
import {
  getConsent,
  acceptAllCookies,
  rejectAllCookies,
  saveConsent,
  DEFAULT_CONSENT,
  COOKIE_CATEGORIES
} from '@/lib/cookies/consent';

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState(DEFAULT_CONSENT);

  useEffect(() => {
    const consent = getConsent();
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const handleAcceptAll = () => {
    acceptAllCookies();
    setShowBanner(false);
    setShowPreferences(false);
  };

  const handleRejectAll = () => {
    rejectAllCookies();
    setShowBanner(false);
    setShowPreferences(false);
  };

  const handleSavePreferences = () => {
    saveConsent(preferences);
    setShowBanner(false);
    setShowPreferences(false);
  };

  const handleToggleCategory = (category) => {
    if (category === COOKIE_CATEGORIES.NECESSARY) return;
    setPreferences(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div className={`pointer-events-auto ${showPreferences ? 'max-w-3xl' : 'max-w-2xl'} mx-auto mb-4 mx-4 sm:mx-auto`}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
          {!showPreferences ? (
            <>
              <div className="flex items-start gap-3">
                <span className="text-2xl">🍪</span>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold mb-1 text-gray-900 dark:text-white">
                    Ce site utilise des cookies
                  </h2>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
                    Nous utilisons des cookies pour améliorer votre expérience.
                    <button
                      onClick={() => setShowPreferences(true)}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 ml-1 underline"
                    >
                      En savoir plus
                    </button>
                  </p>
                </div>
                <button
                  onClick={handleRejectAll}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
                  title="Fermer"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <button
                  onClick={handleAcceptAll}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
                >
                  Accepter tout
                </button>
                <button
                  onClick={handleRejectAll}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white text-sm font-medium py-2 px-4 rounded transition-colors"
                >
                  Refuser tout
                </button>
                <button
                  onClick={() => setShowPreferences(true)}
                  className="flex-1 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium py-2 px-4 rounded border border-gray-300 dark:border-gray-600 transition-colors"
                >
                  Personnaliser
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Préférences de cookies
                </h2>
                <button
                  onClick={() => setShowPreferences(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-lg"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                <div className="border border-gray-200 dark:border-gray-700 rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Cookies nécessaires
                    </h3>
                    <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-0.5 rounded">
                      Actifs
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    Essentiels au fonctionnement du site.
                  </p>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Cookies fonctionnels
                    </h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences[COOKIE_CATEGORIES.FUNCTIONAL]}
                        onChange={() => handleToggleCategory(COOKIE_CATEGORIES.FUNCTIONAL)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    Mémorisent vos préférences.
                  </p>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Cookies analytiques
                    </h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences[COOKIE_CATEGORIES.ANALYTICS]}
                        onChange={() => handleToggleCategory(COOKIE_CATEGORIES.ANALYTICS)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    Statistiques d'utilisation du site.
                  </p>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Cookies marketing
                    </h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences[COOKIE_CATEGORIES.MARKETING]}
                        onChange={() => handleToggleCategory(COOKIE_CATEGORIES.MARKETING)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    Publicité ciblée.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleSavePreferences}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
                >
                  Enregistrer
                </button>
                <button
                  onClick={() => setShowPreferences(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white text-sm font-medium py-2 px-4 rounded transition-colors"
                >
                  Retour
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}