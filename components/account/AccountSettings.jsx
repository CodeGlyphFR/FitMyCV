"use client";

import React from "react";
import { signOut } from "next-auth/react";

export default function AccountSettings({ user }){
  const [name, setName] = React.useState(user?.name || "");
  const [email, setEmail] = React.useState(user?.email || "");
  const [profileMessage, setProfileMessage] = React.useState("");
  const [profileError, setProfileError] = React.useState("");
  const [profileLoading, setProfileLoading] = React.useState(false);

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
      setProfileMessage("Profil mis à jour.");
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
      <section className="rounded-2xl border bg-white/80 backdrop-blur p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Informations du profil</h2>
        <form onSubmit={updateProfile} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-neutral-600">Nom complet</label>
            <input
              type="text"
              value={name}
              onChange={event => setName(event.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="Prénom Nom"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-neutral-600">Adresse email</label>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="prenom@exemple.com"
            />
          </div>
          {profileError ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{profileError}</div> : null}
          {profileMessage ? <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{profileMessage}</div> : null}
          <button
            type="submit"
            disabled={profileLoading}
            className="rounded border border-emerald-500 bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {profileLoading ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border bg-white/80 backdrop-blur p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Sécurité</h2>
        <form onSubmit={updatePassword} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-neutral-600">Mot de passe actuel</label>
            <input
              type="password"
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="••••••••"
            />
            <p className="text-xs text-neutral-500">Laissez vide si vous n'avez jamais défini de mot de passe.</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-neutral-600">Nouveau mot de passe</label>
            <input
              type="password"
              value={newPassword}
              onChange={event => setNewPassword(event.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-neutral-600">Confirmation</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="••••••••"
            />
          </div>
          {passwordError ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{passwordError}</div> : null}
          {passwordMessage ? <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{passwordMessage}</div> : null}
          <button
            type="submit"
            disabled={passwordLoading}
            className="rounded border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
          >
            {passwordLoading ? "Mise à jour…" : "Mettre à jour le mot de passe"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-red-300 bg-red-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-2 text-red-700">Supprimer le compte</h2>
        <p className="text-sm text-red-700 mb-3">
          Cette action est définitive : tous vos CV et données seront effacés. Tapez votre mot de passe pour confirmer.
        </p>
        <form onSubmit={deleteAccount} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-red-700">Mot de passe</label>
            <input
              type="password"
              value={deletePassword}
              onChange={event => setDeletePassword(event.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="••••••••"
            />
          </div>
          {deleteError ? (
            <div className="rounded border border-red-200 bg-white px-3 py-2 text-sm text-red-700">{deleteError}</div>
          ) : null}
          <div className="text-xs text-red-600">
            Tous vos CV (dossier utilisateur inclus) seront supprimés. Cette opération est irréversible. Si vous avez créé le compte via un fournisseur externe, définissez d'abord un mot de passe dans la section Sécurité.
          </div>
          <button
            type="submit"
            disabled={deleteLoading}
            className="rounded border border-red-600 bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {deleteLoading ? "Suppression…" : "Supprimer mon compte"}
          </button>
        </form>
      </section>
    </div>
  );
}
