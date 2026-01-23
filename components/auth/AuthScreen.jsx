"use client";

import React from "react";
import Image from "next/image";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { SITE_TITLE } from "@/lib/site";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import packageInfo from '@/package.json';
import Link from 'next/link';
import PasswordStrengthIndicator from "./PasswordStrengthIndicator";
import PasswordInput from "@/components/ui/PasswordInput";
import { useRecaptcha } from "@/hooks/useRecaptcha";

const getProviders = (t) => [
  { id: "google", label: t("auth.continueWithGoogle"), image: "/icons/g_logo.png", width: 28, height: 28 },
  { id: "apple", label: t("auth.continueWithApple"), image: "/icons/Apple_logo.png", width: 22, height: 27 },
  { id: "github", label: t("auth.continueWithGithub"), image: "/icons/github.png", width: 28, height: 28 },
];

export default function AuthScreen({ initialMode = "login", providerAvailability = {}, registrationEnabled = true, maintenanceEnabled = false, oauthError = null }){
  const router = useRouter();
  const { t } = useLanguage();
  const { executeRecaptcha } = useRecaptcha();
  // Protection: forcer login si initialMode=register mais registration bloquée ou maintenance
  const [mode, setMode] = React.useState(
    initialMode === "register" && (!registrationEnabled || maintenanceEnabled) ? "login" : initialMode
  );
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState("");
  const [oauthErrorMessage, setOauthErrorMessage] = React.useState("");

  const isRegister = mode === "register";

  // Gérer les erreurs OAuth (notamment OAuthAccountNotLinked)
  React.useEffect(() => {
    if (oauthError) {
      let message = "";
      switch (oauthError) {
        case "OAuthAccountNotLinked":
          message = t("auth.errors.oauthAccountNotLinked");
          break;
        case "OAuthSignin":
        case "OAuthCallback":
          message = t("auth.errors.oauthSigninError");
          break;
        case "OAuthCreateAccount":
          message = t("auth.errors.oauthCreateError");
          break;
        case "EmailCreateAccount":
          message = t("auth.errors.emailCreateError");
          break;
        case "Callback":
          message = t("auth.errors.callbackError");
          break;
        default:
          message = t("auth.errors.oauthGeneric");
      }
      setOauthErrorMessage(message);
      // Nettoyer l'URL
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/auth');
      }
    }
  }, [oauthError, t]);

  // Vérifier si l'utilisateur vient de vérifier son email
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('verified') === 'true') {
        setSuccessMessage(t('auth.emailVerifiedSuccess'));
        // Nettoyer l'URL
        window.history.replaceState({}, '', '/auth');
      }
    }
  }, []);

  function switchMode(next){
    // Empêcher le passage en mode "register" si inscriptions désactivées OU maintenance
    if (next === "register" && (!registrationEnabled || maintenanceEnabled)) {
      return;
    }
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

      // Obtenir le token reCAPTCHA pour toutes les actions (le serveur gère BYPASS_RECAPTCHA)
      const recaptchaToken = await executeRecaptcha(isRegister ? 'signup' : 'login');
      // Ne pas bloquer si null - le serveur décidera avec BYPASS_RECAPTCHA

      if (isRegister){
        if (!firstName || !lastName){
          setError(t("auth.errors.nameRequired"));
          setLoading(false);
          return;
        }
        if (password.length < 8){
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
          body: JSON.stringify({ firstName, lastName, email, password, recaptchaToken }),
        });

        if (!res.ok){
          const payload = await res.json().catch(() => ({}));
          setError(payload?.error || payload?.details?.join(", ") || t("auth.errors.createFailed"));
          setLoading(false);
          return;
        }

        // Après inscription réussie, on continue pour se connecter
      }

      // Pour le login après inscription, générer un nouveau token
      // (le précédent a été consommé par l'API register)
      let loginRecaptchaToken = recaptchaToken;
      if (isRegister) {
        loginRecaptchaToken = await executeRecaptcha('login');
      }

      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
        recaptchaToken: loginRecaptchaToken || undefined,
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
      // Utiliser window.location.href pour garantir l'affichage du loading screen
      window.location.href = "/";
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
      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-8 ios-auth-container">
        <div className="w-full max-w-lg">
          <div className="rounded-3xl border-2 border-white/30 bg-white/15 backdrop-blur-xl shadow-2xl p-6 space-y-6">
        <div className="flex justify-center mb-4">
          <Image
            src="/icons/logo.png"
            alt="FitMyCV.io"
            width={250}
            height={75}
            className="object-contain"
            priority
          />
        </div>
        <div className="text-center">
          <p className="text-sm text-slate-100 drop-shadow">
            {t("auth.welcome")}
          </p>
        </div>

        {/* Afficher l'erreur OAuth si présente */}
        {oauthErrorMessage && (
          <div className="rounded-lg border-2 border-amber-400/50 bg-amber-500/20 backdrop-blur-sm px-4 py-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-amber-400 text-lg flex-shrink-0">⚠️</span>
              <p className="text-white drop-shadow flex-1">
                {oauthErrorMessage}
              </p>
            </div>
          </div>
        )}

        {/* Bandeau mode maintenance */}
        {maintenanceEnabled && (
          <div className="rounded-lg border-2 border-orange-400/50 bg-orange-500/20 backdrop-blur-sm px-4 py-4 text-center">
            <p className="text-white/90 drop-shadow text-sm">
              {t("maintenance.modeEnabled")}
            </p>
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          {providers.map(provider => (
            <button
              key={provider.id}
              type="button"
              onClick={()=>oauthClick(provider.id)}
              disabled={!provider.enabled}
              className={`group relative h-12 w-12 rounded-full border border-white/40 flex items-center justify-center transition ${provider.enabled ? "hover:shadow-sm hover:border-white/60" : "opacity-40 cursor-not-allowed"}`}
              aria-label={provider.label}
            >
              <Image
                src={provider.image}
                alt={provider.label}
                width={provider.width}
                height={provider.height}
                className={`object-contain ${["github", "apple"].includes(provider.id) ? "invert" : ""}`}
                priority
              />
              {!provider.enabled && (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" />
                    <line x1="7" y1="7" x2="17" y2="17" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Message subtil quand les inscriptions sont désactivées */}
        {!registrationEnabled && !maintenanceEnabled && (
          <p className="text-xs text-white/60 text-center -mt-2">
            {t("auth.oauthLoginOnly")}
          </p>
        )}

        <div className="relative flex items-center justify-center">
          <div className="h-px bg-white/30 w-full"></div>
        </div>

        {/* Bandeau inscriptions désactivées (formulaire login reste visible) */}
        {!registrationEnabled && !maintenanceEnabled && (
          <div className="rounded-lg border-2 border-yellow-400/50 bg-yellow-500/20 backdrop-blur-sm px-4 py-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-yellow-400 text-lg">⚠️</span>
              <p className="text-white drop-shadow flex-1">
                {t("maintenance.registrationDisabled")}
              </p>
            </div>
          </div>
        )}

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
                    className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 shadow-xs transition-colors duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden"
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
                    className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 shadow-xs transition-colors duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden"
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
              className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 shadow-xs transition-colors duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden"
              placeholder={t("auth.placeholders.email")}
              autoComplete={isRegister ? "email" : "username"}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t("auth.password")}</label>
            <PasswordInput
              id="password"
              name="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 shadow-xs transition-colors duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden"
              placeholder={t("auth.placeholders.password")}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
            {isRegister && <PasswordStrengthIndicator password={password} />}
          </div>

          {isRegister ? (
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t("auth.confirmPassword")}</label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 shadow-xs transition-colors duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden"
                placeholder={t("auth.placeholders.password")}
                autoComplete="new-password"
              />
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-sm border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{successMessage}</div>
          ) : null}

          {error ? (
            <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm border border-emerald-500 bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {loading ? t("auth.pleaseWait") : (isRegister ? t("auth.createAccount") : t("auth.login"))}
          </button>
        </form>

        {!isRegister && (
          <div className="text-center text-sm text-slate-100 drop-shadow">
            <a href="/auth/forgot-password" className="font-medium text-emerald-300 hover:text-emerald-200 hover:underline">
              {t("auth.forgotPassword")}
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
            registrationEnabled && !maintenanceEnabled && (
              <span>
                {t("auth.new")}
                {" "}
                <button type="button" onClick={()=>switchMode("register")} className="font-medium text-emerald-300 hover:text-emerald-200 hover:underline">
                  {t("auth.createAccountLink")}
                </button>
              </span>
            )
          )}
        </div>

        <div className="text-center text-xs text-slate-200 drop-shadow">
          Ce site est protégé par reCAPTCHA. Consultez notre{" "}
          <a href="/privacy" className="text-emerald-300 underline hover:text-emerald-200 transition-colors">
            politique de confidentialité
          </a>.
        </div>
          </div>

          {/* Footer avec version et liens légaux */}
          <footer className="text-center text-xs pt-4 pb-2">
            <div className="text-white/70 space-y-2">
              <div>{t('footer.copyright')} (v{packageInfo.version})</div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-0 sm:gap-1 leading-none -space-y-3 sm:space-y-0">
                <div className="flex items-baseline justify-center gap-1 leading-none">
                  <Link href="/about" className="hover:text-white transition-colors">
                    {t('footer.about')}
                  </Link>
                  <span className="text-white/40">•</span>
                  <Link href="/cookies" className="hover:text-white transition-colors">
                    {t('footer.cookies')}
                  </Link>
                  <span className="text-white/40 hidden sm:inline">•</span>
                </div>
                <div className="flex items-baseline justify-center gap-1 leading-none">
                  <Link href="/terms" className="hover:text-white transition-colors">
                    {t('footer.terms')}
                  </Link>
                  <span className="text-white/40">•</span>
                  <Link href="/privacy" className="hover:text-white transition-colors">
                    {t('footer.privacy')}
                  </Link>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
