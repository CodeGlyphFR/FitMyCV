'use client';

import { COOKIE_REGISTRY, getCookiesByCategory } from '@/lib/cookies/registry';
import { COOKIE_CATEGORIES } from '@/lib/cookies/consent';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useState } from 'react';

export default function CookieRegistry() {
  const { t } = useLanguage();
  const [expandedCategory, setExpandedCategory] = useState(null);

  const categories = [
    { key: COOKIE_CATEGORIES.NECESSARY, icon: '🔒' },
    { key: COOKIE_CATEGORIES.FUNCTIONAL, icon: '⚙️' },
    { key: COOKIE_CATEGORIES.ANALYTICS, icon: '📊' },
    { key: COOKIE_CATEGORIES.MARKETING, icon: '📢' }
  ];

  const toggleCategory = (category) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  const getCategoryLabel = (category) => {
    const labels = {
      [COOKIE_CATEGORIES.NECESSARY]: t('cookies.settings.necessary.title'),
      [COOKIE_CATEGORIES.FUNCTIONAL]: t('cookies.settings.functional.title'),
      [COOKIE_CATEGORIES.ANALYTICS]: t('cookies.settings.analytics.title'),
      [COOKIE_CATEGORIES.MARKETING]: t('cookies.settings.marketing.title'),
    };
    return labels[category] || category;
  };

  return (
    <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
        📋 Registre détaillé des cookies
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Liste complète de tous les cookies susceptibles d'être utilisés sur ce site, par catégorie.
      </p>

      <div className="space-y-2">
        {categories.map(({ key, icon }) => {
          const cookies = getCookiesByCategory(key);
          const isExpanded = expandedCategory === key;

          return (
            <div key={key} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleCategory(key)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{icon}</span>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {getCategoryLabel(key)}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {cookies.length} cookie{cookies.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isExpanded && (
                <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                  <div className="space-y-4">
                    {cookies.map((cookie, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                            {cookie.name}
                          </h4>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            cookie.provider.toLowerCase().includes('third-party')
                              ? 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
                              : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                          }`}>
                            {cookie.provider}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                          {cookie.purpose}
                        </p>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <span className="font-semibold">⏱️ Durée:</span>
                            <span>{cookie.duration}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-semibold">💾 Type:</span>
                            <span>{cookie.type}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm">
        <p className="text-blue-800 dark:text-blue-300">
          <strong>ℹ️ Note:</strong> Les cookies tiers ne seront déposés que si vous donnez votre consentement explicite.
          Les cookies nécessaires sont essentiels au fonctionnement du site et ne peuvent être refusés.
        </p>
      </div>
    </div>
  );
}
