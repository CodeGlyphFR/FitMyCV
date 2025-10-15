"use client";
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import packageInfo from '../package.json';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function Footer({ showLogout = false }) {
  const { t } = useLanguage();

  return (
    <footer className="w-full text-center text-sm pt-4 pb-8 min-h-[56px] flex items-center justify-center">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
        <span className="text-white/70">Version {packageInfo.version}</span>
        <span className="hidden sm:inline text-white/70">•</span>
        <Link
          href="/cookies"
          className="text-white/70 hover:text-white underline transition-colors"
        >
          {t("footer.cookieManagement")}
        </Link>
        <span className="hidden sm:inline text-white/70">•</span>
        <Link
          href="/privacy"
          className="text-white/70 hover:text-white underline transition-colors"
        >
          Confidentialité
        </Link>
        {showLogout && (
          <>
            <span className="hidden sm:inline text-white/70">•</span>
            <button
              onClick={() => signOut({ callbackUrl: '/auth' })}
              className="text-white/70 hover:text-white underline transition-colors"
            >
              {t("topbar.logout")}
            </button>
          </>
        )}
      </div>
    </footer>
  );
}