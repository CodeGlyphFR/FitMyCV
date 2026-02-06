'use client';

import { useState } from 'react';

/**
 * Hook for user CRUD actions (role change, email validation, delete, add, update)
 */
export function useUserActions({ onSuccess, onError, refetch }) {
  const [updating, setUpdating] = useState(false);

  async function handleRoleChange(userId, newRole) {
    if (updating) return;

    try {
      setUpdating(true);
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateRole', role: newRole }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Erreur lors de la mise à jour du rôle');
      }

      onSuccess?.('Rôle mis à jour avec succès');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await refetch?.();
    } catch (err) {
      console.error('Error updating role:', err);
      onError?.(err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function handleValidateEmail(userId) {
    if (updating) return;

    try {
      setUpdating(true);
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validateEmail' }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Erreur lors de la validation');
      }

      onSuccess?.('Email validé avec succès');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await refetch?.();
    } catch (err) {
      console.error('Error validating email:', err);
      onError?.(err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteUser(userId) {
    if (updating) return;

    try {
      setUpdating(true);
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Erreur lors de la suppression');
      }

      onSuccess?.('Utilisateur supprimé avec succès');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await refetch?.();
    } catch (err) {
      console.error('Error deleting user:', err);
      onError?.(err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function handleAddUser({ email, name, password, role }) {
    if (!email?.trim()) {
      onError?.('Email requis');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      onError?.('Format email invalide');
      return false;
    }

    if (!name?.trim()) {
      onError?.('Nom requis');
      return false;
    }

    if (!password?.trim()) {
      onError?.('Mot de passe requis');
      return false;
    }

    if (password.trim().length < 8) {
      onError?.('Le mot de passe doit contenir au moins 8 caractères');
      return false;
    }

    if (updating) return false;

    try {
      setUpdating(true);
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          password: password.trim(),
          role,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Erreur lors de la création de l\'utilisateur');
      }

      onSuccess?.('Utilisateur créé avec succès');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await refetch?.();
      return true;
    } catch (err) {
      console.error('Error creating user:', err);
      onError?.(err.message);
      return false;
    } finally {
      setUpdating(false);
    }
  }

  async function handleUpdateUser(userId, { email, hasOAuth, currentEmail }) {
    if (!email?.trim()) {
      onError?.('Email invalide');
      return false;
    }

    if (updating) return false;

    try {
      setUpdating(true);

      if (email.trim() !== currentEmail) {
        if (hasOAuth) {
          throw new Error('Impossible de modifier l\'email d\'un utilisateur OAuth');
        }

        const emailResponse = await fetch(`/api/admin/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'updateEmail', email: email.trim() }),
        });

        if (!emailResponse.ok) {
          const errorData = await emailResponse.json().catch(() => ({ error: 'Erreur serveur' }));
          throw new Error(errorData.error || 'Erreur lors de la modification de l\'email');
        }
      }

      onSuccess?.('Utilisateur modifié avec succès');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await refetch?.();
      return true;
    } catch (err) {
      console.error('Error updating user:', err);
      onError?.(err.message);
      return false;
    } finally {
      setUpdating(false);
    }
  }

  return {
    updating,
    handleRoleChange,
    handleValidateEmail,
    handleDeleteUser,
    handleAddUser,
    handleUpdateUser,
  };
}
