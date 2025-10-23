import React from "react";
import { useRecaptcha } from "@/hooks/useRecaptcha";

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
    if (!pdfFile) return;

    const fileName = pdfFile.name;

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
    closePdfImport();

    try {
      // Obtenir le token reCAPTCHA (vérification côté serveur uniquement)
      const recaptchaToken = await executeRecaptcha('import_pdf');
      if (!recaptchaToken) {
        removeOptimisticTask(optimisticTaskId);
        addNotification({
          type: "error",
          message: t("auth.errors.recaptchaFailed") || "Échec de la vérification anti-spam. Veuillez réessayer.",
          duration: 4000,
        });
        return;
      }

      const formData = new FormData();
      formData.append("pdfFile", pdfFile);
      formData.append("recaptchaToken", recaptchaToken);
      if (localDeviceId) {
        formData.append("deviceId", localDeviceId);
      }

      const response = await fetch("/api/background-tasks/import-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Impossible de mettre la tâche en file.");
      }

      removeOptimisticTask(optimisticTaskId);
      await refreshTasks();
    } catch (error) {
      removeOptimisticTask(optimisticTaskId);
      addNotification({
        type: "error",
        message: error?.message || t("pdfImport.notifications.error"),
        duration: 4000,
      });
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
      // Obtenir le token reCAPTCHA (vérification côté serveur uniquement)
      const recaptchaToken = await executeRecaptcha('create_cv');
      if (!recaptchaToken) {
        setNewCvError(t("auth.errors.recaptchaFailed") || "Échec de la vérification anti-spam. Veuillez réessayer.");
        setNewCvBusy(false);
        return;
      }

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
      if (!res.ok) throw new Error(data?.error || "Erreur");

      document.cookie = "cvFile=" + encodeURIComponent(data.file) + "; path=/; max-age=31536000";
      try {
        localStorage.setItem("admin:cv", data.file);
      } catch (_err) {}

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cv:list:changed"));
        window.dispatchEvent(new CustomEvent("cv:selected", { detail: { file: data.file } }));
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
      setNewCvError(e?.message || "Erreur");
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

    setJobTitleInput("");

    // Émettre un événement pour décrémenter optimistiquement le compteur
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tokens:optimistic-decrement'));
    }

    try {
      const formData = new FormData();
      formData.append("jobTitle", trimmedJobTitle);
      formData.append("language", language === 'en' ? 'anglais' : 'français');
      formData.append("analysisLevel", "medium");
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
        throw new Error(data?.error || "Impossible de mettre la tâche en file.");
      }

      removeOptimisticTask(optimisticTaskId);
      await refreshTasks();

      // Émettre l'événement pour mettre à jour les compteurs de tokens
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('tokens:updated'));
      }
    } catch (error) {
      removeOptimisticTask(optimisticTaskId);
      // Restaurer le compteur en cas d'erreur
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('tokens:updated'));
      }
      addNotification({
        type: "error",
        message: error?.message || t("jobTitleGenerator.notifications.error"),
        duration: 4000,
      });
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
