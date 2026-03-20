"use client";

import React from "react";
import { Tag, Copy, Check } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function PromoBanner({ promoData }) {
  const { t } = useLanguage();
  const [copied, setCopied] = React.useState(false);

  if (!promoData?.active || !promoData.code) return null;

  const discount = promoData.percentOff ?? promoData.amountOff ?? 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promoData.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silencieux
    }
  };

  return (
    <div className="relative overflow-hidden backdrop-blur-md bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border border-emerald-500/50 rounded-xl p-4 shadow-lg">
      {/* Background decoration */}
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-emerald-400/10 rounded-full blur-2xl" />
      <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-cyan-400/10 rounded-full blur-2xl" />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Tag */}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/30 text-emerald-200 text-xs font-semibold uppercase tracking-wide">
          <Tag className="w-3.5 h-3.5" />
          {t("subscription.promo.tag")}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0 text-center">
          <p className="text-white font-semibold text-sm sm:text-base">
            {t("subscription.promo.title").replace("{discount}", String(discount))}
          </p>
          <p className="text-white/60 text-xs mt-0.5">
            {t("subscription.promo.instruction")}
          </p>
        </div>

        {/* Code + Copy button */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition-colors cursor-pointer group"
        >
          <code className="text-emerald-300 font-mono font-bold text-sm tracking-wider">
            {promoData.code}
          </code>
          {copied ? (
            <span className="flex items-center gap-1 text-emerald-400 text-xs">
              <Check className="w-3.5 h-3.5" />
              {t("subscription.promo.copied")}
            </span>
          ) : (
            <Copy className="w-3.5 h-3.5 text-white/50 group-hover:text-white/80 transition-colors" />
          )}
        </button>
      </div>
    </div>
  );
}
