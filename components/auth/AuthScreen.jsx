"use client";

import React from "react";
import Image from "next/image";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { SITE_TITLE } from "@/lib/site";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import PasswordStrengthIndicator from "./PasswordStrengthIndicator";
import AuthBackground from "./AuthBackground";

const getProviders = (t) => [
  { id: "google", label: t("auth.continueWithGoogle"), image: "/icons/g_logo.png", width: 28, height: 28 },
  { id: "apple", label: t("auth.continueWithApple"), image: "/icons/Apple_logo.png", width: 22, height: 27 },
  { id: "github", label: t("auth.continueWithGithub"), image: "/icons/github.png", width: 28, height: 28 },
];

export default function AuthScreen({ initialMode = "login", providerAvailability = {} }){
  const router = useRouter();
  const { t } = useLanguage();
  const [mode, setMode] = React.useState(initialMode);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState("");

  const isRegister = mode === "register";

  // Vérifier si l'utilisateur vient de vérifier son email
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('verified') === 'true') {
        setSuccessMessage('Email vérifié avec succès ! Vous pouvez maintenant vous connecter.');
        // Nettoyer l'URL
        window.history.replaceState({}, '', '/auth');
      }
    }
  }, []);

  function switchMode(next){
    setMode(next);
    setError("");
  }

  async function handleCredentialsSubmit(event){
    event.preventDefault();
    setError("");

    if (!email || !password){
      setError(t("auth.errors.required"));
      return;
    }

    try {
      setLoading(true);
      if (isRegister){
        if (!firstName || !lastName){
          setError(t("auth.errors.nameRequired"));
          setLoading(false);
          return;
        }
        if (password.length < 12){
          setError(t("auth.errors.passwordLength"));
          setLoading(false);
          return;
        }
        if (password !== confirmPassword){
          setError(t("auth.errors.passwordMismatch"));
          setLoading(false);
          return;
        }

        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firstName, lastName, email, password }),
        });

        if (!res.ok){
          const payload = await res.json().catch(() => ({}));
          setError(payload?.error || payload?.details?.join(", ") || t("auth.errors.createFailed"));
          setLoading(false);
          return;
        }

        // Après inscription réussie, on continue pour se connecter
      }

      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error){
        setError(t("auth.errors.invalidCredentials"));
        setLoading(false);
        return;
      }

      // Après connexion, récupérer la session pour vérifier si l'email est vérifié
      const session = await getSession();

      // Si l'email n'est pas vérifié, rediriger vers la page de vérification
      if (session?.user && !session.user.emailVerified) {
        const redirectUrl = isRegister
          ? '/auth/verify-email-required?new=true'
          : '/auth/verify-email-required';
        router.replace(redirectUrl);
        router.refresh();
        return;
      }

      // Email vérifié, rediriger vers la page d'accueil
      router.replace("/");
      router.refresh();
    } catch (submitError) {
      console.error(submitError);
      setError(t("auth.errors.unexpected"));
    } finally {
      setLoading(false);
    }
  }

  const providers = React.useMemo(
    () => getProviders(t).map(provider => ({
      ...provider,
      enabled: providerAvailability?.[provider.id],
    })),
    [providerAvailability, t]
  );

  function oauthClick(provider){
    const info = providers.find(p => p.id === provider);
    if (!info?.enabled){
      setError(t("auth.errors.oauthUnavailable"));
      return;
    }
    setError("");
    signIn(provider, { callbackUrl: "/" });
  }

  return (
    <>
      <AuthBackground />
      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-lg">
          <div className="rounded-3xl border-2 border-white/30 bg-white/15 backdrop-blur-xl shadow-2xl p-6 space-y-6">
        <div className="space-y-1 text-aligned">
          <h1 className="text-2xl font-semibold text-center text-white drop-shadow-lg">
            {isRegister ? t("auth.title") : t("auth.siteTitle")}
          </h1>
          <p className="text-sm text-slate-100 drop-shadow">
            {t("auth.welcome")}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          {providers.map(provider => (
            <button
              key={provider.id}
              type="button"
              onClick={()=>oauthClick(provider.id)}
              disabled={!provider.enabled}
              className={`h-12 w-12 rounded-full border flex items-center justify-center transition ${provider.enabled ? "hover:shadow" : "opacity-40 cursor-not-allowed"}`}
              aria-label={provider.label}
            >
              <Image
                src={provider.image}
                alt={provider.label}
                width={provider.width}
                height={provider.height}
                className="object-contain"
                priority
              />
            </button>
          ))}
        </div>

        <div className="relative flex items-center justify-center">
          <div className="h-px bg-white/30 w-full"></div>
        </div>

        <form key={mode} onSubmit={handleCredentialsSubmit} method="post" className="space-y-3">
          {isRegister ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label htmlFor="firstName" className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t("auth.firstName")}</label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={firstName}
                    onChange={event => setFirstName(event.target.value)}
                    className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 shadow-sm transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none"
                    placeholder={t("auth.firstName")}
                    autoComplete="given-name"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="lastName" className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t("auth.lastName")}</label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={lastName}
                    onChange={event => setLastName(event.target.value)}
                    className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 shadow-sm transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none"
                    placeholder={t("auth.lastName")}
                    autoComplete="family-name"
                  />
                </div>
              </div>
            </>
          ) : null}

          <div className="space-y-2">
            <label htmlFor={isRegister ? "email" : "username"} className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t("auth.email")}</label>
            <input
              id={isRegister ? "email" : "username"}
              name={isRegister ? "email" : "username"}
              type={isRegister ? "email" : "text"}
              inputMode="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 shadow-sm transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none"
              placeholder="email@example.com"
              autoComplete={isRegister ? "email" : "username"}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t("auth.password")}</label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 shadow-sm transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none"
              placeholder="••••••••"
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
            {isRegister && <PasswordStrengthIndicator password={password} />}
          </div>

          {isRegister ? (
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t("auth.confirmPassword")}</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 shadow-sm transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{successMessage}</div>
          ) : null}

          {error ? (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded border border-emerald-500 bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {loading ? t("auth.pleaseWait") : (isRegister ? t("auth.createAccount") : t("auth.login"))}
          </button>
        </form>

        {!isRegister && (
          <div className="text-center text-sm text-slate-100 drop-shadow">
            <a href="/auth/forgot-password" className="font-medium text-emerald-300 hover:text-emerald-200 hover:underline">
              Mot de passe oublié ?
            </a>
          </div>
        )}

        <div className="text-center text-sm text-slate-100 drop-shadow">
          {isRegister ? (
            <span>
              {t("auth.alreadyRegistered")}
              {" "}
              <button type="button" onClick={()=>switchMode("login")} className="font-medium text-emerald-300 hover:text-emerald-200 hover:underline">
                {t("auth.loginLink")}
              </button>
            </span>
          ) : (
            <span>
              {t("auth.new")}
              {" "}
              <button type="button" onClick={()=>switchMode("register")} className="font-medium text-emerald-300 hover:text-emerald-200 hover:underline">
                {t("auth.createAccountLink")}
              </button>
            </span>
          )}
        </div>

        <div className="text-center text-xs text-slate-200 drop-shadow">
          {t("auth.termsText")}
        </div>
          </div>
        </div>
      </div>
    </>
  );
}
