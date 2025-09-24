"use client";
import React from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Modal from "./ui/Modal";
import GptLogo from "./ui/GptLogo";
import DefaultCvIcon from "./ui/DefaultCvIcon";
import { useAdmin } from "./admin/AdminProvider";

export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setCurrentFile } = useAdmin();
  const { data: session, status } = useSession();
  const isAuthenticated = !!session?.user?.id;

  const [items, setItems] = React.useState([]);
  const [current, setCurrent] = React.useState("");
  const [openDelete, setOpenDelete] = React.useState(false);
  const [openGenerator, setOpenGenerator] = React.useState(false);
  const [listOpen, setListOpen] = React.useState(false);
  const [dropdownRect, setDropdownRect] = React.useState(null);
  const [portalReady, setPortalReady] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const userMenuRef = React.useRef(null);

  const [linkInputs, setLinkInputs] = React.useState([""]);
  const [fileSelection, setFileSelection] = React.useState([]);
  const [generatorError, setGeneratorError] = React.useState("");
  const [generatorLoading, setGeneratorLoading] = React.useState(false);
  const [generatorLogs, setGeneratorLogs] = React.useState([]);
  const [generationDone, setGenerationDone] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState(null);

  const fileInputRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const dropdownPortalRef = React.useRef(null);
  const logsRef = React.useRef(null);
  const currentItem = React.useMemo(
    () => items.find((it) => it.file === current),
    [items, current],
  );
  const defaultLogout = React.useMemo(() => {
    if (
      typeof window !== "undefined" &&
      window.location &&
      window.location.origin
    ) {
      return `${window.location.origin.replace(/\/$/, "")}/auth?mode=login`;
    }
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      return `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/auth?mode=login`;
    }
    return "/auth?mode=login";
  }, []);
  const [logoutTarget, setLogoutTarget] = React.useState(defaultLogout);

  async function reload() {
    if (!isAuthenticated) {
      setItems([]);
      setCurrent("main.json");
      return;
    }

    try {
      const res = await fetch("/api/cvs", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("API CV non disponible");
      }
      const data = await res.json();
      setItems(data.items || []);
      if (data.current) {
        setCurrent(data.current);
        try {
          localStorage.setItem("admin:cv", data.current);
        } catch (_err) {}
        if (typeof setCurrentFile === "function") setCurrentFile(data.current);
      }
    } catch (error) {
      console.error(error);
      setItems([]);
    }
  }

  React.useEffect(() => {
    if (!isAuthenticated) return;
    reload();
  }, [isAuthenticated, pathname, searchParams?.toString()]);

  React.useEffect(() => {
    if (!isAuthenticated) return undefined;
    const onChanged = () => reload();
    window.addEventListener("cv:list:changed", onChanged);
    window.addEventListener("focus", onChanged);
    return () => {
      window.removeEventListener("cv:list:changed", onChanged);
      window.removeEventListener("focus", onChanged);
    };
  }, [isAuthenticated]);

  async function selectFile(file) {
    document.cookie =
      "cvFile=" + encodeURIComponent(file) + "; path=/; max-age=31536000";
    try {
      localStorage.setItem("admin:cv", file);
    } catch (_err) {}
    if (typeof setCurrentFile === "function") setCurrentFile(file);
    setCurrent(file);
    router.refresh();
    // also refresh list labels, in case ordering/labels changed
    await reload();
  }

  React.useEffect(() => {
    setPortalReady(true);
  }, []);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        setLogoutTarget(
          `${window.location.origin.replace(/\/$/, "")}/auth?mode=login`,
        );
      } catch (_err) {}
    }
  }, []);

  React.useEffect(() => {
    const el = logsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [generatorLogs]);

  React.useEffect(() => {
    if (listOpen && triggerRef.current) {
      setDropdownRect(triggerRef.current.getBoundingClientRect());
    }
  }, [listOpen, items, current]);

  React.useEffect(() => {
    function handleClick(event) {
      const menuEl = userMenuRef.current;
      if (!menuEl) return;
      if (menuEl.contains(event.target)) return;
      setUserMenuOpen(false);
    }

    function handleKey(event) {
      if (event.key === "Escape") setUserMenuOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  React.useEffect(() => {
    function updatePosition() {
      if (listOpen && triggerRef.current) {
        setDropdownRect(triggerRef.current.getBoundingClientRect());
      }
    }
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [listOpen]);

  React.useEffect(() => {
    function handleClick(event) {
      const triggerEl = triggerRef.current;
      const dropdownEl = dropdownPortalRef.current;
      if (!triggerEl) return;
      if (triggerEl.contains(event.target)) return;
      if (dropdownEl && dropdownEl.contains(event.target)) return;
      setListOpen(false);
    }

    function handleKey(event) {
      if (event.key === "Escape") setListOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  async function deleteCurrent() {
    if (!current) {
      setOpenDelete(false);
      return;
    }
    if (current === "main.json") {
      alert("Le CV RAW (main.json) ne peut pas être supprimé.");
      setOpenDelete(false);
      return;
    }
    try {
      const res = await fetch("/api/cvs/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data && data.error) || "Erreur");
      const next = data.nextFile || "";
      if (next) {
        document.cookie =
          "cvFile=" + encodeURIComponent(next) + "; path=/; max-age=31536000";
        setCurrent(next);
      } else {
        document.cookie = "cvFile=; path=/; max-age=0";
        setCurrent("");
      }
      setOpenDelete(false);
      await reload();
      router.refresh();
    } catch (e) {
      alert(
        "Suppression impossible: " + (e && e.message ? e.message : String(e)),
      );
      setOpenDelete(false);
    }
  }

  function resetGeneratorState() {
    setLinkInputs([""]);
    setFileSelection([]);
    setGeneratorError("");
    setGeneratorLogs([]);
    setGenerationDone(false);
    setPendingFile(null);
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

  async function finalizeGeneration() {
    let selectionFailed = false;
    if (pendingFile) {
      try {
        await selectFile(pendingFile);
      } catch (_err) {
        const message = `Impossible de sélectionner le fichier ${pendingFile}.`;
        setGeneratorLogs((prev) => [...prev, `[Erreur] ${message}`]);
        setGeneratorError(message);
        selectionFailed = true;
      }
    }
    if (!selectionFailed) closeGenerator();
  }

  async function submitGenerator(event) {
    event.preventDefault();
    if (generatorLoading) return;

    const cleanedLinks = linkInputs
      .map((l) => (l || "").trim())
      .filter(Boolean);
    const hasFiles = (fileSelection || []).length > 0;

    if (!cleanedLinks.length && !hasFiles) {
      setGeneratorError("Ajoutez au moins un lien ou un fichier.");
      return;
    }

    const formData = new FormData();
    formData.append("links", JSON.stringify(cleanedLinks));
    (fileSelection || []).forEach((file) => formData.append("files", file));

    setGeneratorLoading(true);
    setGeneratorError("");
    setGenerationDone(false);
    setPendingFile(null);

    let finalTargetFile = null;
    let finalSuccess = false;
    let finalError = "";

    const appendLog = (message) => {
      if (!message) return;
      setGeneratorLogs((prev) => [...prev, message]);
    };

    try {
      const response = await fetch("/api/chatgpt/generate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          payload?.error || "Erreur lors de l'exécution du générateur.",
        );
      }

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/x-ndjson")) {
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Flux de réponse indisponible.");
        const decoder = new TextDecoder();
        let buffer = "";
        let streamClosed = false;
        let hasStreamOutput = false;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() || "";
          for (const part of parts) {
            if (!part.trim()) continue;
            let evt;
            try {
              evt = JSON.parse(part);
            } catch (_err) {
              appendLog(part.trim());
              continue;
            }

            if (evt.type === "stdout" || evt.type === "log") {
              appendLog(evt.message || evt.data || "");
              hasStreamOutput = true;
            } else if (evt.type === "stderr") {
              const raw = evt.message || evt.data || "";
              const trimmed = raw.trim();
              if (/^\[(INFO|AVERTISSEMENT)\]/i.test(trimmed))
                appendLog(trimmed);
              else appendLog(`[Erreur] ${trimmed || raw}`);
            } else if (evt.type === "status") {
              appendLog(evt.message || "");
            } else if (evt.type === "error") {
              finalError = evt.message || "Erreur lors de la génération.";
              appendLog(`[Erreur] ${finalError}`);
              streamClosed = true;
              break;
            } else if (evt.type === "complete") {
              if (evt.output && !hasStreamOutput) {
                appendLog(evt.output);
              }
              finalSuccess = !!evt.success;
              if (finalSuccess) {
                const files = Array.isArray(evt.files)
                  ? evt.files.filter(Boolean)
                  : [];
                const file = evt.file;
                finalTargetFile = files.length
                  ? files[files.length - 1]
                  : file || null;
                appendLog(
                  `Génération terminée (${files.length || (file ? 1 : 0)} fichier(s)).`,
                );
              } else {
                finalError = evt.error || evt.output || "Le script a échoué.";
                appendLog(`[Erreur] ${finalError}`);
              }
              streamClosed = true;
              break;
            }
          }
          if (streamClosed) break;
        }

        if (!streamClosed && buffer.trim()) appendLog(buffer.trim());

        await reader.cancel().catch(() => {});

        if (!streamClosed && !finalSuccess && !finalError) {
          finalError = "Flux interrompu avant la fin de la génération.";
        }
      } else {
        const payload = await response.json().catch(() => ({}));
        const generatedFiles = Array.isArray(payload?.files)
          ? payload.files.filter(Boolean)
          : [];
        const generatedFile = payload?.file;
        const targetFile = generatedFiles.length
          ? generatedFiles[generatedFiles.length - 1]
          : generatedFile;

        if (payload?.output) appendLog(payload.output);

        if (targetFile) {
          finalTargetFile = targetFile;
          finalSuccess = true;
          appendLog(`Fichier généré : ${targetFile}`);
        } else if (payload?.success) {
          finalSuccess = true;
          appendLog("Génération terminée.");
        } else {
          finalError =
            payload?.error || "La génération s'est terminée sans fichier.";
          appendLog(`[Erreur] ${finalError}`);
        }
      }
    } catch (error) {
      finalError =
        error.message || "Erreur inattendue lors de l'appel au générateur.";
      appendLog(`[Erreur] ${finalError}`);
    } finally {
      setGeneratorLoading(false);
    }

    if (finalSuccess && !finalTargetFile) {
      finalError = "La génération s'est terminée sans produire de fichier.";
      appendLog(`[Erreur] ${finalError}`);
      finalSuccess = false;
    }

    if (finalSuccess) {
      if (finalTargetFile) {
        setPendingFile(finalTargetFile);
      }
      setGenerationDone(true);
      appendLog("Cliquez sur Terminer pour afficher le CV généré.");
    } else if (finalError) {
      setGeneratorError(finalError);
    }
  }

  if (status === "loading") {
    return (
      <div className="no-print sticky top-0 inset-x-0 z-40 w-full bg-white/80 backdrop-blur border-b">
        <div className="w-full p-3 flex items-center justify-between">
          <span className="text-sm font-medium">Chargement…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="no-print sticky top-0 inset-x-0 z-40 w-full bg-white/80 backdrop-blur border-b">
      <div className="w-full p-3 flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setUserMenuOpen((prev) => !prev)}
            className="h-8 w-8 flex items-center justify-center rounded-full border hover:shadow bg-white"
            aria-label="Menu utilisateur"
          >
            <Image
              src="/images/user-icon.png"
              alt="Menu utilisateur"
              width={20}
              height={20}
              className="object-contain"
            />
          </button>
          {userMenuOpen ? (
            <div className="absolute left-0 mt-2 rounded-lg border bg-white shadow-lg p-2 text-sm space-y-1 min-w-[10rem] max-w-[16rem]">
              <div className="px-2 py-1 text-xs uppercase text-neutral-500 truncate">
                {session?.user?.name || "Utilisateur"}
              </div>
              <button
                className="w-full text-left rounded px-2 py-1 hover:bg-neutral-100"
                onClick={() => {
                  setUserMenuOpen(false);
                  router.push("/");
                }}
              >
                Mes CVs
              </button>
              <button
                className="w-full text-left rounded px-2 py-1 hover:bg-neutral-100"
                onClick={() => {
                  setUserMenuOpen(false);
                  router.push("/account");
                }}
              >
                Mon compte
              </button>
              <button
                className="w-full text-left rounded px-2 py-1 hover:bg-neutral-100"
                onClick={() => {
                  setUserMenuOpen(false);
                  signOut({ callbackUrl: logoutTarget });
                }}
              >
                Déconnexion
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex-1 min-w-[200px]">
          <button
            type="button"
            onClick={() => setListOpen((prev) => !prev)}
            className="w-full min-w-0 rounded border px-3 py-1 text-sm flex items-center justify-between gap-3 hover:shadow"
            ref={triggerRef}
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="flex h-6 w-6 items-center justify-center shrink-0">
                {currentItem?.isMain ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide leading-none">
                    RAW
                  </span>
                ) : currentItem?.isGpt ? (
                  <GptLogo className="h-4 w-4" />
                ) : (
                  <DefaultCvIcon className="h-4 w-4" size={16} />
                )}
              </span>
              <span className="truncate">
                {currentItem ? currentItem.label : "Sélectionner"}
              </span>
            </span>
            <span className="text-xs opacity-60">▾</span>
          </button>
        </div>
        {listOpen && portalReady && dropdownRect
          ? createPortal(
              <div
                ref={dropdownPortalRef}
                style={{
                  position: "fixed",
                  top: dropdownRect.bottom + 4,
                  left: dropdownRect.left,
                  width: dropdownRect.width,
                  zIndex: 1000,
                }}
                className="rounded border bg-white shadow-lg"
              >
                <ul className="max-h-[70vh] overflow-y-auto py-1">
                  {items.map((it) => (
                    <li key={it.file}>
                      <button
                        type="button"
                        onClick={async () => {
                          await selectFile(it.file);
                          setListOpen(false);
                        }}
                        className={`w-full px-3 py-1 text-left text-sm flex items-center gap-3 hover:bg-zinc-100 ${it.file === current ? "bg-zinc-50" : ""}`}
                      >
                        <span className="flex h-6 w-6 items-center justify-center shrink-0">
                          {it.isMain ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wide leading-none">
                              RAW
                            </span>
                          ) : it.isGpt ? (
                            <GptLogo className="h-4 w-4" />
                          ) : (
                            <DefaultCvIcon className="h-4 w-4" size={16} />
                          )}
                        </span>
                        <span className="truncate leading-tight">
                          {it.label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>,
              document.body,
            )
          : null}
        <button
          onClick={() => setOpenGenerator(true)}
          className="rounded border px-2 py-1 text-sm hover:shadow inline-flex items-center justify-center leading-none"
          type="button"
        >
          <GptLogo className="h-4 w-4" />
        </button>
        <button
          onClick={() => router.push("/admin/new")}
          className="rounded border px-2 py-1 text-sm hover:shadow"
        >
          ➕
        </button>
        <button
          onClick={() => {
            if (current === "main.json") return;
            setOpenDelete(true);
          }}
          disabled={current === "main.json"}
          className={`rounded border px-2 py-1 text-sm hover:shadow ${current === "main.json" ? "opacity-40 cursor-not-allowed" : "text-red-700"}`}
          title={
            current === "main.json"
              ? "Le CV RAW ne peut pas être supprimé"
              : "Supprimer"
          }
        >
          ❌
        </button>
      </div>

      <Modal
        open={openGenerator}
        onClose={closeGenerator}
        title="Générer un CV avec ChatGPT"
      >
        <form onSubmit={submitGenerator} className="space-y-4">
          <div className="text-sm text-neutral-700">
            Renseignez des offres d'emploi à analyser (liens ou fichier
            PDF/Word) pour générer des CV adaptés à partir de votre CV RAW.
          </div>

          <div className="space-y-2">
            {generatorLoading ? (
              <div className="h-2 w-full overflow-hidden rounded bg-emerald-100">
                <div className="h-full w-full bg-emerald-500 animate-pulse"></div>
              </div>
            ) : null}
            <div
              ref={logsRef}
              className="h-40 overflow-y-auto rounded border bg-black/90 p-2 font-mono text-xs text-emerald-100"
            >
              {generatorLogs.length ? (
                generatorLogs.map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap">
                    {line}
                  </div>
                ))
              ) : (
                <div className="opacity-60">En attente...</div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Liens</div>
            {linkInputs.map((value, index) => (
              <div key={index} className="flex gap-2">
                <input
                  className="flex-1 rounded border px-2 py-1 text-sm"
                  placeholder="https://..."
                  value={value}
                  onChange={(event) => updateLink(event.target.value, index)}
                />
                <button
                  type="button"
                  onClick={() => removeLinkField(index)}
                  className="rounded border px-2 py-1 text-xs"
                  title="Supprimer ce lien"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addLinkField}
                className="rounded border px-2 py-1 text-xs"
              >
                ➕ Ajouter un lien
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Fichiers</div>
            <input
              ref={fileInputRef}
              className="w-full rounded border px-2 py-1 text-sm"
              type="file"
              accept=".pdf,.doc,.docx"
              multiple
              onChange={onFilesChanged}
            />
            {(fileSelection || []).length ? (
              <div className="rounded border bg-neutral-50 px-3 py-2 text-xs space-y-1">
                <div className="font-medium">Sélection :</div>
                {(fileSelection || []).map((file, idx) => (
                  <div key={idx} className="truncate">
                    {file.name}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={clearFiles}
                  className="mt-1 rounded border px-2 py-1 text-xs"
                >
                  Effacer les fichiers
                </button>
              </div>
            ) : null}
          </div>

          {generatorError ? (
            <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
              {generatorError}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeGenerator}
              className="rounded border px-3 py-1 text-sm"
            >
              Annuler
            </button>
            <button
              type={generationDone ? "button" : "submit"}
              className="rounded border px-3 py-1 text-sm"
              disabled={generatorLoading}
              onClick={generationDone ? finalizeGeneration : undefined}
            >
              {generatorLoading
                ? "Envoi..."
                : generationDone
                  ? "Terminer"
                  : "Valider"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        title="Confirmation"
      >
        <div className="space-y-3">
          <p className="text-sm">
            Voulez-vous vraiment supprimer le CV :{" "}
            <strong>{currentItem ? currentItem.label : current}</strong> ?
          </p>
          <p className="text-xs opacity-70">
            Cette action est <strong>irréversible</strong>. Le fichier JSON sera
            supprimé.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOpenDelete(false)}
              className="rounded border px-3 py-1 text-sm"
            >
              Non
            </button>
            <button
              onClick={deleteCurrent}
              className="rounded border px-3 py-1 text-sm text-red-700"
            >
              Oui
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
