"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PasswordStrengthIndicator from "@/components/auth/PasswordStrengthIndicator";
import PasswordInput from "@/components/ui/PasswordInput";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { t } = useLanguage();

  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [verifyingToken, setVerifyingToken] = React.useState(true);

  // Vérifier que le token est valide au chargement
  React.useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setError(t("auth.resetPasswordPage.errors.tokenMissing"));
        setVerifyingToken(false);
        return;
      }

      try {
        const res = await fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!data.valid) {
          setError(data.error || t("auth.resetPasswordPage.errors.linkInvalid"));
        }
      } catch (err) {
        console.error('Erreur lors de la vérification du token:', err);
        setError(t("auth.resetPasswordPage.errors.verificationFailed"));
      } finally {
        setVerifyingToken(false);
      }
    }

    verifyToken();
  }, [token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError(t("auth.resetPasswordPage.errors.tokenMissing"));
      return;
    }

    if (!password || !confirmPassword) {
      setError(t("auth.resetPasswordPage.errors.fieldsRequired"));
      return;
    }

    if (password.length < 8) {
      setError(t("auth.errors.passwordLength"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.errors.passwordMismatch"));
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("auth.resetPasswordPage.errors.generic"));
        setLoading(false);
        return;
      }

      setSuccess(true);

      // Rediriger vers la page de connexion après 3 secondes
      setTimeout(() => {
        router.push("/auth");
      }, 3000);
    } catch (err) {
      console.error(err);
      setError(t("auth.resetPasswordPage.errors.generic"));
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
                  {t("auth.resetPasswordPage.successTitle")}
                </h1>
                <p className="text-slate-100 drop-shadow mb-6">
                  {t("auth.resetPasswordPage.successMessage")}
                </p>
                <p className="text-sm text-slate-200 drop-shadow mb-6">
                  {t("auth.resetPasswordPage.redirecting")}
                </p>
                <Link
                  href="/auth"
                  className="inline-block rounded-sm border border-emerald-500 bg-emerald-500 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition"
                >
                  {t("auth.resetPasswordPage.loginNow")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Afficher un état de chargement pendant la vérification du token
  if (verifyingToken) {
    return (
      <>
        <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-8 ios-auth-container">
          <div className="w-full max-w-lg">
            <div className="rounded-3xl border-2 border-white/30 bg-white/15 backdrop-blur-xl shadow-2xl p-8 space-y-6">
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
                  <svg className="animate-spin w-8 h-8 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <h1 className="text-xl font-semibold text-white drop-shadow-lg">
                  {t("auth.resetPasswordPage.verifying")}
                </h1>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Si erreur, afficher un message avec lien pour demander un nouveau token
  if (error) {
    return (
      <>
        <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-8 ios-auth-container">
          <div className="w-full max-w-lg">
            <div className="rounded-3xl border-2 border-white/30 bg-white/15 backdrop-blur-xl shadow-2xl p-8 space-y-6">
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h1 className="text-2xl font-semibold text-white drop-shadow-lg mb-3">
                  {t("auth.resetPasswordPage.invalidLinkTitle")}
                </h1>
                <p className="text-slate-100 drop-shadow mb-6">
                  {error}
                </p>
                <div className="text-center text-sm text-slate-100 drop-shadow">
                  <Link href="/auth" className="font-medium text-emerald-300 hover:text-emerald-200 hover:underline">
                    {t("auth.resetPasswordPage.backToLogin")}
                  </Link>
                </div>
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
                {t("auth.resetPasswordPage.title")}
              </h1>
              <p className="text-sm text-slate-100 drop-shadow">
                {t("auth.resetPasswordPage.description")}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">
                  {t("auth.resetPasswordPage.newPasswordLabel")}
                </label>
                <PasswordInput
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 shadow-xs transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder={t("auth.placeholders.password")}
                  autoComplete="new-password"
                />
                <PasswordStrengthIndicator password={password} />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">
                  {t("auth.resetPasswordPage.confirmPasswordLabel")}
                </label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 shadow-xs transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder={t("auth.placeholders.password")}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-sm border border-emerald-500 bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60 transition"
              >
                {loading ? t("auth.resetPasswordPage.submitting") : t("auth.resetPasswordPage.submitButton")}
              </button>
            </form>

            <div className="text-center text-sm text-slate-100 drop-shadow">
              <Link href="/auth" className="font-medium text-emerald-300 hover:text-emerald-200 hover:underline">
                {t("auth.resetPasswordPage.backToLogin")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
