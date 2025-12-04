'use client';

import { useLanguage } from '@/lib/i18n/LanguageContext';
import AboutContentFR from '@/lib/about/fr';
import AboutContentEN from '@/lib/about/en';
import AboutContentES from '@/lib/about/es';
import AboutContentDE from '@/lib/about/de';

const contentByLanguage = {
  fr: AboutContentFR,
  en: AboutContentEN,
  es: AboutContentES,
  de: AboutContentDE,
};

export default function AboutPage() {
  const { t, language } = useLanguage();
  const AboutContent = contentByLanguage[language] || AboutContentFR;

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto p-4">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white mb-3 transition-colors drop-shadow"
        >
          <span>&larr;</span>
          <span>{t('legal.back')}</span>
        </a>

        <h1 className="text-2xl font-bold mb-4 text-white drop-shadow-lg">
          {t('about.title')}
        </h1>

        <AboutContent />
      </div>
    </div>
  );
}
