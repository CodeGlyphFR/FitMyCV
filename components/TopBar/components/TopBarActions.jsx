"use client";

import React, { useRef } from "react";
import GptLogo from "@/components/ui/GptLogo";
import CreditCounter from "@/components/ui/CreditCounter";

/**
 * Composant pour les boutons d'action du TopBar
 */
export default function TopBarActions({
  settings,
  generator,
  modals,
  exportModal,
  creditsOnlyMode,
  subscriptionLoading,
  creditBalance,
  creditRatio,
  t
}) {
  // Long press refs pour le bouton de suppression (mobile)
  const deleteLongPressTimerRef = useRef(null);
  const deleteIsLongPressRef = useRef(false);

  return (
    <>
      {/* AI Generate Button */}
      {settings.feature_ai_generation && (
        <button
          data-onboarding="ai-generate"
          onClick={generator.openGeneratorModal}
          className="rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm text-white text-sm hover:bg-white/30 hover:shadow-sm-xl inline-flex items-center justify-center leading-none h-8 w-8 order-8 md:order-5 transition-all duration-200"
          type="button"
        >
          <GptLogo className="h-4 w-4" />
        </button>
      )}

      {/* New CV Button */}
      {settings.feature_manual_cv && (
        <button
          onClick={() => modals.setOpenNewCv(true)}
          className="rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm text-white text-sm hover:bg-white/30 hover:shadow-sm-xl inline-flex items-center justify-center h-8 w-8 order-9 md:order-6 transition-all duration-200"
          type="button"
        >
          <img src="/icons/add.png" alt="Add" className="h-4 w-4" />
        </button>
      )}

      {/* Import Button */}
      {settings.feature_import && (
        <button
          onClick={() => modals.setOpenPdfImport(true)}
          className="rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm text-white text-sm hover:bg-white/30 hover:shadow-sm-xl inline-flex items-center justify-center leading-none h-8 w-8 order-10 md:order-7 transition-all duration-200"
          type="button"
          title={t("pdfImport.title")}
        >
          <img src="/icons/import.png" alt="Import" className="h-4 w-4" />
        </button>
      )}

      {/* Export Button */}
      {settings.feature_export && (
        <button
          data-onboarding="export"
          onClick={exportModal.openModal}
          className="rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm text-white text-sm hover:bg-white/30 hover:shadow-sm-xl inline-flex items-center justify-center leading-none h-8 w-8 order-11 md:order-8 transition-all duration-200"
          type="button"
          title="Exporter en PDF"
        >
          <img src="/icons/export.png" alt="Export" className="h-4 w-4" />
        </button>
      )}

      {/* Delete Button */}
      <button
        onTouchStart={() => {
          deleteIsLongPressRef.current = false;
          deleteLongPressTimerRef.current = setTimeout(() => {
            deleteIsLongPressRef.current = true;
            modals.setOpenBulkDelete(true);
          }, 1000);
        }}
        onTouchEnd={() => clearTimeout(deleteLongPressTimerRef.current)}
        onTouchMove={() => {
          clearTimeout(deleteLongPressTimerRef.current);
          deleteIsLongPressRef.current = false;
        }}
        onTouchCancel={() => {
          clearTimeout(deleteLongPressTimerRef.current);
          deleteIsLongPressRef.current = false;
        }}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => {
          if (deleteIsLongPressRef.current) {
            deleteIsLongPressRef.current = false;
            return;
          }
          if (e.ctrlKey || e.metaKey) {
            modals.setOpenBulkDelete(true);
          } else {
            modals.setOpenDelete(true);
          }
        }}
        className="rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm text-white text-sm hover:bg-white/30 hover:shadow-sm-xl inline-flex items-center justify-center h-8 w-8 order-12 md:order-9 transition-all duration-200 select-none"
        style={{ WebkitTouchCallout: 'none' }}
        title={t("topbar.delete")}
      >
        <img src="/icons/delete.png" alt="Delete" className="h-4 w-4 pointer-events-none select-none" draggable="false" />
      </button>

      {/* Credits Counter - Mode crédits-only uniquement */}
      {creditsOnlyMode && !subscriptionLoading && (
        <div className="order-5 md:order-11">
          <CreditCounter
            balance={creditBalance}
            ratio={creditRatio}
            onClick={() => { window.location.href = '/account/subscriptions?tab=credits'; }}
            title={`${creditBalance} ${t("topbar.credits")}`}
          />
        </div>
      )}
    </>
  );
}
