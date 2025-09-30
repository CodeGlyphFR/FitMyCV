"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Modal from "./ui/Modal";

const ANALYSIS_OPTIONS = Object.freeze([
  {
    id: "rapid",
    label: "Rapide",
    model: "gpt-5-nano-2025-08-07",
    hint: "Analyse la plus rapide, pour un aperçu rapide.",
  },
  {
    id: "medium",
    label: "Moyen",
    model: "gpt-5-mini-2025-08-07",
    hint: "Équilibre entre vitesse et qualité (recommandé).",
  },
  {
    id: "deep",
    label: "Approfondi",
    model: "gpt-5-2025-08-07",
    hint: "Analyse complète pour des résultats optimisés.",
  },
]);

export default function EmptyState() {
  const router = useRouter();
  const { data: session } = useSession();
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

  // Messages de chargement style Les Sims
  const loadingMessages = [
    "🔍 Recherche de vos super-pouvoirs cachés...",
    "🎨 Application d'une touche de magie sur votre parcours...",
    "🧠 L'IA réfléchit intensément à votre profil...",
    "📚 Lecture entre les lignes de votre expérience...",
    "✨ Polissage de vos compétences...",
    "🎯 Optimisation de votre profil professionnel...",
    "🚀 Préparation au décollage de votre carrière...",
    "🎭 Mise en valeur de vos talents...",
    "🔮 Prédiction de votre succès futur...",
    "💎 Transformation de votre CV en diamant...",
    "🎪 Orchestration de votre parcours professionnel...",
    "🌟 Ajout d'une touche d'excellence...",
    "🎨 Peinture de votre portrait professionnel...",
    "🏆 Préparation de votre arsenal de compétences...",
    "📖 Écriture de votre légende professionnelle...",
    "🎬 Réalisation du film de votre carrière...",
    "🧩 Assemblage des pièces de votre puzzle professionnel...",
    "🎵 Composition de la symphonie de vos réussites...",
    "🔬 Analyse moléculaire de vos compétences...",
    "🎪 Organisation du spectacle de vos talents...",
  ];

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
      setNewCvError("Merci de renseigner le nom complet et le titre actuel.");
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
      if (!res.ok) throw new Error(data?.error || "Erreur");

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
      setNewCvError(error?.message || "Erreur");
    } finally {
      setNewCvBusy(false);
    }
  }

  async function submitPdfImport(event) {
    event.preventDefault();
    if (!pdfFile) return;

    const selectedPdfAnalysis = ANALYSIS_OPTIONS.find(o => o.id === pdfAnalysisLevel);
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
        throw new Error(data?.error || "Impossible de mettre la tâche en file.");
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
      alert(error?.message || "Erreur lors de la planification de l'import");
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
            setLoadingMessage("🎉 Votre CV est prêt !");

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
        alert("L'import prend plus de temps que prévu. Veuillez rafraîchir la page.");
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
      <div className="min-h-screen flex items-center justify-center p-4 bg-white">
        <div className="max-w-xl w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-8 border-2 border-blue-100">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 mb-4 animate-pulse">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-slate-800 mb-2">
                Import en cours...
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
                  <span>Lecture du fichier PDF</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className={`mt-1 w-4 h-4 rounded-full flex items-center justify-center ${importProgress > 50 ? 'bg-green-500' : 'bg-slate-300'}`}>
                    {importProgress > 50 && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span>Analyse intelligente du contenu</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className={`mt-1 w-4 h-4 rounded-full flex items-center justify-center ${importProgress > 80 ? 'bg-green-500' : 'bg-slate-300'}`}>
                    {importProgress > 80 && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span>Structuration des données</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className={`mt-1 w-4 h-4 rounded-full flex items-center justify-center ${importProgress >= 100 ? 'bg-green-500' : 'bg-slate-300'}`}>
                    {importProgress >= 100 && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span>Finalisation</span>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-xs text-slate-500 animate-pulse">
                {importProgress >= 100 ? "🎊 Redirection en cours..." : "☕ Pendant ce temps, préparez-vous une boisson chaude..."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-start justify-center p-4 pt-16 bg-white">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-800 mb-3">
            Bienvenue <span className="text-blue-600">{firstName}</span> sur votre gestionnaire de CV
          </h1>
          <p className="text-lg text-slate-600">
            Commencez par créer votre premier CV ou importez-en un existant
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Import CV Card */}
          <button
            onClick={() => setOpenPdfImport(true)}
            className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-blue-500 text-left"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <img
                  src="/icons/import.png"
                  alt="Import"
                  className="w-10 h-10"
                />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                  Importer un CV
                </h2>
                <p className="text-slate-600">
                  Importez votre CV existant au format PDF pour le convertir automatiquement
                </p>
              </div>
              <div className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg group-hover:bg-blue-600 transition-colors">
                Importer →
              </div>
            </div>
          </button>

          {/* Create New CV Card */}
          <button
            onClick={() => {
              resetNewCvForm();
              setOpenNewCv(true);
            }}
            className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-emerald-500 text-left"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <span className="text-4xl">✨</span>
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                  Créer un nouveau CV
                </h2>
                <p className="text-slate-600">
                  Commencez avec un CV vierge et remplissez-le à votre rythme
                </p>
              </div>
              <div className="mt-4 px-6 py-2 bg-emerald-500 text-white rounded-lg group-hover:bg-emerald-600 transition-colors">
                Créer →
              </div>
            </div>
          </button>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-slate-500">
            💡 Astuce : Vous pourrez éditer, dupliquer et exporter vos CV à tout moment
          </p>
        </div>
      </div>

      {/* PDF Import Modal */}
      <Modal
        open={openPdfImport}
        onClose={closePdfImport}
        title="Importer un CV PDF"
      >
        <form onSubmit={submitPdfImport} className="space-y-4">
          <div className="text-sm text-neutral-700">
            Importez un CV au format PDF pour le convertir automatiquement en
            utilisant l'intelligence artificielle.
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Fichier PDF</div>
            <input
              ref={pdfFileInputRef}
              className="w-full rounded border px-2 py-1 text-sm"
              type="file"
              accept=".pdf"
              onChange={onPdfFileChanged}
            />
            {pdfFile ? (
              <div className="rounded border bg-neutral-50 px-3 py-2 text-xs">
                <div className="font-medium">Fichier sélectionné :</div>
                <div className="truncate">{pdfFile.name}</div>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Qualité de l'analyse</div>
            <div className="grid grid-cols-3 gap-1 rounded-lg border bg-neutral-50 p-1 text-xs sm:text-sm">
              {ANALYSIS_OPTIONS.map((option) => {
                const active = option.id === pdfAnalysisLevel;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPdfAnalysisLevel(option.id)}
                    className={`rounded-md px-2 py-1 font-medium transition ${active ? "bg-white text-blue-600 shadow" : "text-neutral-600 hover:bg-white"}`}
                    aria-pressed={active}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-neutral-500">
              {ANALYSIS_OPTIONS.find(o => o.id === pdfAnalysisLevel)?.hint}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closePdfImport}
              className="rounded border px-3 py-1 text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="rounded border px-3 py-1 text-sm"
              disabled={!pdfFile}
            >
              Importer
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
        title="Créer un nouveau CV"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm block mb-1">
              Nom complet<span className="text-red-500" aria-hidden="true"> *</span>
            </label>
            <input
              className="w-full rounded border px-3 py-2"
              value={newCvFullName}
              onChange={(event) => setNewCvFullName(event.target.value)}
              placeholder="Ex: Jean Dupont"
              required
            />
          </div>
          <div>
            <label className="text-sm block mb-1">
              Titre actuel<span className="text-red-500" aria-hidden="true"> *</span>
            </label>
            <input
              className="w-full rounded border px-3 py-2"
              value={newCvCurrentTitle}
              onChange={(event) => setNewCvCurrentTitle(event.target.value)}
              placeholder="Ex: Développeur Full-Stack"
              required
            />
          </div>
          <div>
            <label className="text-sm block mb-1">Email</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={newCvEmail}
              onChange={(event) => setNewCvEmail(event.target.value)}
              placeholder="email@exemple.com"
            />
          </div>
          {newCvError ? (
            <div className="text-sm text-red-600">{String(newCvError)}</div>
          ) : null}
          <div className="flex gap-2">
            <button
              onClick={createNewCv}
              disabled={newCvBusy || !newCvFullName.trim() || !newCvCurrentTitle.trim()}
              className="rounded border px-3 py-2 hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {newCvBusy ? "Création..." : "Créer le CV"}
            </button>
            <button
              onClick={() => {
                setOpenNewCv(false);
                resetNewCvForm();
              }}
              className="rounded border px-3 py-2"
            >
              Annuler
            </button>
          </div>
          <p className="text-xs opacity-70">
            Tu pourras compléter toutes les sections ensuite via le mode édition.
          </p>
        </div>
      </Modal>
    </div>
  );
}
