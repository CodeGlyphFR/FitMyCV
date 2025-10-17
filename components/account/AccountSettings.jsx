"use client";

import React from "react";
import { signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import PasswordStrengthIndicator from "@/components/auth/PasswordStrengthIndicator";
import PasswordInput from "@/components/ui/PasswordInput";

export default function AccountSettings({ user, isOAuthUser = false, oauthProviders = [] }){
  const searchParams = useSearchParams();
  const [name, setName] = React.useState(user?.name || "");
  const [email, setEmail] = React.useState(user?.email || "");
  const [profileMessage, setProfileMessage] = React.useState("");
  const [profileError, setProfileError] = React.useState("");
  const [profileLoading, setProfileLoading] = React.useState(false);

  // Vérifier si l'email a été changé avec succès
  React.useEffect(() => {
    if (searchParams.get('email-changed') === 'true') {
      setProfileMessage("Votre adresse email a été modifiée avec succès !");
      // Mettre à jour l'email affiché
      setEmail(user?.email || "");
    }
  }, [searchParams, user?.email]);

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordMessage, setPasswordMessage] = React.useState("");
  const [passwordError, setPasswordError] = React.useState("");
  const [passwordLoading, setPasswordLoading] = React.useState(false);

  const [deletePassword, setDeletePassword] = React.useState("");
  const [deleteError, setDeleteError] = React.useState("");
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  async function updateProfile(event){
    event.preventDefault();
    setProfileMessage("");
    setProfileError("");

    if (!name && !email){
      setProfileError("Aucun changement détecté.");
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
        setProfileError(payload?.error || "Impossible de mettre à jour le profil.");
        return;
      }

      // Gérer le message de succès en fonction de la réponse
      if (payload?.emailChangeRequested) {
        setProfileMessage(payload?.message || "Un email de vérification a été envoyé à votre nouvelle adresse.");
      } else {
        setProfileMessage(payload?.message || "Profil mis à jour.");
      }
    } catch (error) {
      console.error(error);
      setProfileError("Erreur inattendue.");
    } finally {
      setProfileLoading(false);
    }
  }

  async function updatePassword(event){
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    if (!newPassword){
      setPasswordError("Renseignez un nouveau mot de passe.");
      return;
    }
    if (newPassword.length < 8){
      setPasswordError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword){
      setPasswordError("Les mots de passe ne correspondent pas.");
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
        setPasswordError(payload?.error || "Impossible de mettre à jour le mot de passe.");
        return;
      }
      setPasswordMessage("Mot de passe mis à jour.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      setPasswordError("Erreur inattendue.");
    } finally {
      setPasswordLoading(false);
    }
  }

  async function deleteAccount(event){
    event.preventDefault();
    setDeleteError("");

    if (!deletePassword){
      setDeleteError("Veuillez saisir votre mot de passe pour confirmer la suppression.");
      return;
    }

    const confirmed = window.confirm("Cette action est irréversible. Confirmez la suppression de votre compte ?");
    if (!confirmed) return;

    try {
      setDeleteLoading(true);
      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok){
        setDeleteError(payload?.error || "Suppression impossible. Réessayez.");
        return;
      }

      await signOut({ callbackUrl: "/auth?mode=login" });
    } catch (error) {
      console.error(error);
      setDeleteError("Erreur inattendue lors de la suppression du compte.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border-2 border-white/30 bg-white/15 backdrop-blur-xl p-6 shadow-2xl">
        <h2 className="text-lg font-semibold mb-4 text-emerald-300 drop-shadow">Informations du profil</h2>
        <form onSubmit={updateProfile} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">Nom complet</label>
            <input
              type="text"
              value={name}
              onChange={event => setName(event.target.value)}
              className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none"
              placeholder="Prénom Nom"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">Adresse email</label>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              className={`w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none ${isOAuthUser ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder="prenom@exemple.com"
              disabled={isOAuthUser}
            />
            {isOAuthUser && (
              <p className="text-xs text-white/60 drop-shadow">
                Votre email est lié à votre compte {oauthProviders.length > 0 ? oauthProviders.join(', ') : 'OAuth'} et ne peut pas être modifié ici.
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
            {profileLoading ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border-2 border-white/30 bg-white/15 backdrop-blur-xl p-6 shadow-2xl">
        <h2 className="text-lg font-semibold mb-4 text-emerald-300 drop-shadow">Sécurité</h2>
        <form onSubmit={updatePassword} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">Mot de passe actuel</label>
            <PasswordInput
              id="currentPassword"
              name="currentPassword"
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
              className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none"
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <p className="text-xs text-white/60 drop-shadow">Laissez vide si vous n'avez jamais défini de mot de passe.</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">Nouveau mot de passe</label>
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
                    <span className="text-white/70 drop-shadow">Force du mot de passe</span>
                    <span className={`font-medium ${getStrengthColor(newPassword)}`}>
                      {getStrengthLabel(newPassword)}
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
                  <p className="text-xs font-medium text-white/70 drop-shadow">Règles de sécurité</p>
                  <PasswordRule
                    valid={newPassword.length >= 12}
                    text="Au moins 12 caractères"
                  />
                  <PasswordRule
                    valid={/[A-Z]/.test(newPassword)}
                    text="Au moins une majuscule"
                  />
                  <PasswordRule
                    valid={/[a-z]/.test(newPassword)}
                    text="Au moins une minuscule"
                  />
                  <PasswordRule
                    valid={/[0-9]/.test(newPassword)}
                    text="Au moins un chiffre"
                  />
                  <PasswordRule
                    valid={/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\';/~`]/.test(newPassword)}
                    text="Au moins un caractère spécial"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">Confirmation</label>
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
            {passwordLoading ? "Mise à jour…" : "Mettre à jour le mot de passe"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border-2 border-red-400/50 bg-red-500/20 backdrop-blur-xl p-6 shadow-2xl">
        <h2 className="text-lg font-semibold mb-2 text-red-300 drop-shadow">Supprimer le compte</h2>
        <p className="text-sm text-white drop-shadow mb-3">
          Cette action est définitive : tous vos CV et données seront effacés. Tapez votre mot de passe pour confirmer.
        </p>
        <form onSubmit={deleteAccount} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">Mot de passe</label>
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
            Tous vos CV (dossier utilisateur inclus) seront supprimés. Cette opération est irréversible. Si vous avez créé le compte via un fournisseur externe, définissez d'abord un mot de passe dans la section Sécurité.
          </div>
          <button
            type="submit"
            disabled={deleteLoading}
            className="rounded-lg border-2 border-red-400/50 bg-red-500/30 backdrop-blur-sm px-3 py-2 text-sm font-medium text-white hover:bg-red-500/40 transition-all duration-200 disabled:opacity-60 drop-shadow"
          >
            {deleteLoading ? "Suppression…" : "Supprimer mon compte"}
          </button>
        </form>
      </section>
    </div>
  );
}

// Fonctions helper pour l'indicateur de force du mot de passe
function getStrengthInfo(password) {
  const hasMinLength = password.length >= 12;
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
      return { strength: "very_strong", label: "Très fort", color: "text-emerald-600", bgColor: "bg-emerald-600", width: "100%" };
    } else if (password.length >= 14) {
      return { strength: "strong", label: "Fort", color: "text-green-500", bgColor: "bg-green-500", width: "80%" };
    } else {
      return { strength: "medium", label: "Moyen", color: "text-yellow-500", bgColor: "bg-yellow-500", width: "60%" };
    }
  } else if (validRules >= 3) {
    return { strength: "medium", label: "Moyen", color: "text-yellow-500", bgColor: "bg-yellow-500", width: "40%" };
  }

  return { strength: "weak", label: "Faible", color: "text-red-500", bgColor: "bg-red-500", width: "20%" };
}

function getStrengthLabel(password) {
  return getStrengthInfo(password).label;
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
