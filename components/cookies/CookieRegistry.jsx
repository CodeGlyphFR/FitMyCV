'use client';

import { COOKIE_REGISTRY, getCookiesByCategory } from '@/lib/cookies/registry';
import { COOKIE_CATEGORIES } from '@/lib/cookies/consent';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useState, useRef } from 'react';

export default function CookieRegistry() {
  const { t } = useLanguage();
  const [expandedCategory, setExpandedCategory] = useState(null);
  const scrollPositionRef = useRef(0);

  const categories = [
    { key: COOKIE_CATEGORIES.NECESSARY, icon: '🔒' },
    { key: COOKIE_CATEGORIES.FUNCTIONAL, icon: '⚙️' },
    { key: COOKIE_CATEGORIES.ANALYTICS, icon: '📊' },
    { key: COOKIE_CATEGORIES.MARKETING, icon: '📢' }
  ];

  const toggleCategory = (category) => {
    scrollPositionRef.current = window.scrollY;
    setExpandedCategory(expandedCategory === category ? null : category);
    // Restaurer la position après le re-render
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollPositionRef.current, behavior: 'instant' });
    });
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
    <div className="mt-8 bg-white/15 backdrop-blur-xl rounded-lg shadow-2xl p-6">
      <h2 className="text-xl font-semibold mb-4 text-emerald-300 drop-shadow">
        {t('cookies.registry.title')}
      </h2>
      <p className="text-sm text-white/90 mb-4 drop-shadow">
        {t('cookies.registry.description')}
      </p>

      <div className="space-y-2">
        {categories.map(({ key, icon }) => {
          const cookies = getCookiesByCategory(key);
          const isExpanded = expandedCategory === key;

          return (
            <div key={key} className="rounded-lg overflow-hidden backdrop-blur-sm">
              <button
                onClick={() => toggleCategory(key)}
                className="w-full flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl drop-shadow">{icon}</span>
                  <div className="text-left">
                    <h3 className="font-semibold text-white drop-shadow">
                      {getCategoryLabel(key)}
                    </h3>
                    <p className="text-xs text-white/60 drop-shadow">
                      {cookies.length} cookie{cookies.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 text-white/70 transition-transform drop-shadow ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isExpanded && (
                <div className="p-4 bg-white/5 backdrop-blur-sm">
                  <div className="space-y-4">
                    {cookies.map((cookie, index) => (
                      <div
                        key={index}
                        className="p-3 bg-white/10 backdrop-blur-sm rounded"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-mono text-sm font-semibold text-emerald-300 drop-shadow">
                            {cookie.name}
                          </h4>
                          <span className={`text-xs px-2 py-0.5 rounded drop-shadow ${
                            cookie.provider.toLowerCase().includes('third-party')
                              ? 'bg-orange-500/20 text-white'
                              : 'bg-emerald-500/20 text-white'
                          }`}>
                            {cookie.provider}
                          </span>
                        </div>
                        <p className="text-sm text-white/90 mb-2 drop-shadow">
                          {t(`cookies.registry.purposes.${cookie.purpose}`)}
                        </p>
                        <div className="flex flex-wrap gap-3 text-xs text-white/70 drop-shadow">
                          <div className="flex items-center gap-1">
                            <span className="font-semibold">⏱️ {t('cookies.registry.duration')}</span>
                            <span>{t(`cookies.registry.durations.${cookie.duration}`)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-semibold">💾 {t('cookies.registry.type')}</span>
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

      <div className="mt-4 p-3 bg-emerald-500/20 backdrop-blur-sm rounded text-sm">
        <p className="text-white drop-shadow">
          <strong>ℹ️ Note:</strong> {t('cookies.registry.note')}
        </p>
      </div>
    </div>
  );
}
