"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { executeRecaptcha } = useRecaptcha();
  const { t } = useLanguage();
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!email) {
      setError(t("auth.forgotPasswordPage.errors.emailRequired"));
      return;
    }

    try {
      setLoading(true);

      // Obtenir le token reCAPTCHA (le serveur gère BYPASS_RECAPTCHA)
      const recaptchaToken = await executeRecaptcha('forgot_password');
      // Ne pas bloquer si null - le serveur décidera

      const res = await fetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, recaptchaToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Si l'utilisateur est OAuth uniquement
        if (data.error === 'oauth_only') {
          setError(data.message || t("auth.forgotPasswordPage.errors.oauthOnly"));
          setLoading(false);
          return;
        }

        setError(data.error || t("auth.forgotPasswordPage.errors.generic"));
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError(t("auth.forgotPasswordPage.errors.generic"));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <>
        <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-8 ios-auth-container">
          <div className="w-full max-w-lg">
            <div className="rounded-3xl border-2 border-white/30 bg-white/15 backdrop-blur-xl shadow-2xl p-8 space-y-6">
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-2xl font-semibold text-white drop-shadow-lg mb-3">
                  {t("auth.forgotPasswordPage.successTitle")}
                </h1>
                <p className="text-slate-100 drop-shadow mb-6">
                  {t("auth.forgotPasswordPage.successMessage")}
                </p>
                <p className="text-sm text-slate-200 drop-shadow mb-6">
                  {t("auth.forgotPasswordPage.checkInbox")}
                </p>
                <Link
                  href="/auth"
                  className="inline-block rounded-sm border border-emerald-500 bg-emerald-500 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition"
                >
                  {t("auth.forgotPasswordPage.backToLogin")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-8 ios-auth-container">
        <div className="w-full max-w-lg">
          <div className="rounded-3xl border-2 border-white/30 bg-white/15 backdrop-blur-xl shadow-2xl p-8 space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold text-white drop-shadow-lg">
                {t("auth.forgotPasswordPage.title")}
              </h1>
              <p className="text-sm text-slate-100 drop-shadow">
                {t("auth.forgotPasswordPage.description")}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">
                  {t("auth.email")}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 shadow-xs transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden"
                  placeholder={t("auth.placeholders.email")}
                  autoComplete="email"
                />
              </div>

              {error ? (
                <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-sm border border-emerald-500 bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60 transition"
              >
                {loading ? t("auth.forgotPasswordPage.submitting") : t("auth.forgotPasswordPage.submitButton")}
              </button>
            </form>

            <div className="text-center text-sm text-slate-100 drop-shadow">
              <Link href="/auth" className="font-medium text-emerald-300 hover:text-emerald-200 hover:underline">
                {t("auth.forgotPasswordPage.backToLogin")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
