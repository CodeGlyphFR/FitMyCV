"use client";
import React from "react";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useSettings } from "@/lib/settings/SettingsContext";
import { LOADING_EVENTS, emitLoadingEvent, showLoadingOverlay } from "@/lib/loading/loadingEvents";
import PdfImportModal from "@/components/TopBar/modals/PdfImportModal";
import NewCvModal from "@/components/TopBar/modals/NewCvModal";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { useBackgroundTasks } from "@/components/providers/BackgroundTasksProvider";
import { parseApiError } from "@/lib/utils/errorHandler";

export default function EmptyState() {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const { settings } = useSettings();
  const { addNotification } = useNotifications();
  const { executeRecaptcha } = useRecaptcha();
  const { localDeviceId } = useBackgroundTasks();
  const [openPdfImport, setOpenPdfImport] = React.useState(false);
  const [pdfFile, setPdfFile] = React.useState(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState(0);
  const [importFileName, setImportFileName] = React.useState("");
  const [loadingMessage, setLoadingMessage] = React.useState("");
  const [openNewCv, setOpenNewCv] = React.useState(false);
  const [newCvFullName, setNewCvFullName] = React.useState("");
  const [newCvCurrentTitle, setNewCvCurrentTitle] = React.useState("");
  const [newCvEmail, setNewCvEmail] = React.useState("");
  const [newCvBusy, setNewCvBusy] = React.useState(false);
  const [newCvError, setNewCvError] = React.useState(null);
  const pdfFileInputRef = React.useRef(null);
  const pollIntervalRef = React.useRef(null);
  const timeoutRef = React.useRef(null);
  const progressIntervalRef = React.useRef(null);
  const messageIntervalRef = React.useRef(null);

  // Extract first name from user name
  const firstName = session?.user?.name?.split(' ')[0] || "utilisateur";

  // Messages de chargement style Les Sims - traduits
  const loadingMessages = t("emptyState.importing.loadingMessages");

  function onPdfFileChanged(event) {
    const file = event.target.files?.[0] || null;
    setPdfFile(file);
  }

  function closePdfImport() {
    setOpenPdfImport(false);
    setPdfFile(null);
    if (pdfFileInputRef.current) pdfFileInputRef.current.value = "";
  }

  function resetNewCvForm() {
    setNewCvFullName("");
    setNewCvCurrentTitle("");
    setNewCvEmail("");
    setNewCvError(null);
  }

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
      resetNewCvForm();

      // Afficher l'overlay de chargement AVANT la navigation
      showLoadingOverlay();

      // Forcer un rechargement complet pour que le cookie soit bien pris en compte
      window.location.href = "/";
    } catch (e) {
      // Check if action is required (limits exceeded)
      if (e?.actionRequired && e?.redirectUrl) {
        // Close modal and show notification with action button
        setOpenNewCv(false);
        addNotification({
          type: "error",
          message: e.message,
          redirectUrl: e.redirectUrl,
          linkText: t('notifications.viewOptions'),
          duration: 10000,
        });
      } else {
        setNewCvError(e?.message || t("newCvModal.errors.generic"));
      }
    } finally {
      setNewCvBusy(false);
    }
  }

  async function submitPdfImport(event) {
    event.preventDefault();
    if (!pdfFile) return;

    const fileName = pdfFile.name;

    try {
      // Obtenir le token reCAPTCHA (le serveur gère BYPASS_RECAPTCHA)
      const recaptchaToken = await executeRecaptcha('import_pdf');
      // Ne pas bloquer si null - le serveur décidera

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
        const apiError = parseApiError(response, data);
        const errorObj = { message: apiError.message };
        if (apiError.actionRequired && apiError.redirectUrl) {
          errorObj.actionRequired = true;
          errorObj.redirectUrl = apiError.redirectUrl;
        }
        throw errorObj;
      }

      // Close modal and show importing state
      setImportFileName(fileName);
      closePdfImport();
      setIsImporting(true);
      setImportProgress(0);

      // Start polling for task completion
      startPollingForCompletion();
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
        notification.linkText = t('notifications.viewOptions');
      }

      addNotification(notification);
    }
  }

  async function startPollingForCompletion() {
    let messageIndex = 0;

    // Fetch estimated duration from telemetry
    let estimatedDuration = 60000; // Default: 1 minute
    try {
      const durationRes = await fetch("/api/telemetry/first-import-duration");
      if (durationRes.ok) {
        const durationData = await durationRes.json();
        if (durationData.success && durationData.estimatedDuration) {
          estimatedDuration = durationData.estimatedDuration;
          console.log(`[EmptyState] Using estimated duration: ${estimatedDuration}ms`);
        }
      }
    } catch (error) {
      console.error("[EmptyState] Failed to fetch estimated duration:", error);
    }

    // Set initial message
    setLoadingMessage(loadingMessages[0]);

    // Change message every 2-3 seconds
    messageIntervalRef.current = setInterval(() => {
      messageIndex = (messageIndex + 1) % loadingMessages.length;
      setLoadingMessage(loadingMessages[messageIndex]);
    }, 2500);

    // Define progression phases (non-linear)
    // Each phase: { targetProgress, durationPercent, speed }
    const phases = [
      { target: 20, duration: 0.15, speed: 'fast' },    // Reading PDF - 15% of time
      { target: 50, duration: 0.40, speed: 'slow' },    // AI Analysis - 40% of time
      { target: 80, duration: 0.35, speed: 'medium' },  // Structuring - 35% of time
      { target: 85, duration: 0.10, speed: 'fast' },    // Finalizing - 10% of time
    ];

    let currentPhaseIndex = 0;
    let currentProgress = 0;
    let elapsedTime = 0;
    const updateInterval = 100; // Update every 100ms for smooth animation

    let isCompleted = false;

    progressIntervalRef.current = setInterval(() => {
      if (isCompleted) return;

      elapsedTime += updateInterval;
      const currentPhase = phases[currentPhaseIndex];

      // Calculate time allocated to current phase
      const phaseStartTime = phases
        .slice(0, currentPhaseIndex)
        .reduce((sum, p) => sum + p.duration * estimatedDuration, 0);
      const phaseDuration = currentPhase.duration * estimatedDuration;
      const phaseProgress = Math.min((elapsedTime - phaseStartTime) / phaseDuration, 1);

      // Calculate target progress for this phase with easing
      const phaseStart = currentPhaseIndex > 0 ? phases[currentPhaseIndex - 1].target : 0;
      const phaseTarget = currentPhase.target;

      // Apply easing curve based on speed
      let easedProgress;
      if (currentPhase.speed === 'fast') {
        // Fast: accelerate quickly then decelerate
        easedProgress = phaseProgress < 0.5
          ? 2 * phaseProgress * phaseProgress
          : 1 - Math.pow(-2 * phaseProgress + 2, 2) / 2;
      } else if (currentPhase.speed === 'slow') {
        // Slow: linear progression (no randomness to avoid oscillation)
        easedProgress = phaseProgress;
      } else {
        // Medium: smooth ease-in-out
        easedProgress = phaseProgress < 0.5
          ? 4 * phaseProgress * phaseProgress * phaseProgress
          : 1 - Math.pow(-2 * phaseProgress + 2, 3) / 2;
      }

      currentProgress = phaseStart + (phaseTarget - phaseStart) * easedProgress;

      // Ensure progress stays within bounds and never goes backwards
      currentProgress = Math.max(0, Math.min(currentProgress, currentPhase.target));

      setImportProgress(Math.round(currentProgress * 10) / 10);

      // Move to next phase if current is complete
      if (phaseProgress >= 1 && currentPhaseIndex < phases.length - 1) {
        currentPhaseIndex++;
      }

      // If reached 85%, slow down and wait for real completion
      if (currentProgress >= 85) {
        clearInterval(progressIntervalRef.current);
      }
    }, updateInterval);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/cvs?_=${Date.now()}`, {
          cache: "no-store",
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.items && data.items.length > 0) {
            // CV created! Stop polling
            isCompleted = true;
            clearInterval(pollIntervalRef.current);
            clearInterval(progressIntervalRef.current);
            clearInterval(messageIntervalRef.current);
            clearTimeout(timeoutRef.current);

            // Animate to 100% smoothly
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
                setLoadingMessage(t("emptyState.importing.ready"));

                // Select the new CV
                const newCv = data.items[0];
                if (newCv.file) {
                  document.cookie = `cvFile=${encodeURIComponent(newCv.file)}; path=/; max-age=31536000`;
                  localStorage.setItem("admin:cv", newCv.file);
                }

                // Wait a bit to show 100% then redirect
                setTimeout(() => {
                  // Afficher l'overlay de chargement AVANT la navigation
                  showLoadingOverlay();
                  // Forcer un rechargement complet (comme pour la création manuelle)
                  window.location.href = "/";
                }, 1000);
              }
            }, stepDuration);
          }
        }
      } catch (error) {
        console.error("Error polling for CV:", error);
      }
    }, 2000);

    // Safety timeout: stop after 5 minutes
    timeoutRef.current = setTimeout(() => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        clearInterval(progressIntervalRef.current);
        clearInterval(messageIntervalRef.current);
        setIsImporting(false);
        alert(t("emptyState.importing.timeoutAlert"));
      }
    }, 300000);
  }

  React.useEffect(() => {
    return () => {
      // Cleanup all intervals and timeouts when component unmounts
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Emit PAGE_READY event for LoadingOverlay
  React.useEffect(() => {
    // Ne pas émettre si en cours d'import (importing state)
    if (isImporting) return;

    // Petit délai pour s'assurer que le rendu est complet
    const timer = setTimeout(() => {
      emitLoadingEvent(LOADING_EVENTS.PAGE_READY, {
        trigger: 'emptyState',
        timestamp: Date.now(),
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [isImporting]);

  // Show importing state
  if (isImporting) {
    return (
      <div className="relative min-h-screen min-h-[100dvh] w-full overflow-y-auto bg-transparent flex items-start justify-center p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="relative z-10 max-w-xl w-full mt-12">
          <div className="bg-white/15 backdrop-blur-md rounded-2xl shadow-2xl p-8 border-2 border-white/30 gpu-accelerate">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 mb-4 animate-pulse">
                <svg className="w-10 h-10 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">
                {t("emptyState.importing.title")}
              </h2>
              <p className="text-slate-100 min-h-[1.5rem] transition-all duration-300 drop-shadow">
                {loadingMessage}
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-5 h-5 text-emerald-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-white truncate">{importFileName}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
                <div className="text-right mt-2">
                  <span className="text-xs font-medium text-emerald-300">{Math.round(importProgress)}%</span>
                </div>
              </div>

              <div className="space-y-3 text-sm text-slate-100">
                <div className="flex items-start gap-2">
                  <div className={`mt-1 w-4 h-4 rounded-full flex items-center justify-center ${importProgress > 20 ? 'bg-emerald-500' : 'bg-white/20'}`}>
                    {importProgress > 20 && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1.1.4.010 1.414l-8 8a1.1.4.01-1.414 0l-4-4a1.1.4.011.414-1.414L8 12.586l7.293-7.293a1.1.4.011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span>{t("emptyState.importing.steps.reading")}</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className={`mt-1 w-4 h-4 rounded-full flex items-center justify-center ${importProgress > 50 ? 'bg-emerald-500' : 'bg-white/20'}`}>
                    {importProgress > 50 && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1.1.4.010 1.414l-8 8a1.1.4.01-1.414 0l-4-4a1.1.4.011.414-1.414L8 12.586l7.293-7.293a1.1.4.011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span>{t("emptyState.importing.steps.analyzing")}</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className={`mt-1 w-4 h-4 rounded-full flex items-center justify-center ${importProgress > 80 ? 'bg-emerald-500' : 'bg-white/20'}`}>
                    {importProgress > 80 && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1.1.4.010 1.414l-8 8a1.1.4.01-1.414 0l-4-4a1.1.4.011.414-1.414L8 12.586l7.293-7.293a1.1.4.011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span>{t("emptyState.importing.steps.structuring")}</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className={`mt-1 w-4 h-4 rounded-full flex items-center justify-center ${importProgress >= 100 ? 'bg-emerald-500' : 'bg-white/20'}`}>
                    {importProgress >= 100 && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1.1.4.010 1.414l-8 8a1.1.4.01-1.414 0l-4-4a1.1.4.011.414-1.414L8 12.586l7.293-7.293a1.1.4.011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span>{t("emptyState.importing.steps.finalizing")}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-xs text-slate-300 animate-pulse drop-shadow">
                {importProgress >= 100 ? t("emptyState.importing.redirect") : t("emptyState.importing.timeout")}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen min-h-[100dvh] w-full overflow-y-auto bg-transparent flex items-start justify-center px-4 pb-8 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="relative z-10 max-w-2xl w-full mt-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-3 drop-shadow-lg">
            {(() => {
              const welcomeText = t("emptyState.welcome");
              const parts = welcomeText.split('{firstName}');
              return (
                <>
                  {parts[0]}<span className="text-emerald-300">{firstName}</span>{parts[1]}
                </>
              );
            })()}
          </h1>
          <p className="text-lg text-slate-200 drop-shadow">
            {t("emptyState.subtitle")}
          </p>
        </div>

        <div className={`grid ${(settings.feature_import && settings.feature_manual_cv) ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-6 ${!(settings.feature_import || settings.feature_manual_cv) ? 'hidden' : ''}`}>
          {/* Import CV Card */}
          {settings.feature_import && (
            <button
              onClick={() => setOpenPdfImport(true)}
              className="group bg-white/15 backdrop-blur-md rounded-2xl p-8 shadow-lg hover:shadow-sm-xl transition-all duration-300 border-2 border-white/30 hover:border-blue-400 hover:bg-blue-500/25 text-left gpu-accelerate"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center group-hover:scale-110 group-hover:bg-white/30 transition-all duration-300">
                  <Image
                    src="/icons/import.svg"
                    alt="Import"
                    width={40}
                    height={40}
                    className="w-10 h-10"
                    priority
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-white drop-shadow-lg mb-2">
                    {t("emptyState.importCard.title")}
                  </h2>
                  <p className="text-slate-100 drop-shadow">
                    {t("emptyState.importCard.description")}
                  </p>
                </div>
                <div className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg group-hover:bg-blue-600 transition-colors shadow-md">
                  {t("emptyState.importCard.button")}
                </div>
              </div>
            </button>
          )}

          {/* Create New CV Card */}
          {settings.feature_manual_cv && (
            <button
              onClick={() => {
                resetNewCvForm();
                setOpenNewCv(true);
              }}
              className="group bg-white/15 backdrop-blur-md rounded-2xl p-8 shadow-lg hover:shadow-sm-xl transition-all duration-300 border-2 border-white/30 hover:border-emerald-400 hover:bg-emerald-500/25 text-left gpu-accelerate"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center group-hover:scale-110 group-hover:bg-white/30 transition-all duration-300">
                  <span className="text-4xl">✨</span>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-white drop-shadow-lg mb-2">
                    {t("emptyState.createCard.title")}
                  </h2>
                  <p className="text-slate-100 drop-shadow">
                    {t("emptyState.createCard.description")}
                  </p>
                </div>
                <div className="mt-4 px-6 py-2 bg-emerald-500 text-white rounded-lg group-hover:bg-emerald-600 transition-colors shadow-md">
                  {t("emptyState.createCard.button")}
                </div>
              </div>
            </button>
          )}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-slate-300">
            {t("emptyState.tip")}
          </p>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => signOut({ callbackUrl: '/auth' })}
            className="text-sm text-slate-300 hover:text-white underline transition-colors"
          >
            {t("topbar.logout")}
          </button>
        </div>
      </div>

      {/* PDF Import Modal */}
      <PdfImportModal
        open={openPdfImport}
        onClose={closePdfImport}
        onSubmit={submitPdfImport}
        pdfFile={pdfFile}
        onPdfFileChanged={onPdfFileChanged}
        pdfFileInputRef={pdfFileInputRef}
        t={t}
      />

      {/* New CV Modal */}
      <NewCvModal
        open={openNewCv}
        onClose={() => setOpenNewCv(false)}
        onCreate={createNewCv}
        fullName={newCvFullName}
        setFullName={setNewCvFullName}
        currentTitle={newCvCurrentTitle}
        setCurrentTitle={setNewCvCurrentTitle}
        email={newCvEmail}
        setEmail={setNewCvEmail}
        error={newCvError}
        setError={setNewCvError}
        busy={newCvBusy}
        t={t}
      />
    </div>
  );
}
