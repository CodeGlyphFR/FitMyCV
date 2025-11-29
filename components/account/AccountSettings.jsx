"use client";

import React from "react";
import { signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import PasswordStrengthIndicator from "@/components/auth/PasswordStrengthIndicator";
import PasswordInput from "@/components/ui/PasswordInput";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function AccountSettings({ user, isOAuthUser = false, oauthProviders = [] }){
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetOnboarding } = useOnboarding();
  const { t, language } = useLanguage();

  const [name, setName] = React.useState(user?.name || "");
  const [email, setEmail] = React.useState(user?.email || "");
  const [profileMessage, setProfileMessage] = React.useState("");
  const [profileError, setProfileError] = React.useState("");
  const [profileLoading, setProfileLoading] = React.useState(false);

  const [onboardingMessage, setOnboardingMessage] = React.useState("");
  const [onboardingError, setOnboardingError] = React.useState("");
  const [onboardingLoading, setOnboardingLoading] = React.useState(false);
  const [onboardingCompletedAt, setOnboardingCompletedAt] = React.useState(null);

  // Vérifier si l'email a été changé avec succès
  React.useEffect(() => {
    if (searchParams.get('email-changed') === 'true') {
      setProfileMessage(t('account.profile.emailSuccess'));
      // Mettre à jour l'email affiché
      setEmail(user?.email || "");
    }
  }, [searchParams, user?.email, t]);

  // Fetch onboarding completion date
  React.useEffect(() => {
    async function fetchOnboardingState() {
      try {
        const res = await fetch('/api/user/onboarding');
        if (res.ok) {
          const data = await res.json();
          if (data.completedAt) {
            setOnboardingCompletedAt(new Date(data.completedAt));
          }
        }
      } catch (error) {
        console.error('[AccountSettings] Error fetching onboarding state:', error);
      }
    }
    fetchOnboardingState();
  }, []);

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordMessage, setPasswordMessage] = React.useState("");
  const [passwordError, setPasswordError] = React.useState("");
  const [passwordLoading, setPasswordLoading] = React.useState(false);

  const [deletePassword, setDeletePassword] = React.useState("");
  const [deleteError, setDeleteError] = React.useState("");
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [acceptedDeleteTerms, setAcceptedDeleteTerms] = React.useState(false);

  async function updateProfile(event){
    event.preventDefault();
    setProfileMessage("");
    setProfileError("");

    if (!name && !email){
      setProfileError(t('account.profile.noChanges'));
      return;
    }

    try {
      setProfileLoading(true);
      const res = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok){
        setProfileError(payload?.error || t('account.profile.errors.updateFailed'));
        return;
      }

      // Gérer le message de succès en fonction de la réponse
      if (payload?.emailChangeRequested) {
        setProfileMessage(payload?.message || t('account.profile.success'));
      } else {
        setProfileMessage(payload?.message || t('account.profile.success'));
      }
    } catch (error) {
      console.error(error);
      setProfileError(t('account.profile.errors.unexpected'));
    } finally {
      setProfileLoading(false);
    }
  }

  async function updatePassword(event){
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    if (!newPassword){
      setPasswordError(t('account.security.errors.newPasswordRequired'));
      return;
    }
    if (newPassword.length < 8){
      setPasswordError(t('account.security.errors.minLength'));
      return;
    }
    if (newPassword !== confirmPassword){
      setPasswordError(t('account.security.errors.mismatch'));
      return;
    }

    try {
      setPasswordLoading(true);
      const res = await fetch("/api/account/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok){
        setPasswordError(payload?.error || t('account.security.errors.updateFailed'));
        return;
      }
      setPasswordMessage(t('account.security.success'));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      setPasswordError(t('account.security.errors.unexpected'));
    } finally {
      setPasswordLoading(false);
    }
  }

  function openDeleteModal(event){
    event.preventDefault();
    setDeleteError("");

    if (!deletePassword){
      setDeleteError(t('account.deleteAccount.modal.errors.passwordRequired'));
      return;
    }

    // Ouvrir le modal de confirmation
    setShowDeleteModal(true);
  }

  async function confirmDeleteAccount(){
    try {
      setDeleteLoading(true);
      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok){
        setDeleteError(payload?.error || t('account.deleteAccount.modal.errors.deleteFailed'));
        setShowDeleteModal(false);
        setDeleteLoading(false);
        return;
      }

      await signOut({ callbackUrl: "/auth?mode=login" });
    } catch (error) {
      console.error(error);
      setDeleteError(t('account.deleteAccount.modal.errors.unexpected'));
      setShowDeleteModal(false);
      setDeleteLoading(false);
    }
  }

  async function handleResetOnboarding() {
    setOnboardingMessage("");
    setOnboardingError("");

    try {
      setOnboardingLoading(true);
      await resetOnboarding();

      // Show success message briefly
      setOnboardingMessage(t('account.tutorial.success'));

      // Redirect to CVs page where onboarding will auto-restart (currentStep === 0)
      // Workflow: 500ms success message → redirect → LoadingScreen → 3s delay → WelcomeModal
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    } catch (error) {
      console.error('[AccountSettings] Reset onboarding error:', error);

      // Use separate error state (follows pattern from updateProfile, updatePassword)
      const errorMessage = error?.message || t('account.tutorial.errors.resetFailed');
      setOnboardingError(errorMessage);
      setOnboardingLoading(false);  // Reset loading if error
    }
    // Note: no finally block - we're reloading on success
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border-2 border-white/30 bg-white/15 backdrop-blur-xl p-6 shadow-2xl">
        <h2 className="text-lg font-semibold mb-4 text-emerald-300 drop-shadow">{t('account.profile.title')}</h2>
        <form onSubmit={updateProfile} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t('account.profile.fullName')}</label>
            <input
              type="text"
              value={name}
              onChange={event => setName(event.target.value)}
              className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none"
              placeholder={t('account.profile.fullNamePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t('account.profile.email')}</label>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              className={`w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none ${isOAuthUser ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder={t('account.profile.emailPlaceholder')}
              disabled={isOAuthUser}
            />
            {isOAuthUser && (
              <p className="text-xs text-white/60 drop-shadow">
                {t('account.profile.emailDisabled', { provider: oauthProviders.length > 0 ? oauthProviders.join(', ') : 'OAuth' })}
              </p>
            )}
          </div>
          {profileError ? <div className="rounded-lg border-2 border-red-400/50 bg-red-500/20 backdrop-blur-sm px-3 py-2 text-sm text-white drop-shadow">{profileError}</div> : null}
          {profileMessage ? <div className="rounded-lg border-2 border-emerald-400/50 bg-emerald-500/20 backdrop-blur-sm px-3 py-2 text-sm text-white drop-shadow">{profileMessage}</div> : null}
          <button
            type="submit"
            disabled={profileLoading}
            className="rounded-lg border-2 border-emerald-400/50 bg-emerald-500/30 backdrop-blur-sm px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500/40 transition-all duration-200 disabled:opacity-60 drop-shadow"
          >
            {profileLoading ? t('account.profile.saving') : t('account.profile.saveButton')}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border-2 border-white/30 bg-white/15 backdrop-blur-xl p-6 shadow-2xl">
        <h2 className="text-lg font-semibold mb-4 text-emerald-300 drop-shadow">{t('account.security.title')}</h2>
        <form onSubmit={updatePassword} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t('account.security.currentPassword')}</label>
            <PasswordInput
              id="currentPassword"
              name="currentPassword"
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
              className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none"
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <p className="text-xs text-white/60 drop-shadow">{t('account.security.currentPasswordHint')}</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t('account.security.newPassword')}</label>
            <PasswordInput
              id="newPassword"
              name="newPassword"
              value={newPassword}
              onChange={event => setNewPassword(event.target.value)}
              className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none"
              placeholder="••••••••"
              autoComplete="new-password"
            />
            {/* Indicateur de force du mot de passe (adapté pour fond blanc) */}
            {newPassword && (
              <div className="mt-3 space-y-3">
                {/* Barre de progression */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/70 drop-shadow">{t('account.security.passwordStrength.label')}</span>
                    <span className={`font-medium ${getStrengthColor(newPassword)}`}>
                      {getStrengthLabel(newPassword, t)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                    <div
                      className={`h-full ${getStrengthBgColor(newPassword)} transition-all duration-300`}
                      style={{ width: getStrengthWidth(newPassword) }}
                    />
                  </div>
                </div>

                {/* Liste des règles */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-white/70 drop-shadow">{t('account.security.passwordRules.title')}</p>
                  <PasswordRule
                    valid={newPassword.length >= 8}
                    text={t('account.security.passwordRules.minLength')}
                  />
                  <PasswordRule
                    valid={/[A-Z]/.test(newPassword)}
                    text={t('account.security.passwordRules.uppercase')}
                  />
                  <PasswordRule
                    valid={/[a-z]/.test(newPassword)}
                    text={t('account.security.passwordRules.lowercase')}
                  />
                  <PasswordRule
                    valid={/[0-9]/.test(newPassword)}
                    text={t('account.security.passwordRules.numbers')}
                  />
                  <PasswordRule
                    valid={/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\';/~`]/.test(newPassword)}
                    text={t('account.security.passwordRules.specialChars')}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t('account.security.confirmPassword')}</label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
          {passwordError ? <div className="rounded-lg border-2 border-red-400/50 bg-red-500/20 backdrop-blur-sm px-3 py-2 text-sm text-white drop-shadow">{passwordError}</div> : null}
          {passwordMessage ? <div className="rounded-lg border-2 border-emerald-400/50 bg-emerald-500/20 backdrop-blur-sm px-3 py-2 text-sm text-white drop-shadow">{passwordMessage}</div> : null}
          <button
            type="submit"
            disabled={passwordLoading}
            className="rounded-lg border-2 border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm font-medium text-white hover:bg-white/30 transition-all duration-200 disabled:opacity-60 drop-shadow"
          >
            {passwordLoading ? t('account.security.updating') : t('account.security.updateButton')}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border-2 border-white/30 bg-white/15 backdrop-blur-xl p-6 shadow-2xl">
        <h2 className="text-lg font-semibold mb-4 text-emerald-300 drop-shadow">{t('account.tutorial.title')}</h2>

        {/* Afficher la date de complétion si disponible */}
        {onboardingCompletedAt && (
          <div className="rounded-lg border-2 border-emerald-400/30 bg-emerald-500/10 backdrop-blur-sm px-3 py-2 text-sm text-white/90 drop-shadow mb-4 flex items-center gap-2">
            <span className="text-emerald-400">✓</span>
            <span>
              {onboardingCompletedAt.toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}{' '}
              {onboardingCompletedAt.toLocaleTimeString(language === 'en' ? 'en-US' : 'fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}

        <p className="text-sm text-white/80 drop-shadow mb-4">
          {t('account.tutorial.description')}
        </p>
        {onboardingError && (
          <div className="rounded-lg border-2 border-red-400/50 bg-red-500/20 backdrop-blur-sm px-3 py-2 text-sm text-white drop-shadow mb-4">
            {onboardingError}
          </div>
        )}
        {onboardingMessage && (
          <div className="rounded-lg border-2 border-emerald-400/50 bg-emerald-500/20 backdrop-blur-sm px-3 py-2 text-sm text-white drop-shadow mb-4">
            {onboardingMessage}
          </div>
        )}
        <button
          onClick={handleResetOnboarding}
          disabled={onboardingLoading}
          className="rounded-lg border-2 border-emerald-400/50 bg-emerald-500/30 backdrop-blur-sm px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500/40 transition-all duration-200 disabled:opacity-60 drop-shadow"
        >
          {onboardingLoading ? t('account.tutorial.resetting') : t('account.tutorial.resetButton')}
        </button>
      </section>

      <section className="rounded-2xl border-2 border-red-400/50 bg-red-500/20 backdrop-blur-xl p-6 shadow-2xl">
        <h2 className="text-lg font-semibold mb-2 text-red-300 drop-shadow">{t('account.deleteAccount.title')}</h2>
        <p className="text-sm text-white drop-shadow mb-3">
          ⚠️ {t('account.deleteAccount.description')}
        </p>
        <form onSubmit={openDeleteModal} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t('account.deleteAccount.passwordLabel')}</label>
            <PasswordInput
              id="deletePassword"
              name="deletePassword"
              value={deletePassword}
              onChange={event => setDeletePassword(event.target.value)}
              className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-red-400 focus:ring-2 focus:ring-red-400/50 focus:outline-none"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          {deleteError ? (
            <div className="rounded-lg border-2 border-red-400/50 bg-red-500/30 backdrop-blur-sm px-3 py-2 text-sm text-white drop-shadow">{deleteError}</div>
          ) : null}
          <div className="text-xs text-white/70 drop-shadow">
            {t('account.deleteAccount.passwordHint')}
          </div>
          <button
            type="submit"
            disabled={deleteLoading}
            className="rounded-lg border-2 border-red-400/50 bg-red-500/30 backdrop-blur-sm px-3 py-2 text-sm font-medium text-white hover:bg-red-500/40 transition-all duration-200 disabled:opacity-60 drop-shadow"
          >
            {deleteLoading ? t('account.deleteAccount.deleting') : t('account.deleteAccount.deleteButton')}
          </button>
        </form>
      </section>

      {/* Modal de confirmation de suppression */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => !deleteLoading && setShowDeleteModal(false)}
        >
          <div
            className="bg-gradient-to-br from-red-500/20 to-orange-500/20 border-2 border-red-400/50 rounded-2xl backdrop-blur-xl p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold text-red-300 drop-shadow mb-4">
              ⚠️ {t('account.deleteAccount.modal.title')}
            </h3>

            <div className="space-y-3 mb-6">
              <p className="text-sm text-white/90 drop-shadow">
                {t('account.deleteAccount.modal.description')}
              </p>

              <ul className="space-y-2 text-sm text-white/80">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>{t('account.deleteAccount.modal.consequences.noRefund')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>{t('account.deleteAccount.modal.consequences.loseCredits')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>{t('account.deleteAccount.modal.consequences.cancelSubscription')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>{t('account.deleteAccount.modal.consequences.deleteCvs')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>{t('account.deleteAccount.modal.consequences.deleteBankData')}</span>
                </li>
              </ul>
            </div>

            {/* Checkbox de confirmation */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={acceptedDeleteTerms}
                  onChange={(e) => setAcceptedDeleteTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded-sm border-2 border-white/30 bg-white/5 appearance-none cursor-pointer transition-all checked:bg-gradient-to-br checked:from-red-500/40 checked:to-red-600/40 checked:border-red-400/60 focus:ring-2 focus:ring-red-500/50 focus:ring-offset-0 relative checked:after:content-['✓'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-white checked:after:text-xs checked:after:font-bold"
                  disabled={deleteLoading}
                />
                <span className="text-sm text-white/80 group-hover:text-white transition-colors">
                  {t('account.deleteAccount.modal.confirmCheckbox')}
                </span>
              </label>
            </div>

            {/* Boutons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors disabled:opacity-50 font-medium"
              >
                {t('account.deleteAccount.modal.cancelButton')}
              </button>
              <button
                onClick={confirmDeleteAccount}
                disabled={deleteLoading || !acceptedDeleteTerms}
                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white transition-colors disabled:opacity-50 font-medium shadow-lg shadow-red-500/20"
              >
                {deleteLoading ? t('account.deleteAccount.modal.deleting') : t('account.deleteAccount.modal.confirmButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Fonctions helper pour l'indicateur de force du mot de passe
function getStrengthInfo(password) {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\';/~`]/.test(password);

  const validRules = [
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumbers,
    hasSpecialChars,
  ].filter(Boolean).length;

  if (validRules === 5) {
    if (password.length >= 16) {
      return { strength: "veryStrong", color: "text-emerald-600", bgColor: "bg-emerald-600", width: "100%" };
    } else if (password.length >= 14) {
      return { strength: "strong", color: "text-green-500", bgColor: "bg-green-500", width: "80%" };
    } else {
      return { strength: "medium", color: "text-yellow-500", bgColor: "bg-yellow-500", width: "60%" };
    }
  } else if (validRules >= 3) {
    return { strength: "medium", color: "text-yellow-500", bgColor: "bg-yellow-500", width: "40%" };
  }

  return { strength: "weak", color: "text-red-500", bgColor: "bg-red-500", width: "20%" };
}

function getStrengthLabel(password, t) {
  const info = getStrengthInfo(password);
  return t(`account.security.passwordStrength.${info.strength}`);
}

function getStrengthColor(password) {
  return getStrengthInfo(password).color;
}

function getStrengthBgColor(password) {
  return getStrengthInfo(password).bgColor;
}

function getStrengthWidth(password) {
  return getStrengthInfo(password).width;
}

// Composant pour afficher une règle de validation
function PasswordRule({ valid, text }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {valid ? (
        <span className="text-emerald-300 font-bold drop-shadow">✓</span>
      ) : (
        <span className="text-white/40">○</span>
      )}
      <span className={valid ? "text-emerald-300 font-medium drop-shadow" : "text-white/60 drop-shadow"}>
        {text}
      </span>
    </div>
  );
}
