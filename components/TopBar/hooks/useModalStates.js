import React from "react";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { parseApiError } from "@/lib/utils/errorHandler";

/**
 * Hook pour gérer tous les états de modals et UI
 */
export function useModalStates({ t, addOptimisticTask, removeOptimisticTask, refreshTasks, addNotification, localDeviceId, reload, router }) {
  const { executeRecaptcha } = useRecaptcha();
  // Delete modal
  const [openDelete, setOpenDelete] = React.useState(false);

  // PDF Import modal
  const [openPdfImport, setOpenPdfImport] = React.useState(false);
  const [pdfFile, setPdfFile] = React.useState(null);
  const [pdfImportBusy, setPdfImportBusy] = React.useState(false);
  const pdfFileInputRef = React.useRef(null);

  function resetPdfImportState() {
    setPdfFile(null);
    if (pdfFileInputRef.current) pdfFileInputRef.current.value = "";
  }

  function closePdfImport() {
    setOpenPdfImport(false);
    resetPdfImportState();
  }

  function onPdfFileChanged(event) {
    const file = event.target.files?.[0] || null;
    setPdfFile(file);
  }

  async function submitPdfImport(event) {
    event.preventDefault();
    if (!pdfFile || pdfImportBusy) return;

    setPdfImportBusy(true);
    const fileName = pdfFile.name;

    try {
      // Obtenir le token reCAPTCHA (le serveur gère BYPASS_RECAPTCHA)
      const recaptchaToken = await executeRecaptcha('import_pdf');
      // Ne pas bloquer si null - le serveur décidera

      const formData = new FormData();
      formData.append("pdfFile", pdfFile);
      formData.append("recaptchaToken", recaptchaToken || '');
      if (localDeviceId) {
        formData.append("deviceId", localDeviceId);
      }

      const response = await fetch("/api/background-tasks/import-pdf", {
        method: "POST",
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

      // ✅ Succès confirmé par l'API -> créer la tâche optimiste et notifier
      const optimisticTaskId = addOptimisticTask({
        type: 'import-pdf',
        label: `Import '${fileName}'`,
        metadata: { fileName },
        shouldUpdateCvList: true,
      });

      addNotification({
        type: "info",
        message: t("pdfImport.notifications.scheduled", { fileName }),
        duration: 2500,
      });

      // Fermer le modal IMMÉDIATEMENT pour feedback utilisateur
      // (avant que refreshTasks puisse déclencher des événements qui unmount le composant)
      removeOptimisticTask(optimisticTaskId);
      closePdfImport();

      // Puis rafraîchir en arrière-plan
      try {
        await refreshTasks();
      } catch (error) {
        console.error('[PDF Import] Failed to refresh tasks:', error);
        // Le polling (10s interval) rattrapera de toute façon
      }
    } catch (error) {
      // Fermer le modal avant d'afficher l'erreur
      closePdfImport();

      const notification = {
        type: "error",
        message: error?.message || t("pdfImport.notifications.error"),
        duration: 10000,
      };

      // Add redirect info if actionRequired
      if (error?.actionRequired && error?.redirectUrl) {
        notification.redirectUrl = error.redirectUrl;
        notification.linkText = 'Voir les options';
      }

      addNotification(notification);
    } finally {
      setPdfImportBusy(false);
    }
  }

  // New CV modal
  const [openNewCv, setOpenNewCv] = React.useState(false);
  const [newCvFullName, setNewCvFullName] = React.useState("");
  const [newCvCurrentTitle, setNewCvCurrentTitle] = React.useState("");
  const [newCvEmail, setNewCvEmail] = React.useState("");
  const [newCvBusy, setNewCvBusy] = React.useState(false);
  const [newCvError, setNewCvError] = React.useState(null);

  async function createNewCv() {
    const trimmedName = newCvFullName.trim();
    const trimmedTitle = newCvCurrentTitle.trim();

    if (!trimmedName || !trimmedTitle) {
      setNewCvError(t("newCvModal.errors.fillRequired"));
      return;
    }

    setNewCvBusy(true);
    setNewCvError(null);
    try {
      // Obtenir le token reCAPTCHA (le serveur gère BYPASS_RECAPTCHA)
      const recaptchaToken = await executeRecaptcha('create_cv');
      // Ne pas bloquer si null - le serveur décidera

      const res = await fetch("/api/cvs/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
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

      document.cookie = "cvFile=" + encodeURIComponent(data.file) + "; path=/; max-age=31536000";
      try {
        localStorage.setItem("admin:cv", data.file);
      } catch (_err) {}

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cv:list:changed"));
        window.dispatchEvent(new CustomEvent("cv:selected", { detail: { file: data.file } }));
        window.dispatchEvent(new Event("credits-updated"));
      }

      setOpenNewCv(false);
      setNewCvFullName("");
      setNewCvCurrentTitle("");
      setNewCvEmail("");

      await reload(data.file);

      addNotification({
        type: "success",
        message: t("newCvModal.notifications.success"),
        duration: 3000,
      });

      router.refresh();
    } catch (e) {
      // Check if action is required (limits exceeded)
      if (e?.actionRequired && e?.redirectUrl) {
        // Close modal and show notification with action button
        setOpenNewCv(false);
        addNotification({
          type: "error",
          message: e.message,
          redirectUrl: e.redirectUrl,
          linkText: 'Voir les options',
          duration: 10000,
        });
      } else {
        setNewCvError(e?.message || "Erreur");
      }
    }
    setNewCvBusy(false);
  }

  // Task Queue
  const [openTaskQueue, setOpenTaskQueue] = React.useState(false);
  const [openTaskDropdown, setOpenTaskDropdown] = React.useState(false);

  // Job Title Input
  const [jobTitleInput, setJobTitleInput] = React.useState("");

  async function handleJobTitleSubmit(event, language) {
    if (event.key !== 'Enter') return;

    const trimmedJobTitle = jobTitleInput.trim();
    if (!trimmedJobTitle) return;

    setJobTitleInput("");

    // Émettre un événement pour décrémenter optimistiquement le compteur
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tokens:optimistic-decrement'));
    }

    try {
      const formData = new FormData();
      formData.append("jobTitle", trimmedJobTitle);
      formData.append("language", language === 'en' ? 'anglais' : 'français');
      if (localDeviceId) {
        formData.append("deviceId", localDeviceId);
      }

      const response = await fetch("/api/background-tasks/generate-cv-from-job-title", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      // Gérer le rate limit (429)
      if (response.status === 429) {
        const hours = data.hoursLeft || 0;
        const minutes = data.minutesLeft || 0;
        throw new Error(t("matchScore.rateLimitExceeded", { hours, minutes }) || `Plus de tokens disponibles. Réessayez dans ${hours}h${minutes}m.`);
      }

      if (!response.ok || !data?.success) {
        const apiError = parseApiError(response, data);
        const errorObj = { message: apiError.message };
        if (apiError.actionRequired && apiError.redirectUrl) {
          errorObj.actionRequired = true;
          errorObj.redirectUrl = apiError.redirectUrl;
        }
        throw errorObj;
      }

      // ✅ Succès confirmé par l'API -> créer la tâche optimiste et notifier
      const optimisticTaskId = addOptimisticTask({
        type: 'job-title-generation',
        label: t("jobTitleGenerator.notifications.scheduled", { jobTitle: trimmedJobTitle }),
        metadata: { jobTitle: trimmedJobTitle },
        shouldUpdateCvList: true,
      });

      addNotification({
        type: "info",
        message: t("jobTitleGenerator.notifications.scheduled", { jobTitle: trimmedJobTitle }),
        duration: 2500,
      });

      await refreshTasks();
      removeOptimisticTask(optimisticTaskId);

      // Émettre l'événement pour mettre à jour les compteurs de tokens
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('tokens:updated'));
      }
    } catch (error) {
      // Restaurer le compteur en cas d'erreur
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('tokens:updated'));
      }

      const notification = {
        type: "error",
        message: error?.message || t("jobTitleGenerator.notifications.error"),
        duration: 10000,
      };

      // Add redirect info if actionRequired
      if (error?.actionRequired && error?.redirectUrl) {
        notification.redirectUrl = error.redirectUrl;
        notification.linkText = 'Voir les options';
      }

      addNotification(notification);
    }
  }

  // User menu
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [userMenuRect, setUserMenuRect] = React.useState(null);

  // CV Selector
  const [listOpen, setListOpen] = React.useState(false);
  const [dropdownRect, setDropdownRect] = React.useState(null);

  return {
    // Delete modal
    openDelete,
    setOpenDelete,

    // PDF Import
    openPdfImport,
    setOpenPdfImport,
    pdfFile,
    setPdfFile,
    pdfImportBusy,
    pdfFileInputRef,
    closePdfImport,
    onPdfFileChanged,
    submitPdfImport,

    // New CV
    openNewCv,
    setOpenNewCv,
    newCvFullName,
    setNewCvFullName,
    newCvCurrentTitle,
    setNewCvCurrentTitle,
    newCvEmail,
    setNewCvEmail,
    newCvBusy,
    setNewCvBusy,
    newCvError,
    setNewCvError,
    createNewCv,

    // Task Queue
    openTaskQueue,
    setOpenTaskQueue,
    openTaskDropdown,
    setOpenTaskDropdown,

    // Job Title
    jobTitleInput,
    setJobTitleInput,
    handleJobTitleSubmit,

    // User Menu
    userMenuOpen,
    setUserMenuOpen,
    userMenuRect,
    setUserMenuRect,

    // CV Selector
    listOpen,
    setListOpen,
    dropdownRect,
    setDropdownRect,
  };
}
