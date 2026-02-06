"use client";

import React from "react";
import { createPortal } from "react-dom";
import { signOut } from "next-auth/react";

/**
 * Composant portal pour le menu utilisateur
 */
export default function UserMenuPortal({
  userMenuOpen,
  portalReady,
  userMenuRect,
  userMenuRef,
  session,
  creditsOnlyMode,
  subscriptionLoading,
  planName,
  planIcon,
  creditBalance,
  logoutTarget,
  setUserMenuOpen,
  router,
  t
}) {
  if (!userMenuOpen || !portalReady || !userMenuRect) return null;

  return createPortal(
    <div
      ref={userMenuRef}
      style={{
        position: "fixed",
        top: userMenuRect.bottom + 8,
        left: userMenuRect.left,
        zIndex: 10002,
      }}
      className="rounded-lg border border-white/30 bg-white/15 backdrop-blur-md shadow-2xl p-2 text-sm space-y-1 min-w-[10rem] max-w-[16rem]"
    >
      {/* Header - User name */}
      <div className="px-2 py-1 text-xs uppercase text-white/70 drop-shadow truncate">
        {session?.user?.name || t("topbar.user")}
      </div>

      {/* Main navigation */}
      <button
        className="w-full text-left rounded px-2 py-1 hover:bg-white/25 text-white transition-colors duration-200"
        onClick={() => {
          setUserMenuOpen(false);
          router.push("/");
        }}
      >
        {t("topbar.myCvs")}
      </button>

      {/* Coming Soon Features */}
      <button
        className="w-full text-left rounded px-2 py-1 text-white/50 cursor-not-allowed flex items-center justify-between"
        disabled
      >
        <span>{t("topbar.analyzeOffers")}</span>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 text-[10px] uppercase font-semibold">
          {t("topbar.soon")}
        </span>
      </button>
      <button
        className="w-full text-left rounded px-2 py-1 text-white/50 cursor-not-allowed flex items-center justify-between"
        disabled
      >
        <span>{t("topbar.coverLetters")}</span>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 text-[10px] uppercase font-semibold">
          {t("topbar.soon")}
        </span>
      </button>
      <button
        className="w-full text-left rounded px-2 py-1 text-white/50 cursor-not-allowed flex items-center justify-between"
        disabled
      >
        <span>{t("topbar.interviewPrep")}</span>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 text-[10px] uppercase font-semibold">
          {t("topbar.soon")}
        </span>
      </button>
      <button
        className="w-full text-left rounded px-2 py-1 text-white/50 cursor-not-allowed flex items-center justify-between"
        disabled
      >
        <span>{t("topbar.applicationTracking")}</span>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 text-[10px] uppercase font-semibold">
          {t("topbar.soon")}
        </span>
      </button>

      {/* Account settings */}
      <button
        className="w-full text-left rounded px-2 py-1 hover:bg-white/25 text-white transition-colors duration-200"
        onClick={() => {
          setUserMenuOpen(false);
          window.location.href = "/account";
        }}
      >
        {t("topbar.myAccount")}
      </button>
      <button
        className="w-full text-left rounded px-2 py-1 hover:bg-white/25 text-white transition-colors duration-200"
        onClick={() => {
          setUserMenuOpen(false);
          window.location.href = "/account/subscriptions";
        }}
      >
        {creditsOnlyMode ? t("topbar.subscriptions_credits_only") : t("topbar.subscriptions")}
      </button>
      <button
        className="w-full text-left rounded px-2 py-1 hover:bg-white/25 text-white transition-colors duration-200"
        onClick={() => {
          setUserMenuOpen(false);
          signOut({ callbackUrl: logoutTarget });
        }}
      >
        {t("topbar.logout")}
      </button>

      {/* Footer - Plan & Credits */}
      {!subscriptionLoading && (planName || creditsOnlyMode) && (
        <div className="border-t border-white/20 mt-2 pt-2">
          <div className="text-center text-[11px] text-white/60 drop-shadow">
            {creditsOnlyMode ? (
              <>{creditBalance} {t("topbar.credits")}</>
            ) : (
              <>{planIcon} {planName} • {creditBalance} {t("topbar.credits")}</>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
