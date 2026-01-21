"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { useBackgroundTasks } from "@/components/BackgroundTasksProvider";
import { parseApiError } from "@/lib/utils/errorHandler";

/**
 * Hook for managing translation dropdown and executing translations
 */
export function useTranslation() {
  const { t } = useLanguage();
  const { localDeviceId, addOptimisticTask, removeOptimisticTask, refreshTasks } = useBackgroundTasks();
  const { addNotification } = useNotifications();

  const [isTranslateDropdownOpen, setIsTranslateDropdownOpen] = useState(false);
  const translateDropdownRef = useRef(null);

  // Fermer le dropdown de traduction quand on clique à l'extérieur
  useEffect(() => {
    function handleClickOutside(event) {
      if (translateDropdownRef.current && !translateDropdownRef.current.contains(event.target)) {
        setIsTranslateDropdownOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsTranslateDropdownOpen(false);
      }
    }

    if (isTranslateDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [isTranslateDropdownOpen]);

  const executeTranslation = useCallback(async (targetLanguage) => {
    // Fermer le dropdown
    setIsTranslateDropdownOpen(false);

    // Récupérer le fichier CV actuel depuis le cookie
    let currentFile = null;
    try {
      const cookies = document.cookie.split(';');
      const cvFileCookie = cookies.find(c => c.trim().startsWith('cvFile='));
      if (cvFileCookie) {
        currentFile = decodeURIComponent(cvFileCookie.split('=')[1]);
      }
    } catch (err) {
      // ignore
    }

    if (!currentFile) {
      addNotification({
        type: "error",
        message: t("translate.errors.noCvSelected"),
        duration: 3000,
      });
      return;
    }

    const targetLangName = {
      fr: 'français',
      en: 'anglais',
      es: 'español',
      de: 'deutsch'
    }[targetLanguage] || targetLanguage;

    // Envoyer la requête en arrière-plan
    try {
      const response = await fetch("/api/background-tasks/translate-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceFile: currentFile,
          targetLanguage,
          deviceId: localDeviceId,
        }),
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

      // Succès confirmé par l'API -> créer la tâche optimiste et notifier
      const optimisticTaskId = addOptimisticTask({
        type: 'translate-cv',
        label: `Traduction en ${targetLangName}`,
        metadata: { sourceFile: currentFile, targetLanguage },
        shouldUpdateCvList: true,
      });

      addNotification({
        type: "info",
        message: t("translate.notifications.scheduled", { targetLangName }),
        duration: 2500,
      });

      // Rafraîchir et supprimer la tâche optimiste
      await refreshTasks();
      removeOptimisticTask(optimisticTaskId);
    } catch (error) {
      // Échec : notifier l'erreur
      const notification = {
        type: "error",
        message: error?.message || t("translate.notifications.error"),
        duration: 10000,
      };

      if (error?.actionRequired && error?.redirectUrl) {
        notification.redirectUrl = error.redirectUrl;
        notification.linkText = 'Voir les options';
      }

      addNotification(notification);
    }
  }, [t, addNotification, localDeviceId, addOptimisticTask, removeOptimisticTask, refreshTasks]);

  return {
    isTranslateDropdownOpen,
    setIsTranslateDropdownOpen,
    translateDropdownRef,
    executeTranslation,
  };
}
