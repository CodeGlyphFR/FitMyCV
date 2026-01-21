'use client';

import React from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { showLoadingOverlay } from '@/lib/loading/loadingEvents';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { useBackgroundTasks } from '@/components/BackgroundTasksProvider';
import { parseApiError } from '@/lib/utils/errorHandler';

/**
 * Hook for managing PDF import state and logic
 */
export function usePdfImport() {
  const { t } = useLanguage();
  const { addNotification } = useNotifications();
  const { executeRecaptcha } = useRecaptcha();
  const { localDeviceId } = useBackgroundTasks();

  const [openPdfImport, setOpenPdfImport] = React.useState(false);
  const [pdfFile, setPdfFile] = React.useState(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState(0);
  const [importFileName, setImportFileName] = React.useState('');
  const [loadingMessage, setLoadingMessage] = React.useState('');

  const pdfFileInputRef = React.useRef(null);
  const pollIntervalRef = React.useRef(null);
  const timeoutRef = React.useRef(null);
  const progressIntervalRef = React.useRef(null);
  const messageIntervalRef = React.useRef(null);

  const loadingMessages = t('emptyState.importing.loadingMessages');

  function onPdfFileChanged(event) {
    const file = event.target.files?.[0] || null;
    setPdfFile(file);
  }

  function closePdfImport() {
    setOpenPdfImport(false);
    setPdfFile(null);
    if (pdfFileInputRef.current) pdfFileInputRef.current.value = '';
  }

  async function submitPdfImport(event) {
    event.preventDefault();
    if (!pdfFile) return;

    const fileName = pdfFile.name;

    try {
      const recaptchaToken = await executeRecaptcha('import_pdf');

      const formData = new FormData();
      formData.append('pdfFile', pdfFile);
      formData.append('recaptchaToken', recaptchaToken);
      if (localDeviceId) {
        formData.append('deviceId', localDeviceId);
      }

      const response = await fetch('/api/background-tasks/import-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        const apiError = parseApiError(response, data);
        const errorObj = { message: apiError.message };
        if (apiError.actionRequired && apiError.redirectUrl) {
          errorObj.actionRequired = true;
          errorObj.redirectUrl = apiError.redirectUrl;
        }
        throw errorObj;
      }

      setImportFileName(fileName);
      closePdfImport();
      setIsImporting(true);
      setImportProgress(0);

      startPollingForCompletion();
    } catch (error) {
      closePdfImport();

      const notification = {
        type: 'error',
        message: error?.message || t('pdfImport.notifications.error'),
        duration: 10000,
      };

      if (error?.actionRequired && error?.redirectUrl) {
        notification.redirectUrl = error.redirectUrl;
        notification.linkText = 'Voir les options';
      }

      addNotification(notification);
    }
  }

  async function startPollingForCompletion() {
    let messageIndex = 0;

    let estimatedDuration = 60000;
    try {
      const durationRes = await fetch('/api/telemetry/first-import-duration');
      if (durationRes.ok) {
        const durationData = await durationRes.json();
        if (durationData.success && durationData.estimatedDuration) {
          estimatedDuration = durationData.estimatedDuration;
        }
      }
    } catch (error) {
      console.error('[EmptyState] Failed to fetch estimated duration:', error);
    }

    setLoadingMessage(loadingMessages[0]);

    messageIntervalRef.current = setInterval(() => {
      messageIndex = (messageIndex + 1) % loadingMessages.length;
      setLoadingMessage(loadingMessages[messageIndex]);
    }, 2500);

    const phases = [
      { target: 20, duration: 0.15, speed: 'fast' },
      { target: 50, duration: 0.40, speed: 'slow' },
      { target: 80, duration: 0.35, speed: 'medium' },
      { target: 85, duration: 0.10, speed: 'fast' },
    ];

    let currentPhaseIndex = 0;
    let currentProgress = 0;
    let elapsedTime = 0;
    const updateInterval = 100;

    let isCompleted = false;

    progressIntervalRef.current = setInterval(() => {
      if (isCompleted) return;

      elapsedTime += updateInterval;
      const currentPhase = phases[currentPhaseIndex];

      const phaseStartTime = phases
        .slice(0, currentPhaseIndex)
        .reduce((sum, p) => sum + p.duration * estimatedDuration, 0);
      const phaseDuration = currentPhase.duration * estimatedDuration;
      const phaseProgress = Math.min((elapsedTime - phaseStartTime) / phaseDuration, 1);

      const phaseStart = currentPhaseIndex > 0 ? phases[currentPhaseIndex - 1].target : 0;
      const phaseTarget = currentPhase.target;

      let easedProgress;
      if (currentPhase.speed === 'fast') {
        easedProgress = phaseProgress < 0.5
          ? 2 * phaseProgress * phaseProgress
          : 1 - Math.pow(-2 * phaseProgress + 2, 2) / 2;
      } else if (currentPhase.speed === 'slow') {
        easedProgress = phaseProgress;
      } else {
        easedProgress = phaseProgress < 0.5
          ? 4 * phaseProgress * phaseProgress * phaseProgress
          : 1 - Math.pow(-2 * phaseProgress + 2, 3) / 2;
      }

      currentProgress = phaseStart + (phaseTarget - phaseStart) * easedProgress;
      currentProgress = Math.max(0, Math.min(currentProgress, currentPhase.target));

      setImportProgress(Math.round(currentProgress * 10) / 10);

      if (phaseProgress >= 1 && currentPhaseIndex < phases.length - 1) {
        currentPhaseIndex++;
      }

      if (currentProgress >= 85) {
        clearInterval(progressIntervalRef.current);
      }
    }, updateInterval);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/cvs?_=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.items && data.items.length > 0) {
            isCompleted = true;
            clearInterval(pollIntervalRef.current);
            clearInterval(progressIntervalRef.current);
            clearInterval(messageIntervalRef.current);
            clearTimeout(timeoutRef.current);

            const currentProgressValue = currentProgress;
            const animationDuration = 600;
            const animationSteps = 30;
            const stepDuration = animationDuration / animationSteps;
            let step = 0;

            const animateToComplete = setInterval(() => {
              step++;
              const progress = currentProgressValue + ((100 - currentProgressValue) * (step / animationSteps));
              setImportProgress(Math.round(progress * 10) / 10);

              if (step >= animationSteps) {
                clearInterval(animateToComplete);
                setImportProgress(100);
                setLoadingMessage(t('emptyState.importing.ready'));

                const newCv = data.items[0];
                if (newCv.file) {
                  document.cookie = `cvFile=${encodeURIComponent(newCv.file)}; path=/; max-age=31536000`;
                  localStorage.setItem('admin:cv', newCv.file);
                }

                setTimeout(() => {
                  showLoadingOverlay();
                  window.location.href = '/';
                }, 1000);
              }
            }, stepDuration);
          }
        }
      } catch (error) {
        console.error('Error polling for CV:', error);
      }
    }, 2000);

    timeoutRef.current = setTimeout(() => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        clearInterval(progressIntervalRef.current);
        clearInterval(messageIntervalRef.current);
        setIsImporting(false);
        alert(t('emptyState.importing.timeoutAlert'));
      }
    }, 300000);
  }

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return {
    // State
    openPdfImport,
    setOpenPdfImport,
    pdfFile,
    isImporting,
    importProgress,
    importFileName,
    loadingMessage,
    pdfFileInputRef,
    // Actions
    onPdfFileChanged,
    closePdfImport,
    submitPdfImport,
    t,
  };
}
