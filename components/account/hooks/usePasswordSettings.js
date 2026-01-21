'use client';

import React from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * Hook for managing password change state
 */
export function usePasswordSettings() {
  const { t } = useLanguage();

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordMessage, setPasswordMessage] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');
  const [passwordLoading, setPasswordLoading] = React.useState(false);

  async function updatePassword(event) {
    event.preventDefault();
    setPasswordMessage('');
    setPasswordError('');

    if (!newPassword) {
      setPasswordError(t('account.security.errors.newPasswordRequired'));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t('account.security.errors.minLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('account.security.errors.mismatch'));
      return;
    }

    try {
      setPasswordLoading(true);
      const res = await fetch('/api/account/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPasswordError(payload?.error || t('account.security.errors.updateFailed'));
        return;
      }
      setPasswordMessage(t('account.security.success'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error(error);
      setPasswordError(t('account.security.errors.unexpected'));
    } finally {
      setPasswordLoading(false);
    }
  }

  return {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    passwordMessage,
    passwordError,
    passwordLoading,
    updatePassword,
    t,
  };
}

/**
 * Password strength helpers
 */
export function getStrengthInfo(password) {
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
      return { strength: 'veryStrong', color: 'text-emerald-600', bgColor: 'bg-emerald-600', width: '100%' };
    } else if (password.length >= 14) {
      return { strength: 'strong', color: 'text-green-500', bgColor: 'bg-green-500', width: '80%' };
    } else {
      return { strength: 'medium', color: 'text-yellow-500', bgColor: 'bg-yellow-500', width: '60%' };
    }
  } else if (validRules >= 3) {
    return { strength: 'medium', color: 'text-yellow-500', bgColor: 'bg-yellow-500', width: '40%' };
  }

  return { strength: 'weak', color: 'text-red-500', bgColor: 'bg-red-500', width: '20%' };
}

export function getStrengthLabel(password, t) {
  const info = getStrengthInfo(password);
  return t(`account.security.passwordStrength.${info.strength}`);
}

export function getStrengthColor(password) {
  return getStrengthInfo(password).color;
}

export function getStrengthBgColor(password) {
  return getStrengthInfo(password).bgColor;
}

export function getStrengthWidth(password) {
  return getStrengthInfo(password).width;
}
