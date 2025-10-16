'use client';

import { useState, useEffect, useRef } from 'react';
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
  const scrollPositionRef = useRef(0);

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

  // Restaurer la position du scroll après les changements d'état
  useEffect(() => {
    if (saved && scrollPositionRef.current > 0) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollPositionRef.current, behavior: 'instant' });
      });
    }
  }, [saved]);

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
    scrollPositionRef.current = window.scrollY;
    const allAccepted = acceptAllCookies();
    setPreferences(allAccepted);
    setConsent(allAccepted);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleRejectAll = () => {
    scrollPositionRef.current = window.scrollY;
    const allRejected = rejectAllCookies();
    setPreferences(allRejected);
    setConsent(allRejected);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    scrollPositionRef.current = window.scrollY;
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
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-40 h-80 w-80 rounded-full bg-gradient-to-br from-emerald-400/90 via-sky-500/70 to-transparent blur-2xl animate-auth-blob-fast"/>
        <div className="absolute top-[20%] right-[-140px] h-96 w-96 rounded-full bg-gradient-to-br from-sky-500/70 via-emerald-400/50 to-transparent blur-3xl animate-auth-blob animation-delay-1500"/>
        <div className="absolute bottom-[-180px] left-[10%] h-[420px] w-[420px] rounded-full bg-gradient-to-br from-emerald-500/55 via-sky-400/35 to-transparent blur-[150px] animate-auth-blob-slow animation-delay-6000"/>
        <div className="absolute top-[55%] right-[15%] h-56 w-56 rounded-full bg-gradient-to-br from-sky-400/50 via-emerald-300/40 to-transparent blur-2xl animate-auth-blob-fast animation-delay-3000"/>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(126,207,244,0.25),_transparent_65%)]"/>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto p-6">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white mb-4 transition-colors drop-shadow"
        >
          <span>←</span>
          <span>Retour</span>
        </button>

        <h1 className="text-3xl font-bold mb-6 text-white drop-shadow-lg">
          {t('cookies.settings.pageTitle')}
        </h1>

        {saved && (
          <div className="mb-6 p-4 bg-emerald-500/20 backdrop-blur-xl text-white rounded-lg drop-shadow">
            ✓ {t('cookies.settings.saved')}
          </div>
        )}

        {consent && (
          <div className="mb-6 p-4 bg-white/15 backdrop-blur-xl rounded-lg shadow-2xl">
            <h3 className="font-semibold text-emerald-300 mb-2 drop-shadow">
              {t('cookies.settings.currentStatus')}
            </h3>
            <p className="text-sm text-white drop-shadow">
              <strong>{t('cookies.settings.consentGiven')}</strong> {formatDate(consent.timestamp)}
            </p>
            <p className="text-sm text-white drop-shadow">
              <strong>{t('cookies.settings.expiresOn')}</strong> {getExpiryDate(consent.timestamp)}
            </p>
          </div>
        )}

        <div className="bg-white/15 backdrop-blur-xl rounded-lg shadow-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-emerald-300 drop-shadow">
            {t('cookies.settings.aboutTitle')}
          </h2>
          <p className="text-sm text-white/90 mb-4 drop-shadow">
            {t('cookies.settings.aboutDescription')}
          </p>
          <p className="text-sm text-white/90 drop-shadow">
            {t('cookies.settings.consentValidity')}
          </p>
        </div>

        <div className="space-y-4 mb-6">
          {/* Cookies nécessaires */}
          <div className="bg-white/15 backdrop-blur-xl rounded-lg shadow-2xl p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-emerald-300 mb-2 drop-shadow">
                  {t('cookies.settings.necessary.title')}
                </h3>
                <span className="inline-block text-xs bg-emerald-500/30 text-white px-2 py-1 rounded mb-2 drop-shadow">
                  {t('cookies.settings.necessary.alwaysActive')}
                </span>
              </div>
              <div className="ml-4">
                <span className="text-2xl drop-shadow">🔒</span>
              </div>
            </div>
            <p className="text-sm text-white/90 mb-3 drop-shadow">
              {t('cookies.settings.necessary.description')}
            </p>
            <p className="text-xs text-white/70 drop-shadow">
              <strong>{t('cookies.settings.examplesLabel')}</strong> {t('cookies.settings.necessary.examples')}
            </p>
          </div>

          {/* Cookies fonctionnels */}
          <div className="bg-white/15 backdrop-blur-xl rounded-lg shadow-2xl p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-emerald-300 mb-2 drop-shadow">
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
                <div className="w-14 h-7 bg-white/20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-400/50 rounded-full peer backdrop-blur-sm peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-1/2 after:-translate-y-1/2 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-400"></div>
              </label>
            </div>
            <p className="text-sm text-white/90 mb-3 drop-shadow">
              {t('cookies.settings.functional.description')}
            </p>
            <p className="text-xs text-white/70 drop-shadow">
              <strong>{t('cookies.settings.examplesLabel')}</strong> {t('cookies.settings.functional.examples')}
            </p>
          </div>

          {/* Cookies analytiques */}
          <div className="bg-white/15 backdrop-blur-xl rounded-lg shadow-2xl p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-emerald-300 mb-2 drop-shadow">
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
                <div className="w-14 h-7 bg-white/20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-400/50 rounded-full peer backdrop-blur-sm peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-1/2 after:-translate-y-1/2 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-400"></div>
              </label>
            </div>
            <p className="text-sm text-white/90 mb-3 drop-shadow">
              {t('cookies.settings.analytics.description')}
            </p>
            <p className="text-xs text-white/70 drop-shadow">
              <strong>{t('cookies.settings.examplesLabel')}</strong> {t('cookies.settings.analytics.examples')}
            </p>
          </div>

          {/* Cookies marketing */}
          <div className="bg-white/15 backdrop-blur-xl rounded-lg shadow-2xl p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-emerald-300 mb-2 drop-shadow">
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
                <div className="w-14 h-7 bg-white/20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-400/50 rounded-full peer backdrop-blur-sm peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-1/2 after:-translate-y-1/2 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-400"></div>
              </label>
            </div>
            <p className="text-sm text-white/90 mb-3 drop-shadow">
              {t('cookies.settings.marketing.description')}
            </p>
            <p className="text-xs text-white/70 drop-shadow">
              <strong>{t('cookies.settings.examplesLabel')}</strong> {t('cookies.settings.marketing.examples')}
            </p>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <button
            onClick={handleSave}
            className="flex-1 bg-emerald-500/30 hover:bg-emerald-500/40 backdrop-blur-sm text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 drop-shadow"
          >
            {t('cookies.settings.savePreferences')}
          </button>
          <button
            onClick={handleAcceptAll}
            className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 drop-shadow"
          >
            {t('cookies.settings.acceptAll')}
          </button>
          <button
            onClick={handleRejectAll}
            className="flex-1 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 drop-shadow"
          >
            {t('cookies.settings.rejectAll')}
          </button>
        </div>

        <div className="text-center">
          <button
            onClick={handleReset}
            className="text-sm text-red-300 hover:text-red-200 underline drop-shadow"
          >
            {t('cookies.settings.resetConsent')}
          </button>
        </div>

      {/* Registre détaillé des cookies */}
      <CookieRegistry />

      {/* Historique des consentements */}
      <ConsentHistory />

        {/* Informations légales */}
        <div className="mt-8 p-4 bg-white/10 backdrop-blur-sm rounded-lg">
          <h3 className="font-semibold text-emerald-300 mb-2 drop-shadow">
            {t('cookies.settings.yourRights')}
          </h3>
          <p className="text-sm text-white/90 mb-2 drop-shadow">
            {t('cookies.settings.rightsDescription')}
          </p>
          <ul className="text-sm text-white/90 space-y-1 list-disc list-inside drop-shadow">
            <li>{t('cookies.settings.rights.access')}</li>
            <li>{t('cookies.settings.rights.rectification')}</li>
            <li>{t('cookies.settings.rights.erasure')}</li>
            <li>{t('cookies.settings.rights.objection')}</li>
            <li>{t('cookies.settings.rights.portability')}</li>
            <li>{t('cookies.settings.rights.withdraw')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}