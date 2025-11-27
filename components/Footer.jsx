"use client";
import Link from 'next/link';
import packageInfo from '../package.json';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="w-full text-center text-xs pt-4 pb-20 min-h-[56px] flex items-center justify-center">
      <div className="text-white/70 space-y-2">
        <div>{t('footer.copyright')} (v{packageInfo.version})</div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-0 sm:gap-1 leading-none -space-y-3 sm:space-y-0">
          <div className="flex items-baseline justify-center gap-1 leading-none">
            <Link href="/about" className="hover:text-white transition-colors">
              {t('footer.about')}
            </Link>
            <span className="text-white/40">•</span>
            <Link href="/cookies" className="hover:text-white transition-colors">
              {t('footer.cookies')}
            </Link>
            <span className="text-white/40 hidden sm:inline">•</span>
          </div>
          <div className="flex items-baseline justify-center gap-1 leading-none">
            <Link href="/terms" className="hover:text-white transition-colors">
              {t('footer.terms')}
            </Link>
            <span className="text-white/40">•</span>
            <Link href="/privacy" className="hover:text-white transition-colors">
              {t('footer.privacy')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}