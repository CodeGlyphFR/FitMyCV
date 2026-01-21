"use client";

import React from "react";
import { createPortal } from "react-dom";
import DefaultCvIcon from "@/components/ui/DefaultCvIcon";
import { getCvIcon } from "../utils/cvUtils";
import { emitOnboardingEvent, ONBOARDING_EVENTS } from "@/lib/onboarding/onboardingEvents";
import ItemLabel from "./ItemLabel";

/**
 * Composant portal pour le dropdown de sélection de CV
 */
export default function CvDropdownPortal({
  listOpen,
  portalReady,
  dropdownRect,
  dropdownPortalRef,
  filteredItems,
  hasActiveFilters,
  current,
  currentStep,
  onboardingState,
  recentlyGeneratedCv,
  setRecentlyGeneratedCv,
  tickerResetKey,
  isScrollingInDropdown,
  setIsScrollingInDropdown,
  selectFile,
  setListOpen,
  t
}) {
  if (!listOpen || !portalReady || !dropdownRect) return null;

  return createPortal(
    <div
      ref={dropdownPortalRef}
      style={{
        position: "fixed",
        top: dropdownRect.bottom + 4,
        left: dropdownRect.left,
        width: dropdownRect.width,
        zIndex: 10002,
        opacity: 1,
      }}
      className="rounded-lg border border-white/30 bg-white/15 backdrop-blur-md shadow-2xl cv-dropdown-no-animation"
    >
      <ul
        className="max-h-[240px] overflow-y-auto custom-scrollbar py-1"
        onScroll={() => setIsScrollingInDropdown(true)}
        onScrollEnd={() => setTimeout(() => setIsScrollingInDropdown(false), 100)}
        onWheel={(e) => {
          const target = e.currentTarget;
          const isAtTop = target.scrollTop === 0;
          const isAtBottom = target.scrollTop + target.clientHeight >= target.scrollHeight;

          if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
            return;
          }
          e.stopPropagation();
        }}
      >
        {filteredItems.length === 0 && hasActiveFilters ? (
          <li className="px-3 py-3 text-sm text-white/60 text-center italic">
            {t("topbar.filterNoResults")}
          </li>
        ) : (
          filteredItems.map((it) => {
            const isRecentlyGenerated = recentlyGeneratedCv && it.file === recentlyGeneratedCv;
            const isOnboardingStep4Cv = currentStep === 4 && it.file === onboardingState?.step4?.cvFilename;

            return (
              <li key={it.file}>
                <button
                  type="button"
                  data-cv-filename={it.file}
                  onClick={async () => {
                    if (isRecentlyGenerated || isOnboardingStep4Cv) {
                      emitOnboardingEvent(ONBOARDING_EVENTS.GENERATED_CV_OPENED, {
                        cvFilename: it.file
                      });
                      if (isRecentlyGenerated) {
                        setRecentlyGeneratedCv(null);
                      }
                    }

                    await selectFile(it.file);
                    setListOpen(false);
                  }}
                  className={`w-full px-3 py-1 text-left text-sm flex items-center gap-3 hover:bg-white/25 text-white transition-colors duration-200 ${
                    it.file === current
                      ? "bg-white/20 border-l-2 border-emerald-400"
                      : ""
                  } ${
                    isRecentlyGenerated
                      ? "bg-emerald-500/30 border border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.4)] animate-pulse"
                      : isOnboardingStep4Cv
                      ? "bg-emerald-500/20"
                      : ""
                  }`}
                >
                  <span
                    key={`dropdown-icon-${it.file}-${it.createdBy}`}
                    className="flex h-6 w-6 items-center justify-center shrink-0"
                  >
                    {getCvIcon(it.createdBy, it.originalCreatedBy, "h-4 w-4", it.isTranslated) || <DefaultCvIcon className="h-4 w-4" size={16} />}
                  </span>
                  <ItemLabel
                    item={it}
                    className="leading-tight"
                    tickerKey={tickerResetKey}
                    withHyphen={false}
                    t={t}
                  />
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>,
    document.body
  );
}
