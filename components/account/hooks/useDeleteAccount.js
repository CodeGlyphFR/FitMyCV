'use client';

import React from 'react';
import { signOut } from 'next-auth/react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * Hook for managing account deletion state
 */
export function useDeleteAccount({ user, isOAuthUser = false }) {
  const { t } = useLanguage();

  const [deletePassword, setDeletePassword] = React.useState('');
  const [deleteEmail, setDeleteEmail] = React.useState('');
  const [deleteError, setDeleteError] = React.useState('');
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [acceptedDeleteTerms, setAcceptedDeleteTerms] = React.useState(false);

  function openDeleteModal(event) {
    event.preventDefault();
    setDeleteError('');

    if (isOAuthUser) {
      if (!deleteEmail) {
        setDeleteError(t('account.deleteAccount.modal.errors.emailRequired'));
        return;
      }
    } else {
      if (!deletePassword) {
        setDeleteError(t('account.deleteAccount.modal.errors.passwordRequired'));
        return;
      }
    }

    setShowDeleteModal(true);
  }

  async function confirmDeleteAccount() {
    try {
      setDeleteLoading(true);
      const res = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isOAuthUser ? { email: deleteEmail } : { password: deletePassword }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(payload?.error || t('account.deleteAccount.modal.errors.deleteFailed'));
        setShowDeleteModal(false);
        setDeleteLoading(false);
        return;
      }

      await signOut({ callbackUrl: '/auth?mode=login' });
    } catch (error) {
      console.error(error);
      setDeleteError(t('account.deleteAccount.modal.errors.unexpected'));
      setShowDeleteModal(false);
      setDeleteLoading(false);
    }
  }

  function closeDeleteModal() {
    if (!deleteLoading) {
      setShowDeleteModal(false);
    }
  }

  return {
    deletePassword,
    setDeletePassword,
    deleteEmail,
    setDeleteEmail,
    deleteError,
    deleteLoading,
    showDeleteModal,
    acceptedDeleteTerms,
    setAcceptedDeleteTerms,
    openDeleteModal,
    confirmDeleteAccount,
    closeDeleteModal,
    t,
    user,
  };
}
