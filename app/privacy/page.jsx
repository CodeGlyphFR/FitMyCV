'use client';

import { useLanguage } from '@/lib/i18n/LanguageContext';
import PrivacyContentFR from '@/lib/legal/privacy/fr';
import PrivacyContentEN from '@/lib/legal/privacy/en';

export default function PrivacyPage() {
  const { t, language } = useLanguage();
  const PrivacyContent = language === 'en' ? PrivacyContentEN : PrivacyContentFR;

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto p-4">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white mb-3 transition-colors drop-shadow"
        >
          <span>←</span>
          <span>{t('legal.back')}</span>
        </a>

        <h1 className="text-2xl font-bold mb-4 text-white drop-shadow-lg">
          {t('legal.privacy.title')}
        </h1>

        <PrivacyContent />
      </div>
    </div>
  );
}
