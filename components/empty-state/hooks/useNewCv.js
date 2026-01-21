'use client';

import React from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { showLoadingOverlay } from '@/lib/loading/loadingEvents';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { parseApiError } from '@/lib/utils/errorHandler';

/**
 * Hook for managing new CV creation state and logic
 */
export function useNewCv() {
  const { t } = useLanguage();
  const { addNotification } = useNotifications();
  const { executeRecaptcha } = useRecaptcha();

  const [openNewCv, setOpenNewCv] = React.useState(false);
  const [newCvFullName, setNewCvFullName] = React.useState('');
  const [newCvCurrentTitle, setNewCvCurrentTitle] = React.useState('');
  const [newCvEmail, setNewCvEmail] = React.useState('');
  const [newCvBusy, setNewCvBusy] = React.useState(false);
  const [newCvError, setNewCvError] = React.useState(null);

  function resetNewCvForm() {
    setNewCvFullName('');
    setNewCvCurrentTitle('');
    setNewCvEmail('');
    setNewCvError(null);
  }

  function openNewCvModal() {
    resetNewCvForm();
    setOpenNewCv(true);
  }

  function closeNewCvModal() {
    setOpenNewCv(false);
  }

  async function createNewCv() {
    const trimmedName = newCvFullName.trim();
    const trimmedTitle = newCvCurrentTitle.trim();

    if (!trimmedName || !trimmedTitle) {
      setNewCvError(t('newCvModal.errors.fillRequired'));
      return;
    }

    setNewCvBusy(true);
    setNewCvError(null);
    try {
      const recaptchaToken = await executeRecaptcha('create_cv');

      const res = await fetch('/api/cvs/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          full_name: trimmedName,
          current_title: trimmedTitle,
          email: newCvEmail.trim(),
          recaptchaToken: recaptchaToken
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const apiError = parseApiError(res, data);
        const errorObj = new Error(apiError.message);
        if (apiError.actionRequired && apiError.redirectUrl) {
          errorObj.actionRequired = true;
          errorObj.redirectUrl = apiError.redirectUrl;
        }
        throw errorObj;
      }

      document.cookie = 'cvFile=' + encodeURIComponent(data.file) + '; path=/; max-age=31536000';
      try {
        localStorage.setItem('admin:cv', data.file);
      } catch (_err) {}

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cv:list:changed'));
        window.dispatchEvent(new CustomEvent('cv:selected', { detail: { file: data.file } }));
        window.dispatchEvent(new Event('credits-updated'));
      }

      setOpenNewCv(false);
      resetNewCvForm();

      showLoadingOverlay();
      window.location.href = '/';
    } catch (e) {
      if (e?.actionRequired && e?.redirectUrl) {
        setOpenNewCv(false);
        addNotification({
          type: 'error',
          message: e.message,
          redirectUrl: e.redirectUrl,
          linkText: 'Voir les options',
          duration: 10000,
        });
      } else {
        setNewCvError(e?.message || t('newCvModal.errors.generic'));
      }
    } finally {
      setNewCvBusy(false);
    }
  }

  return {
    // State
    openNewCv,
    newCvFullName,
    setNewCvFullName,
    newCvCurrentTitle,
    setNewCvCurrentTitle,
    newCvEmail,
    setNewCvEmail,
    newCvBusy,
    newCvError,
    setNewCvError,
    // Actions
    openNewCvModal,
    closeNewCvModal,
    createNewCv,
    t,
  };
}
