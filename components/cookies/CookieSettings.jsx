'use client';

import { useState, useEffect } from 'react';
import {
  getConsent,
  saveConsent,
  acceptAllCookies,
  rejectAllCookies,
  clearConsent,
  COOKIE_CATEGORIES,
  DEFAULT_CONSENT,
  CONSENT_DURATION
} from '@/lib/cookies/consent';

export default function CookieSettings() {
  const [consent, setConsent] = useState(null);
  const [preferences, setPreferences] = useState(DEFAULT_CONSENT);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const currentConsent = getConsent();
    setConsent(currentConsent);
    if (currentConsent) {
      setPreferences(currentConsent);
    }
  }, []);

  const handleToggleCategory = (category) => {
    if (category === COOKIE_CATEGORIES.NECESSARY) return;
    setPreferences(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleSave = () => {
    saveConsent(preferences);
    setConsent(preferences);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAcceptAll = () => {
    const allAccepted = acceptAllCookies();
    setPreferences(allAccepted);
    setConsent(allAccepted);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleRejectAll = () => {
    const allRejected = rejectAllCookies();
    setPreferences(allRejected);
    setConsent(allRejected);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    clearConsent();
    setConsent(null);
    setPreferences(DEFAULT_CONSENT);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Non défini';
    return new Date(timestamp).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getExpiryDate = (timestamp) => {
    if (!timestamp) return 'Non défini';
    return new Date(timestamp + CONSENT_DURATION).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        Gestion des cookies
      </h1>

      {saved && (
        <div className="mb-6 p-4 bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-700 text-green-800 dark:text-green-200 rounded-lg">
          ✓ Vos préférences ont été enregistrées
        </div>
      )}

      {consent && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            Statut actuel
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Consentement donné le :</strong> {formatDate(consent.timestamp)}
          </p>
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Expire le :</strong> {getExpiryDate(consent.timestamp)}
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          À propos des cookies
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Conformément au Règlement Général sur la Protection des Données (RGPD) et à la
          réglementation française, nous vous informons sur l'utilisation des cookies sur notre site.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Votre consentement est valable pendant 6 mois. Vous pouvez modifier vos préférences
          à tout moment sur cette page.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        {/* Cookies nécessaires */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Cookies nécessaires
              </h3>
              <span className="inline-block text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded mb-2">
                Toujours actifs
              </span>
            </div>
            <div className="ml-4">
              <span className="text-2xl">🔒</span>
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            Ces cookies sont essentiels au fonctionnement du site. Ils permettent l'authentification,
            la sécurité, et la navigation de base. Ils ne peuvent pas être désactivés.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <strong>Exemples :</strong> Session utilisateur, tokens CSRF, préférences de langue
          </p>
        </div>

        {/* Cookies fonctionnels */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Cookies fonctionnels
              </h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences[COOKIE_CATEGORIES.FUNCTIONAL]}
                onChange={() => handleToggleCategory(COOKIE_CATEGORIES.FUNCTIONAL)}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            Ces cookies améliorent l'expérience utilisateur en mémorisant vos choix et préférences
            (thème, mise en page, options d'affichage).
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <strong>Exemples :</strong> Préférences d'interface, paramètres d'affichage
          </p>
        </div>

        {/* Cookies analytiques */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Cookies analytiques
              </h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences[COOKIE_CATEGORIES.ANALYTICS]}
                onChange={() => handleToggleCategory(COOKIE_CATEGORIES.ANALYTICS)}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            Ces cookies nous aident à comprendre comment vous utilisez notre site pour l'améliorer.
            Les données sont anonymisées et agrégées.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <strong>Exemples :</strong> Pages visitées, temps passé, parcours utilisateur
          </p>
        </div>

        {/* Cookies marketing */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Cookies marketing
              </h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences[COOKIE_CATEGORIES.MARKETING]}
                onChange={() => handleToggleCategory(COOKIE_CATEGORIES.MARKETING)}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            Ces cookies sont utilisés pour vous proposer des contenus publicitaires personnalisés
            en fonction de vos centres d'intérêt.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <strong>Exemples :</strong> Suivi publicitaire, remarketing
          </p>
        </div>
      </div>

      {/* Boutons d'action */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <button
          onClick={handleSave}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
        >
          Enregistrer mes préférences
        </button>
        <button
          onClick={handleAcceptAll}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
        >
          Tout accepter
        </button>
        <button
          onClick={handleRejectAll}
          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
        >
          Tout refuser
        </button>
      </div>

      <div className="text-center">
        <button
          onClick={handleReset}
          className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 underline"
        >
          Réinitialiser le consentement
        </button>
      </div>

      {/* Informations légales */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          Vos droits
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
          Conformément au RGPD, vous disposez des droits suivants :
        </p>
        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 list-disc list-inside">
          <li>Droit d'accès à vos données personnelles</li>
          <li>Droit de rectification de vos données</li>
          <li>Droit à l'effacement de vos données</li>
          <li>Droit d'opposition au traitement de vos données</li>
          <li>Droit à la portabilité de vos données</li>
          <li>Droit de retirer votre consentement à tout moment</li>
        </ul>
      </div>
    </div>
  );
}