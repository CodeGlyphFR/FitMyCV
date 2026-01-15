"use client";

import React from "react";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useRecaptcha } from "@/hooks/useRecaptcha";

// Configuration des providers avec leurs icônes et couleurs
const PROVIDERS_CONFIG = {
  google: {
    name: "Google",
    icon: "/icons/g_logo.png",
    bgColor: "bg-white/10",
    borderColor: "border-white/30",
  },
  github: {
    name: "GitHub",
    icon: "/icons/github.png",
    bgColor: "bg-white/10",
    borderColor: "border-white/30",
  },
  apple: {
    name: "Apple",
    icon: "/icons/Apple_logo.png",
    bgColor: "bg-white/10",
    borderColor: "border-white/30",
  },
};

export default function LinkedAccountsSection({ onRefresh }) {
  const { t } = useLanguage();
  const { executeRecaptcha } = useRecaptcha();

  const [linkedAccounts, setLinkedAccounts] = React.useState([]);
  const [availableProviders, setAvailableProviders] = React.useState({});
  const [canUnlink, setCanUnlink] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState(null);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [showUnlinkModal, setShowUnlinkModal] = React.useState(null);

  // Charger les comptes liés
  const fetchLinkedAccounts = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/account/linked-accounts");
      if (!res.ok) {
        throw new Error("Failed to fetch linked accounts");
      }
      const data = await res.json();
      setLinkedAccounts(data.linkedAccounts || []);
      setAvailableProviders(data.availableProviders || {});
      setCanUnlink(data.canUnlink || {});
    } catch (err) {
      console.error("[LinkedAccountsSection] Error:", err);
      setError(t('account.linkedAccounts.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    fetchLinkedAccounts();
  }, [fetchLinkedAccounts]);

  // Vérifier les paramètres URL pour les messages de succès/erreur
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkSuccess = params.get("linkSuccess");
    const linkError = params.get("linkError");
    const provider = params.get("provider");

    if (linkSuccess === "true" && provider) {
      setSuccess(t('account.linkedAccounts.success.linked', { provider: PROVIDERS_CONFIG[provider]?.name || provider }));
      fetchLinkedAccounts();
      // Nettoyer l'URL
      window.history.replaceState({}, "", "/account");
    } else if (linkSuccess === "already_linked" && provider) {
      setSuccess(t('account.linkedAccounts.success.alreadyLinked', { provider: PROVIDERS_CONFIG[provider]?.name || provider }));
      window.history.replaceState({}, "", "/account");
    } else if (linkError && provider) {
      const errorKey = `account.linkedAccounts.errors.${linkError}`;
      const errorMessage = t(errorKey, { provider: PROVIDERS_CONFIG[provider]?.name || provider });
      setError(errorMessage !== errorKey ? errorMessage : t('account.linkedAccounts.errors.linkFailed', { provider: PROVIDERS_CONFIG[provider]?.name || provider }));
      window.history.replaceState({}, "", "/account");
    }
  }, [t, fetchLinkedAccounts]);

  // Lier un provider
  async function handleLink(provider) {
    setError("");
    setSuccess("");
    setActionLoading(provider);

    try {
      // Obtenir le token reCAPTCHA
      const recaptchaToken = await executeRecaptcha('link_oauth');

      const res = await fetch("/api/account/link-oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, recaptchaToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Link failed");
      }

      // Rediriger vers l'URL OAuth
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err) {
      setError(err.message || t('account.linkedAccounts.errors.linkFailed', { provider: PROVIDERS_CONFIG[provider]?.name || provider }));
      setActionLoading(null);
    }
  }

  // Délier un provider
  async function handleUnlink(provider) {
    setError("");
    setSuccess("");
    setActionLoading(provider);
    setShowUnlinkModal(null);

    try {
      const res = await fetch("/api/account/unlink-oauth", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unlink failed");
      }

      setSuccess(t('account.linkedAccounts.success.unlinked', { provider: PROVIDERS_CONFIG[provider]?.name || provider }));
      await fetchLinkedAccounts();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message || t('account.linkedAccounts.errors.unlinkFailed', { provider: PROVIDERS_CONFIG[provider]?.name || provider }));
    } finally {
      setActionLoading(null);
    }
  }

  // Vérifier si un provider est lié
  function isLinked(provider) {
    return linkedAccounts.some(acc => acc.provider === provider);
  }

  // Rendu d'une carte provider
  function renderProviderCard(provider) {
    const config = PROVIDERS_CONFIG[provider];
    const linked = isLinked(provider);
    const available = availableProviders[provider];
    const canUnlinkThis = canUnlink[provider];
    const isLoading = actionLoading === provider;

    return (
      <div
        key={provider}
        className={`rounded-xl border ${config.borderColor} ${config.bgColor} backdrop-blur-sm p-4 flex items-center justify-between transition-all duration-200 hover:bg-white/15`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
            <Image
              src={config.icon}
              alt={config.name}
              width={24}
              height={24}
              className={`object-contain ${["github", "apple"].includes(provider) ? "invert" : ""}`}
            />
          </div>
          <div>
            <p className="text-white font-medium drop-shadow">{config.name}</p>
            <p className="text-xs text-white/60 drop-shadow">
              {!available
                ? t('account.linkedAccounts.status.notConfigured')
                : linked
                  ? t('account.linkedAccounts.status.connected')
                  : t('account.linkedAccounts.status.notConnected')
              }
            </p>
          </div>
        </div>

        <div>
          {!available ? (
            <span className="text-xs text-white/40 px-3 py-1.5">
              {t('account.linkedAccounts.status.notConfigured')}
            </span>
          ) : linked ? (
            <button
              onClick={() => setShowUnlinkModal(provider)}
              disabled={isLoading || !canUnlinkThis}
              title={!canUnlinkThis ? t('account.linkedAccounts.errors.cannotUnlinkLast') : ""}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                canUnlinkThis
                  ? "border-red-400/50 bg-red-500/20 text-white hover:bg-red-500/30"
                  : "border-white/20 bg-white/5 text-white/40 cursor-not-allowed"
              } disabled:opacity-50`}
            >
              {isLoading ? t('account.linkedAccounts.actions.unlinking') : t('account.linkedAccounts.actions.unlink')}
            </button>
          ) : (
            <button
              onClick={() => handleLink(provider)}
              disabled={isLoading}
              className="rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500/30 transition-all duration-200 disabled:opacity-50"
            >
              {isLoading ? t('account.linkedAccounts.actions.linking') : t('account.linkedAccounts.actions.link')}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-white/20 bg-white/5 p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10" />
              <div className="space-y-2">
                <div className="h-4 w-20 bg-white/10 rounded" />
                <div className="h-3 w-16 bg-white/10 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/70 drop-shadow">
        {t('account.linkedAccounts.description')}
      </p>

      {error && (
        <div className="rounded-lg border-2 border-red-400/50 bg-red-500/20 backdrop-blur-sm px-3 py-2 text-sm text-white drop-shadow">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border-2 border-emerald-400/50 bg-emerald-500/20 backdrop-blur-sm px-3 py-2 text-sm text-white drop-shadow">
          {success}
        </div>
      )}

      <div className="space-y-3">
        {Object.keys(PROVIDERS_CONFIG).map(provider => renderProviderCard(provider))}
      </div>

      {/* Modal de confirmation de déliaison */}
      {showUnlinkModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowUnlinkModal(null)}
        >
          <div
            className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-2 border-white/20 rounded-2xl backdrop-blur-xl p-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white drop-shadow mb-3">
              {t('account.linkedAccounts.confirmUnlink.title', { provider: PROVIDERS_CONFIG[showUnlinkModal]?.name })}
            </h3>

            <p className="text-sm text-white/80 drop-shadow mb-6">
              {t('account.linkedAccounts.confirmUnlink.message', { provider: PROVIDERS_CONFIG[showUnlinkModal]?.name })}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowUnlinkModal(null)}
                className="flex-1 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors font-medium"
              >
                {t('account.linkedAccounts.confirmUnlink.cancel')}
              </button>
              <button
                onClick={() => handleUnlink(showUnlinkModal)}
                disabled={actionLoading === showUnlinkModal}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500/30 hover:bg-red-500/40 border border-red-400/50 text-white transition-colors font-medium disabled:opacity-50"
              >
                {actionLoading === showUnlinkModal
                  ? t('account.linkedAccounts.actions.unlinking')
                  : t('account.linkedAccounts.confirmUnlink.confirm')
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
