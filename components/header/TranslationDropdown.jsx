"use client";

import Image from "next/image";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useCreditCost } from "@/hooks/useCreditCost";
import CreditCostTooltip from "@/components/ui/CreditCostTooltip";
import { SUPPORTED_LANGUAGES, LANGUAGE_FLAGS, LANGUAGE_LABELS, DEFAULT_LANGUAGE } from "@/lib/cv-core/language/languageConstants";

/**
 * Translation dropdown component for translating CVs
 */
export function TranslationDropdown({
  isOpen,
  setIsOpen,
  dropdownRef,
  executeTranslation,
  cvLanguage,
}) {
  const { t } = useLanguage();
  const { showCosts, getCost } = useCreditCost();
  const translateCost = getCost("translate_cv");

  const availableLanguages = Object.values(SUPPORTED_LANGUAGES)
    .map(code => ({
      code,
      flag: LANGUAGE_FLAGS[code],
      label: LANGUAGE_LABELS[code]
    }))
    .filter(lang => lang.code !== (cvLanguage || DEFAULT_LANGUAGE));

  return (
    <div ref={dropdownRef} className="relative">
      {/* Options de langue - apparaissent à gauche du bouton quand ouvert */}
      <div
        className={`
          absolute right-full top-0 mr-2
          flex flex-row gap-2
          transition-all duration-300 ease-out origin-right
          ${isOpen ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-75 translate-x-2 pointer-events-none'}
        `}
      >
        {availableLanguages.map((lang, index) => (
          <CreditCostTooltip
            key={lang.code}
            cost={translateCost}
            show={showCosts}
            position="bottom"
          >
            <button
              onClick={() => executeTranslation(lang.code)}
              className={`
                w-8 h-8 rounded-full
                bg-white/20 backdrop-blur-xl border-2 border-white/30 shadow-2xl
                flex items-center justify-center
                overflow-hidden
                hover:shadow-sm-xl hover:bg-white/30
                transition-all duration-200
                cursor-pointer
                p-0.5
              `}
              style={{
                transitionDelay: isOpen ? `${index * 50}ms` : '0ms'
              }}
              title={`Traduire en ${lang.label}`}
              aria-label={`Traduire en ${lang.label}`}
              type="button"
            >
              <Image
                src={lang.flag}
                alt={lang.label}
                width={24}
                height={24}
                className="object-cover"
              />
            </button>
          </CreditCostTooltip>
        ))}
      </div>

      {/* Bouton principal de traduction */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-8 h-8 rounded-full
          bg-white/20 backdrop-blur-xl border-2 border-white/30 shadow-2xl
          flex items-center justify-center
          hover:shadow-sm-xl hover:bg-white/30
          transition-all duration-300
          cursor-pointer
          ${isOpen ? 'shadow-xl' : ''}
        `}
        title={t("translate.buttonTitle")}
        aria-label="Traduire le CV"
        aria-expanded={isOpen}
        type="button"
      >
        <img
          src={LANGUAGE_FLAGS[cvLanguage] || LANGUAGE_FLAGS[DEFAULT_LANGUAGE]}
          alt={LANGUAGE_LABELS[cvLanguage] || LANGUAGE_LABELS[DEFAULT_LANGUAGE]}
          className="h-6 w-6"
        />
      </button>
    </div>
  );
}
