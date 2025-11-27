"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function AccountPageLoading() {
  const { t } = useLanguage();

  return (
    <div className="text-center py-4 text-white/70">
      {t('account.loading')}
    </div>
  );
}
