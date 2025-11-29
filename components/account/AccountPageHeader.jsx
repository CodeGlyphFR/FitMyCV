"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function AccountPageHeader() {
  const { t } = useLanguage();

  return (
    <div className="space-y-1">
      <a
        href="/"
        className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white mb-4 transition-colors drop-shadow"
      >
        <span>←</span>
        <span>{t('account.backToCvs')}</span>
      </a>
      <h1 className="text-2xl font-semibold text-white drop-shadow-lg">
        {t('account.title')}
      </h1>
      <p className="text-sm text-white/70 drop-shadow">
        {t('account.subtitle')}
      </p>
    </div>
  );
}
