import React from "react";
import { CREATE_TEMPLATE_OPTION } from "../utils/constants";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { parseApiError } from "@/lib/utils/errorHandler";
import { TASK_TYPES } from "@/lib/backgroundTasks/taskTypes";
import { ONBOARDING_EVENTS } from "@/lib/onboarding/onboardingEvents";

/**
 * Hook pour gérer le modal de génération de CV
 */
export function useGeneratorModal({
  items,
  currentItem,
  lastSelectedMetaRef,
  current,
  addOptimisticTask,
  removeOptimisticTask,
  refreshTasks,
  addNotification,
  localDeviceId,
  t,
  addLinksToHistory,
}) {
  const { executeRecaptcha } = useRecaptcha();
  const [openGenerator, setOpenGenerator] = React.useState(false);
  const [linkInputs, setLinkInputs] = React.useState([""]);
  const [fileSelection, setFileSelection] = React.useState([]);
  const [generatorError, setGeneratorError] = React.useState("");
  const [generatorBaseFile, setGeneratorBaseFile] = React.useState("");
  const [baseSelectorOpen, setBaseSelectorOpen] = React.useState(false);
  const [linkHistoryDropdowns, setLinkHistoryDropdowns] = React.useState({});

  const fileInputRef = React.useRef(null);
  const isMountedRef = React.useRef(true);
  const onboardingGeneratorOpenedRef = React.useRef(false); // Tracker l'ouverture du modal pendant l'onboarding

  // Cleanup on unmount pour prévenir les race conditions
  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const generatorSourceItems = React.useMemo(
    () => items.filter((it) => !it.isGenerated),
    [items]
  );

  const generatorBaseItem = React.useMemo(
    () => generatorSourceItems.find((it) => it.file === generatorBaseFile) || null,
    [generatorSourceItems, generatorBaseFile]
  );

  React.useEffect(() => {
    if (!generatorSourceItems.length) {
      setGeneratorBaseFile(CREATE_TEMPLATE_OPTION);
      setBaseSelectorOpen(false);
      return;
    }
    setGeneratorBaseFile((prev) => {
      if (prev === CREATE_TEMPLATE_OPTION) {
        return prev;
      }
      if (prev && generatorSourceItems.some((it) => it.file === prev)) {
        return prev;
      }
      const preferred = generatorSourceItems.find((it) => it.file === current)
        || generatorSourceItems[0];
      return preferred ? preferred.file : prev;
    });
  }, [generatorSourceItems, current]);

  const openGeneratorModal = React.useCallback(() => {
    setBaseSelectorOpen(false);
    const manualItems = generatorSourceItems;
    let nextBase = "";

    const baseCandidate = currentItem || lastSelectedMetaRef.current;
    if (
      baseCandidate &&
      !baseCandidate.isGenerated &&
      manualItems.some((it) => it.file === baseCandidate.file)
    ) {
      nextBase = baseCandidate.file;
    } else {
      nextBase = manualItems[0]?.file || "";
    }

    setGeneratorBaseFile((prev) => {
      if (nextBase) return nextBase;
      return manualItems.some((it) => it.file === prev) ? prev : "";
    });
    setGeneratorError("");
    setOpenGenerator(true);
  }, [currentItem, generatorSourceItems, lastSelectedMetaRef]);

  // Écouter l'événement d'onboarding pour ouvrir le modal automatiquement (étape 2)
  React.useEffect(() => {
    let isMounted = true;

    const handleOnboardingOpen = () => {
      if (!isMounted) return;

      // Prévenir les ré-ouvertures multiples pendant l'onboarding
      if (onboardingGeneratorOpenedRef.current) {
        return;
      }

      try {
        onboardingGeneratorOpenedRef.current = true;
        openGeneratorModal();
      } catch (error) {
        console.error('[useGeneratorModal] Error in handleOnboardingOpen:', error);
      }
    };

    window.addEventListener(ONBOARDING_EVENTS.OPEN_GENERATOR, handleOnboardingOpen);
    return () => {
      isMounted = false;
      window.removeEventListener(ONBOARDING_EVENTS.OPEN_GENERATOR, handleOnboardingOpen);

      // Reset du flag au cleanup pour permettre une future utilisation
      // IMPORTANT: Ne pas reset dans closeGenerator() car ça permet les ré-ouvertures
      onboardingGeneratorOpenedRef.current = false;
    };
  }, [openGeneratorModal]);

  function resetGeneratorState() {
    setLinkInputs([""]);
    setFileSelection([]);
    setGeneratorError("");
    setBaseSelectorOpen(false);
    setLinkHistoryDropdowns({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function closeGenerator() {
    setOpenGenerator(false);
    resetGeneratorState();
    // Note: Le flag onboardingGeneratorOpenedRef n'est PAS reset ici pour éviter les ré-ouvertures
    // Il sera reset automatiquement dans le cleanup du useEffect (ligne 176)
  }

  function updateLink(value, index) {
    setLinkInputs((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function addLinkField() {
    setLinkInputs((prev) => [...prev, ""]);
  }

  function removeLinkField(index) {
    setLinkInputs((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return next.length ? next : [""];
    });
  }

  function onFilesChanged(event) {
    const files = Array.from(event.target.files || []);
    setFileSelection(files);
  }

  function clearFiles() {
    setFileSelection([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function submitGenerator(event) {
    event.preventDefault();

    const isTemplateCreation = generatorBaseFile === CREATE_TEMPLATE_OPTION;

    if (!generatorBaseFile) {
      setGeneratorError(t("cvGenerator.errors.selectReference"));
      return;
    }

    const cleanedLinks = linkInputs
      .map((l) => (l || "").trim())
      .filter(Boolean);
    const hasFiles = (fileSelection || []).length > 0;

    if (!cleanedLinks.length && !hasFiles) {
      setGeneratorError(t("cvGenerator.errors.addLinkOrFile"));
      return;
    }

    if (cleanedLinks.length > 0) {
      addLinksToHistory(cleanedLinks);
    }

    let endpoint, taskType, taskLabel, notificationMessage;

    if (isTemplateCreation) {
      taskType = TASK_TYPES.TEMPLATE_CREATION;
      taskLabel = t("cvGenerator.templateCreationLabel");
      notificationMessage = t("cvGenerator.notifications.templateScheduled");
      endpoint = "/api/background-tasks/create-template-cv";
    } else {
      const baseCvName = generatorBaseItem?.displayTitle || generatorBaseItem?.title || generatorBaseFile;
      taskType = TASK_TYPES.GENERATION;
      taskLabel = `Adaptation du CV '${baseCvName}'`;
      notificationMessage = t("cvGenerator.notifications.scheduled", { baseCvName });
      endpoint = "/api/background-tasks/generate-cv-v2";
    }

    try {
      // Obtenir le token reCAPTCHA (le serveur gère BYPASS_RECAPTCHA)
      const recaptchaToken = await executeRecaptcha('generate_cv');
      // Ne pas bloquer si null - le serveur décidera avec BYPASS_RECAPTCHA

      // Note: Pas de check isMountedRef ici - l'appel API doit TOUJOURS se faire
      // pour que la tâche soit créée sur le serveur et détectée par le polling

      const formData = new FormData();
      formData.append("links", JSON.stringify(cleanedLinks));
      formData.append("recaptchaToken", recaptchaToken);

      if (!isTemplateCreation) {
        const baseCvName = generatorBaseItem?.displayTitle || generatorBaseItem?.title || generatorBaseFile;
        formData.append("baseFile", generatorBaseFile);
        formData.append("baseFileLabel", baseCvName || "");
      }

      // Le modèle sera récupéré depuis les settings DB côté serveur
      if (localDeviceId) {
        formData.append("deviceId", localDeviceId);
      }

      (fileSelection || []).forEach(file => {
        formData.append("files", file);
      });

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      // Fermer le modal IMMÉDIATEMENT pour feedback utilisateur
      // IMPORTANT: Faire ceci AVANT toutes les vérifications pour garantir la fermeture
      // même si le composant est unmounted pendant l'onboarding (race condition)
      closeGenerator();

      // Vérifier la réponse API APRÈS fermeture du modal
      if (!response.ok || !data?.success) {
        // Vérifier si monté avant les UI updates (notifications d'erreur)
        if (!isMountedRef.current) return;

        const apiError = parseApiError(response, data);
        const errorObj = { message: apiError.message };
        if (apiError.actionRequired && apiError.redirectUrl) {
          errorObj.actionRequired = true;
          errorObj.redirectUrl = apiError.redirectUrl;
        }
        throw errorObj;
      }

      // Vérifier avant les state updates (tâches optimistes, notifications)
      if (!isMountedRef.current) return;

      // ✅ Succès confirmé par l'API -> créer la tâche optimiste et notifier
      const optimisticTaskId = addOptimisticTask({
        type: taskType,
        label: taskLabel,
        metadata: {
          baseFile: isTemplateCreation ? undefined : generatorBaseFile,
          linksCount: cleanedLinks.length,
          filesCount: (fileSelection || []).length,
        },
        shouldUpdateCvList: true,
      });

      // NOTE : L'événement task:added est émis automatiquement par le wrapper
      // setTasks dans BackgroundTasksProvider.jsx (détection de nouvelles tâches)

      addNotification({
        type: "info",
        message: notificationMessage,
        duration: 2500,
      });

      // Nettoyer la tâche optimiste après notification
      removeOptimisticTask(optimisticTaskId);

      // Puis rafraîchir en arrière-plan
      // Note: Le modal est fermé, donc l'événement task:added n'affecte plus le generator
      try {
        await refreshTasks();
      } catch (error) {
        console.error('[Generator] Failed to refresh tasks:', error);
        // Le polling (10s interval) rattrapera de toute façon
      }
    } catch (error) {
      // Fermer le modal avant d'afficher l'erreur
      // IMPORTANT: Faire ceci AVANT isMountedRef check pour garantir la fermeture
      closeGenerator();

      // Vérifier avant les state updates dans le error handler
      if (!isMountedRef.current) return;

      const notification = {
        type: "error",
        message: error?.message || t("cvGenerator.notifications.error"),
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

  return {
    openGenerator,
    setOpenGenerator,
    linkInputs,
    setLinkInputs,
    fileSelection,
    setFileSelection,
    generatorError,
    setGeneratorError,
    generatorBaseFile,
    setGeneratorBaseFile,
    baseSelectorOpen,
    setBaseSelectorOpen,
    linkHistoryDropdowns,
    setLinkHistoryDropdowns,
    fileInputRef,
    generatorSourceItems,
    generatorBaseItem,
    openGeneratorModal,
    closeGenerator,
    updateLink,
    addLinkField,
    removeLinkField,
    onFilesChanged,
    clearFiles,
    submitGenerator,
  };
}
