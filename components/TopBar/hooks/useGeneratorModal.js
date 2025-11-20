import React from "react";
import { CREATE_TEMPLATE_OPTION } from "../utils/constants";
import { getAnalysisOption } from "../utils/cvUtils";
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
  const [analysisLevel, setAnalysisLevel] = React.useState("medium");
  const [linkHistoryDropdowns, setLinkHistoryDropdowns] = React.useState({});
  const [allowedAnalysisLevels, setAllowedAnalysisLevels] = React.useState(['rapid', 'medium', 'deep']); // Par défaut tous autorisés
  const [plans, setPlans] = React.useState([]); // Liste des plans pour calculer les badges

  const fileInputRef = React.useRef(null);
  const isMountedRef = React.useRef(true);

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

  // Calculate currentAnalysisOption internally
  const currentAnalysisOption = React.useMemo(
    () => getAnalysisOption(analysisLevel, t),
    [analysisLevel, t]
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

  // Récupérer les niveaux d'analyse autorisés et les plans depuis l'API quand le modal s'ouvre
  React.useEffect(() => {
    if (!openGenerator) return;

    async function fetchSubscriptionData() {
      try {
        // Fetch en parallèle des niveaux autorisés et des plans
        const [currentResponse, plansResponse] = await Promise.all([
          fetch('/api/subscription/current'),
          fetch('/api/subscription/plans')
        ]);

        if (!currentResponse.ok) throw new Error('Erreur lors de la récupération des niveaux autorisés');
        if (!plansResponse.ok) throw new Error('Erreur lors de la récupération des plans');

        const currentData = await currentResponse.json();
        const plansData = await plansResponse.json();

        const levels = currentData.allowedAnalysisLevels || ['rapid', 'medium', 'deep'];
        setAllowedAnalysisLevels(levels);
        setPlans(plansData.plans || []);

        // Auto-sélectionner le meilleur niveau autorisé si le niveau actuel n'est pas autorisé
        setAnalysisLevel((currentLevel) => {
          if (levels.includes(currentLevel)) {
            return currentLevel;
          }
          // Priorité : deep > medium > rapid
          if (levels.includes('deep')) return 'deep';
          if (levels.includes('medium')) return 'medium';
          if (levels.includes('rapid')) return 'rapid';
          return currentLevel;
        });
      } catch (error) {
        console.error('[Generator Modal] Erreur fetch subscription data:', error);
        // En cas d'erreur, garder les valeurs par défaut
      }
    }

    fetchSubscriptionData();
  }, [openGenerator]);

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

      try {
        openGeneratorModal();
      } catch (error) {
        console.error('[useGeneratorModal] Error in handleOnboardingOpen:', error);
      }
    };

    window.addEventListener(ONBOARDING_EVENTS.OPEN_GENERATOR, handleOnboardingOpen);
    return () => {
      isMounted = false;
      window.removeEventListener(ONBOARDING_EVENTS.OPEN_GENERATOR, handleOnboardingOpen);
    };
  }, [openGeneratorModal]);

  function resetGeneratorState() {
    setLinkInputs([""]);
    setFileSelection([]);
    setGeneratorError("");
    setAnalysisLevel("medium");
    setBaseSelectorOpen(false);
    setLinkHistoryDropdowns({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function closeGenerator() {
    setOpenGenerator(false);
    resetGeneratorState();
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

    const selectedAnalysis = currentAnalysisOption;

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
      endpoint = "/api/background-tasks/generate-cv";
    }

    try {
      // Obtenir le token reCAPTCHA (vérification côté serveur uniquement)
      const recaptchaToken = await executeRecaptcha('generate_cv');

      // Vérifier si le composant est toujours monté après l'opération async
      if (!isMountedRef.current) {
        console.log('[Generator] Component unmounted, aborting');
        return;
      }

      if (!recaptchaToken) {
        addNotification({
          type: "error",
          message: t("auth.errors.recaptchaFailed") || "Échec de la vérification anti-spam. Veuillez réessayer.",
          duration: 4000,
        });
        return;
      }

      const formData = new FormData();
      formData.append("links", JSON.stringify(cleanedLinks));
      formData.append("recaptchaToken", recaptchaToken);

      if (!isTemplateCreation) {
        const baseCvName = generatorBaseItem?.displayTitle || generatorBaseItem?.title || generatorBaseFile;
        formData.append("baseFile", generatorBaseFile);
        formData.append("baseFileLabel", baseCvName || "");
      }

      formData.append("analysisLevel", selectedAnalysis.id);
      formData.append("model", selectedAnalysis.model);
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

      // Vérifier si le composant est toujours monté après fetch
      if (!isMountedRef.current) {
        console.log('[Generator] Component unmounted after fetch, aborting');
        return;
      }

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

      // Vérifier avant les state updates
      if (!isMountedRef.current) return;

      // ✅ Succès confirmé par l'API -> créer la tâche optimiste et notifier
      const optimisticTaskId = addOptimisticTask({
        type: taskType,
        label: taskLabel,
        metadata: {
          baseFile: isTemplateCreation ? undefined : generatorBaseFile,
          analysisLevel: selectedAnalysis.id,
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
      closeGenerator();

      await refreshTasks();

      // Vérifier avant de supprimer la tâche optimiste
      if (isMountedRef.current) {
        removeOptimisticTask(optimisticTaskId);
      }
    } catch (error) {
      // Vérifier avant les state updates dans le error handler
      if (!isMountedRef.current) return;

      // Fermer le modal avant d'afficher l'erreur
      closeGenerator();

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
    analysisLevel,
    setAnalysisLevel,
    currentAnalysisOption,
    linkHistoryDropdowns,
    setLinkHistoryDropdowns,
    allowedAnalysisLevels,
    plans,
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
