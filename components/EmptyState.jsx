"use client";
import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Modal from "./ui/Modal";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { ANALYSIS_OPTIONS } from "@/lib/i18n/cvLabels";

export default function EmptyState() {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLanguage();
  const [openPdfImport, setOpenPdfImport] = React.useState(false);
  const [pdfFile, setPdfFile] = React.useState(null);
  const [pdfAnalysisLevel, setPdfAnalysisLevel] = React.useState("medium");
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
      const res = await fetch("/api/cvs/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          full_name: trimmedName,
          current_title: trimmedTitle,
          email: newCvEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("newCvModal.errors.generic"));

      document.cookie = "cvFile=" + encodeURIComponent(data.file) + "; path=/; max-age=31536000";
      try {
        localStorage.setItem("admin:cv", data.file);
      } catch (_err) {}

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cv:list:changed"));
      }

      setOpenNewCv(false);
      resetNewCvForm();

      // Forcer un rechargement complet pour que le cookie soit bien pris en compte
      window.location.href = "/";
    } catch (error) {
      setNewCvError(error?.message || t("newCvModal.errors.generic"));
    } finally {
      setNewCvBusy(false);
    }
  }

  async function submitPdfImport(event) {
    event.preventDefault();
    if (!pdfFile) return;

    const selectedPdfAnalysis = ANALYSIS_OPTIONS(t).find(o => o.id === pdfAnalysisLevel);
    try {
      const formData = new FormData();
      formData.append("pdfFile", pdfFile);
      formData.append("analysisLevel", selectedPdfAnalysis.id);
      formData.append("model", selectedPdfAnalysis.model);

      const response = await fetch("/api/background-tasks/import-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || t("pdfImport.notifications.error"));
      }

      // Close modal and show importing state
      setImportFileName(pdfFile.name);
      closePdfImport();
      setIsImporting(true);
      setImportProgress(0);

      // Start polling for task completion
      startPollingForCompletion();
    } catch (error) {
      console.error("Impossible de planifier l'import", error);
      alert(error?.message || t("pdfImport.notifications.error"));
    }
  }

  function startPollingForCompletion() {
    let progress = 0;
    let messageIndex = 0;

    // Set initial message
    setLoadingMessage(loadingMessages[0]);

    // Change message every 2-3 seconds
    messageIntervalRef.current = setInterval(() => {
      messageIndex = (messageIndex + 1) % loadingMessages.length;
      setLoadingMessage(loadingMessages[messageIndex]);
    }, 2500);

    progressIntervalRef.current = setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 85) progress = 85; // Cap at 85% until real completion
      setImportProgress(Math.min(progress, 85));
    }, 800);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/cvs", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.items && data.items.length > 0) {
            // CV created! Stop polling
            clearInterval(pollIntervalRef.current);
            clearInterval(progressIntervalRef.current);
            clearInterval(messageIntervalRef.current);
            clearTimeout(timeoutRef.current);
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
              router.push("/");
              router.refresh();
            }, 1000);
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
  // Show importing state
  if (isImporting) {
    return (
      <div className="relative min-h-screen min-h-[100dvh] w-full overflow-y-auto bg-slate-950 flex items-start justify-center p-4 pt-16 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {/* Animated background blobs - same as AuthScreen */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-40 h-80 w-80 rounded-full bg-gradient-to-br from-emerald-400/90 via-sky-500/70 to-transparent blur-2xl animate-auth-blob-fast"/>
          <div className="absolute top-[20%] right-[-140px] h-96 w-96 rounded-full bg-gradient-to-br from-sky-500/70 via-emerald-400/50 to-transparent blur-3xl animate-auth-blob animation-delay-1500"/>
          <div className="absolute bottom-[-180px] left-[10%] h-[420px] w-[420px] rounded-full bg-gradient-to-br from-emerald-500/55 via-sky-400/35 to-transparent blur-[150px] animate-auth-blob-slow animation-delay-6000"/>
          <div className="absolute top-[55%] right-[15%] h-56 w-56 rounded-full bg-gradient-to-br from-sky-400/50 via-emerald-300/40 to-transparent blur-2xl animate-auth-blob-fast animation-delay-3000"/>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(126,207,244,0.25),_transparent_65%)]"/>
        </div>
        <div className="relative z-10 max-w-xl w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-8 border border-white/20">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 mb-4 animate-pulse">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-slate-800 mb-2">
                {t("emptyState.importing.title")}
              </h2>
              <p className="text-slate-600 min-h-[1.5rem] transition-all duration-300">
                {loadingMessage}
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-slate-700 truncate">{importFileName}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
                <div className="text-right mt-2">
                  <span className="text-xs font-medium text-blue-600">{Math.round(importProgress)}%</span>
                </div>
              </div>

              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex items-start gap-2">
                  <div className={`mt-1 w-4 h-4 rounded-full flex items-center justify-center ${importProgress > 20 ? 'bg-green-500' : 'bg-slate-300'}`}>
                    {importProgress > 20 && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span>{t("emptyState.importing.steps.reading")}</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className={`mt-1 w-4 h-4 rounded-full flex items-center justify-center ${importProgress > 50 ? 'bg-green-500' : 'bg-slate-300'}`}>
                    {importProgress > 50 && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span>{t("emptyState.importing.steps.analyzing")}</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className={`mt-1 w-4 h-4 rounded-full flex items-center justify-center ${importProgress > 80 ? 'bg-green-500' : 'bg-slate-300'}`}>
                    {importProgress > 80 && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span>{t("emptyState.importing.steps.structuring")}</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className={`mt-1 w-4 h-4 rounded-full flex items-center justify-center ${importProgress >= 100 ? 'bg-green-500' : 'bg-slate-300'}`}>
                    {importProgress >= 100 && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span>{t("emptyState.importing.steps.finalizing")}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-xs text-slate-500 animate-pulse">
                {importProgress >= 100 ? t("emptyState.importing.redirect") : t("emptyState.importing.timeout")}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen min-h-[100dvh] w-full overflow-y-auto bg-slate-950 flex items-start justify-center px-4 pt-12 pb-8 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Animated background blobs - same as AuthScreen */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-40 h-80 w-80 rounded-full bg-gradient-to-br from-emerald-400/90 via-sky-500/70 to-transparent blur-2xl animate-auth-blob-fast"/>
        <div className="absolute top-[20%] right-[-140px] h-96 w-96 rounded-full bg-gradient-to-br from-sky-500/70 via-emerald-400/50 to-transparent blur-3xl animate-auth-blob animation-delay-1500"/>
        <div className="absolute bottom-[-180px] left-[10%] h-[420px] w-[420px] rounded-full bg-gradient-to-br from-emerald-500/55 via-sky-400/35 to-transparent blur-[150px] animate-auth-blob-slow animation-delay-6000"/>
        <div className="absolute top-[55%] right-[15%] h-56 w-56 rounded-full bg-gradient-to-br from-sky-400/50 via-emerald-300/40 to-transparent blur-2xl animate-auth-blob-fast animation-delay-3000"/>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(126,207,244,0.25),_transparent_65%)]"/>
      </div>

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

        <div className="grid md:grid-cols-2 gap-6">
          {/* Import CV Card */}
          <button
            onClick={() => setOpenPdfImport(true)}
            className="group bg-white/15 backdrop-blur-xl rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-white/30 hover:border-blue-400 hover:bg-blue-500/25 text-left"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Image
                  src="/icons/import.png"
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

          {/* Create New CV Card */}
          <button
            onClick={() => {
              resetNewCvForm();
              setOpenNewCv(true);
            }}
            className="group bg-white/15 backdrop-blur-xl rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-white/30 hover:border-emerald-400 hover:bg-emerald-500/25 text-left"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
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
      <Modal
        open={openPdfImport}
        onClose={closePdfImport}
        title={t("pdfImport.title")}
      >
        <form onSubmit={submitPdfImport} className="space-y-4">
          <div className="text-sm text-white/90 drop-shadow">
            {t("pdfImport.description")}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t("pdfImport.pdfFile")}</div>
            <input
              ref={pdfFileInputRef}
              className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-2 py-1 text-sm text-white"
              type="file"
              accept=".pdf"
              onChange={onPdfFileChanged}
            />
            {pdfFile ? (
              <div className="rounded border border-white/40 bg-white/20 px-3 py-2 text-xs text-white">
                <div className="font-medium">{t("pdfImport.fileSelected")}</div>
                <div className="truncate">{pdfFile.name}</div>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t("pdfImport.analysisQuality")}</div>
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm p-1 text-xs sm:text-sm">
              {ANALYSIS_OPTIONS(t).map((option) => {
                const active = option.id === pdfAnalysisLevel;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPdfAnalysisLevel(option.id)}
                    className={`rounded-md px-2 py-1 font-medium transition ${active ? "bg-white/30 text-emerald-400 shadow" : "text-white/70 hover:bg-white/25"}`}
                    aria-pressed={active}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-white/60 drop-shadow">
              {ANALYSIS_OPTIONS(t).find(o => o.id === pdfAnalysisLevel)?.hint}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closePdfImport}
              className="rounded border-2 border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white hover:bg-white/30 transition-all duration-200"
            >
              {t("pdfImport.cancel")}
            </button>
            <button
              type="submit"
              className="rounded border-2 border-emerald-500 bg-emerald-500 px-3 py-2 text-sm text-white hover:bg-emerald-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!pdfFile}
            >
              {t("pdfImport.import")}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={openNewCv}
        onClose={() => {
          setOpenNewCv(false);
          resetNewCvForm();
        }}
        title={t("newCvModal.title")}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow block mb-2">
              {t("newCvModal.fullName")}<span className="text-red-400" aria-hidden="true"> {t("newCvModal.required")}</span>
            </label>
            <input
              className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-white placeholder:text-white/50 focus:bg-white/30 focus:border-emerald-400 focus:outline-none transition-all duration-200"
              value={newCvFullName}
              onChange={(event) => setNewCvFullName(event.target.value)}
              placeholder="Ex: Jean Dupont"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow block mb-2">
              {t("newCvModal.currentTitle")}<span className="text-red-400" aria-hidden="true"> {t("newCvModal.required")}</span>
            </label>
            <input
              className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-white placeholder:text-white/50 focus:bg-white/30 focus:border-emerald-400 focus:outline-none transition-all duration-200"
              value={newCvCurrentTitle}
              onChange={(event) => setNewCvCurrentTitle(event.target.value)}
              placeholder="Ex: Développeur Full-Stack"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow block mb-2">{t("newCvModal.email")}</label>
            <input
              className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-white placeholder:text-white/50 focus:bg-white/30 focus:border-emerald-400 focus:outline-none transition-all duration-200"
              value={newCvEmail}
              onChange={(event) => setNewCvEmail(event.target.value)}
              placeholder="email@exemple.com"
            />
          </div>
          {newCvError ? (
            <div className="text-sm text-red-400 drop-shadow">{String(newCvError)}</div>
          ) : null}
          <div className="flex gap-2">
            <button
              onClick={createNewCv}
              disabled={newCvBusy || !newCvFullName.trim() || !newCvCurrentTitle.trim()}
              className="rounded border-2 border-emerald-500 bg-emerald-500 px-3 py-2 text-white hover:bg-emerald-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {newCvBusy ? t("newCvModal.creating") : t("newCvModal.create")}
            </button>
            <button
              onClick={() => {
                setOpenNewCv(false);
                resetNewCvForm();
              }}
              className="rounded border-2 border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-white hover:bg-white/30 transition-all duration-200"
            >
              {t("newCvModal.cancel")}
            </button>
          </div>
          <p className="text-xs text-white/70 drop-shadow">
            {t("newCvModal.hint")}
          </p>
        </div>
      </Modal>
    </div>
  );
}
