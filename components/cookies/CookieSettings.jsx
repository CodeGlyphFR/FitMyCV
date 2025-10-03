'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { useLanguage } from '@/lib/i18n/LanguageContext';
import CookieRegistry from './CookieRegistry';
import ConsentHistory from './ConsentHistory';

export default function CookieSettings() {
  const { t } = useLanguage();
  const router = useRouter();
  const [consent, setConsent] = useState(null);
  const [preferences, setPreferences] = useState(DEFAULT_CONSENT);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const currentConsent = getConsent();
    setConsent(currentConsent);
    if (currentConsent) {
      // Ne garder que les catégories de cookies (sans timestamp et version)
      const cleanPreferences = {
        [COOKIE_CATEGORIES.NECESSARY]: currentConsent[COOKIE_CATEGORIES.NECESSARY] ?? true,
        [COOKIE_CATEGORIES.FUNCTIONAL]: currentConsent[COOKIE_CATEGORIES.FUNCTIONAL] ?? false,
        [COOKIE_CATEGORIES.ANALYTICS]: currentConsent[COOKIE_CATEGORIES.ANALYTICS] ?? false,
        [COOKIE_CATEGORIES.MARKETING]: currentConsent[COOKIE_CATEGORIES.MARKETING] ?? false,
      };
      setPreferences(cleanPreferences);
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
    // Marquer qu'on veut scroller en haut après navigation
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('scrollToTop', 'true');
    }
    // Retour à la page précédente après un court délai
    setTimeout(() => {
      router.back();
    }, 1000);
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
    if (!timestamp) return '-';
    const locale = t('common.locale');
    return new Date(timestamp).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getExpiryDate = (timestamp) => {
    if (!timestamp) return '-';
    const locale = t('common.locale');
    return new Date(timestamp + CONSENT_DURATION).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleBack = () => {
    // Marquer qu'on veut scroller en haut après navigation
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('scrollToTop', 'true');
    }
    router.back();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button
        onClick={handleBack}
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4 transition-colors"
      >
        <span>←</span>
        <span>Retour</span>
      </button>

      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        {t('cookies.settings.pageTitle')}
      </h1>

      {saved && (
        <div className="mb-6 p-4 bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-700 text-green-800 dark:text-green-200 rounded-lg">
          ✓ {t('cookies.settings.saved')}
        </div>
      )}

      {consent && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            {t('cookies.settings.currentStatus')}
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>{t('cookies.settings.consentGiven')}</strong> {formatDate(consent.timestamp)}
          </p>
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>{t('cookies.settings.expiresOn')}</strong> {getExpiryDate(consent.timestamp)}
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          {t('cookies.settings.aboutTitle')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {t('cookies.settings.aboutDescription')}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('cookies.settings.consentValidity')}
        </p>
      </div>

      <div className="space-y-4 mb-6">
        {/* Cookies nécessaires */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t('cookies.settings.necessary.title')}
              </h3>
              <span className="inline-block text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded mb-2">
                {t('cookies.settings.necessary.alwaysActive')}
              </span>
            </div>
            <div className="ml-4">
              <span className="text-2xl">🔒</span>
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            {t('cookies.settings.necessary.description')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <strong>{t('cookies.settings.examplesLabel')}</strong> {t('cookies.settings.necessary.examples')}
          </p>
        </div>

        {/* Cookies fonctionnels */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t('cookies.settings.functional.title')}
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
            {t('cookies.settings.functional.description')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <strong>{t('cookies.settings.examplesLabel')}</strong> {t('cookies.settings.functional.examples')}
          </p>
        </div>

        {/* Cookies analytiques */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t('cookies.settings.analytics.title')}
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
            {t('cookies.settings.analytics.description')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <strong>{t('cookies.settings.examplesLabel')}</strong> {t('cookies.settings.analytics.examples')}
          </p>
        </div>

        {/* Cookies marketing */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t('cookies.settings.marketing.title')}
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
            {t('cookies.settings.marketing.description')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <strong>{t('cookies.settings.examplesLabel')}</strong> {t('cookies.settings.marketing.examples')}
          </p>
        </div>
      </div>

      {/* Boutons d'action */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <button
          onClick={handleSave}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
        >
          {t('cookies.settings.savePreferences')}
        </button>
        <button
          onClick={handleAcceptAll}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
        >
          {t('cookies.settings.acceptAll')}
        </button>
        <button
          onClick={handleRejectAll}
          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
        >
          {t('cookies.settings.rejectAll')}
        </button>
      </div>

      <div className="text-center">
        <button
          onClick={handleReset}
          className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 underline"
        >
          {t('cookies.settings.resetConsent')}
        </button>
      </div>

      {/* Registre détaillé des cookies */}
      <CookieRegistry />

      {/* Historique des consentements */}
      <ConsentHistory />

      {/* Informations légales */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          {t('cookies.settings.yourRights')}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
          {t('cookies.settings.rightsDescription')}
        </p>
        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 list-disc list-inside">
          <li>{t('cookies.settings.rights.access')}</li>
          <li>{t('cookies.settings.rights.rectification')}</li>
          <li>{t('cookies.settings.rights.erasure')}</li>
          <li>{t('cookies.settings.rights.objection')}</li>
          <li>{t('cookies.settings.rights.portability')}</li>
          <li>{t('cookies.settings.rights.withdraw')}</li>
        </ul>
      </div>
    </div>
  );
}