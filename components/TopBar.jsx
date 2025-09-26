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

const useIsomorphicLayoutEffect = typeof window !== "undefined"
  ? React.useLayoutEffect
  : React.useEffect;

const FALLBACK_TITLE = "CV en cours d'édition";
const FALLBACK_DATE = "??/??/????";

function formatDateLabel(value){
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function normalizeBoolean(value){
  if (value === true || value === false) return value;
  if (typeof value === "string"){
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
  }
  return Boolean(value);
}

function getAnalysisOption(id){
  return ANALYSIS_OPTIONS.find((option) => option.id === id) || ANALYSIS_OPTIONS[1];
}

function enhanceItem(item, titleCache = null){
  const trimmedTitle = typeof item?.title === "string" ? item.title.trim() : "";
  const fileId = typeof item?.file === "string" ? item.file : null;

  let effectiveTitle = trimmedTitle;

  if (!effectiveTitle && titleCache && fileId){
    const cachedTitle = titleCache.get(fileId);
    if (cachedTitle) {
      effectiveTitle = cachedTitle;
    }
  }

  const isMain = normalizeBoolean(item?.isMain);
  const isGpt = normalizeBoolean(item?.isGpt);
  const hasTitle = effectiveTitle.length > 0;
  const displayTitle = hasTitle ? effectiveTitle : FALLBACK_TITLE;
  if (titleCache && hasTitle && fileId){
    titleCache.set(fileId, effectiveTitle);
  }
  const dateLabel = item?.dateLabel
    || formatDateLabel(item?.createdAt)
    || formatDateLabel(item?.updatedAt);
  const displayDate = dateLabel || FALLBACK_DATE;

  return {
    ...item,
    isMain,
    isGpt,
    isManual: !isMain && !isGpt,
    hasTitle,
    title: effectiveTitle,
    displayTitle,
    displayDate,
  };
}

function ItemLabel({ item, className = "", withHyphen = true, tickerKey = 0 }){
  if (!item) return null;
  const rootClass = [
    "flex min-w-0 items-center gap-2 leading-tight overflow-hidden",
    className,
  ].filter(Boolean).join(" ");
  const prefix = item.displayDate || FALLBACK_DATE;
  const baseTitleClass = item.hasTitle ? "font-medium" : "italic text-neutral-500";
  const titleClass = `${baseTitleClass} text-sm sm:text-base`;
  const containerRef = React.useRef(null);
  const innerRef = React.useRef(null);
  const [scrollActive, setScrollActive] = React.useState(false);
  const rafRef = React.useRef(null);
  const metricsRef = React.useRef({
    needsScroll: null,
    contentWidth: 0,
    totalWidth: 0,
    duration: 0,
    truncationDelta: 0,
  });
  const scrollActiveRef = React.useRef(false);
  const ellipsisRef = React.useRef(null);

  React.useEffect(() => {
    scrollActiveRef.current = scrollActive;
  }, [scrollActive]);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;
    let cancelled = false;

    const clearScheduledToggle = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const measure = () => {
      if (cancelled) return;
      const firstChunk = inner.querySelector(".cv-ticker__chunk");
      if (!firstChunk) return;

      const containerWidth = container.offsetWidth;
      const contentWidth = firstChunk.scrollWidth;
      if (!containerWidth || !contentWidth) {
        inner.style.removeProperty("--cv-ticker-shift");
        inner.style.removeProperty("--cv-ticker-duration");
        clearScheduledToggle();
        if (scrollActiveRef.current) setScrollActive(false);
        metricsRef.current = {
          needsScroll: false,
          contentWidth: 0,
          totalWidth: 0,
          duration: 0,
          truncationDelta: 0,
        };
        return;
      }

      const style = window.getComputedStyle(inner);
      const gapValue = parseFloat(style.columnGap || style.gap || "0");
      const gap = Number.isFinite(gapValue) ? gapValue : 0;
      const totalWidth = contentWidth + gap;
      const prevMetrics = metricsRef.current;
      const wasScrolling = prevMetrics.needsScroll === true;
      let truncationDelta;
      const ellipsisEl = ellipsisRef.current;

      if (ellipsisEl && ellipsisEl.offsetParent) {
        truncationDelta = ellipsisEl.scrollWidth - ellipsisEl.clientWidth;
      } else {
        truncationDelta = contentWidth - containerWidth;
      }

      const enableThreshold = 1.5;
      const disableThreshold = -3;
      const needsScroll = wasScrolling
        ? truncationDelta > disableThreshold
        : truncationDelta > enableThreshold;

      if (!needsScroll) {
        metricsRef.current = {
          needsScroll: false,
          contentWidth,
          totalWidth,
          duration: 0,
          truncationDelta,
        };
        inner.style.removeProperty("--cv-ticker-shift");
        inner.style.removeProperty("--cv-ticker-duration");
        clearScheduledToggle();
        if (scrollActiveRef.current) setScrollActive(false);
        return;
      }

      const duration = Math.min(Math.max(totalWidth / 40, 8), 24);
      const metricsChanged =
        prevMetrics.needsScroll !== true
        || Math.abs(prevMetrics.contentWidth - contentWidth) > 1.5
        || Math.abs(prevMetrics.totalWidth - totalWidth) > 1.5
        || Math.abs(prevMetrics.duration - duration) > 0.1
        || Math.abs(prevMetrics.truncationDelta - truncationDelta) > 1.5;

      metricsRef.current = {
        needsScroll: true,
        contentWidth,
        totalWidth,
        duration,
        truncationDelta,
      };

      if (!metricsChanged) {
        if (!scrollActiveRef.current) {
          clearScheduledToggle();
          rafRef.current = window.requestAnimationFrame(() => {
            if (cancelled) return;
            setScrollActive(true);
            rafRef.current = null;
          });
        }
        return;
      }

      inner.style.setProperty("--cv-ticker-shift", `${-totalWidth}px`);
      inner.style.setProperty("--cv-ticker-duration", `${duration}s`);
      if (!scrollActiveRef.current) {
        clearScheduledToggle();
        rafRef.current = window.requestAnimationFrame(() => {
          if (cancelled) return;
          setScrollActive(true);
          rafRef.current = null;
        });
      } else {
        clearScheduledToggle();
      }
    };

    measure();

    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready
        .then(() => {
          if (!cancelled) measure();
        })
        .catch(() => {});
    }

    let resizeObserver;
    let detachWindowListener = null;

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        measure();
      });
      resizeObserver.observe(container);
    } else {
      const handler = () => measure();
      window.addEventListener("resize", handler);
      detachWindowListener = () => window.removeEventListener("resize", handler);
    }

    return () => {
      cancelled = true;
      clearScheduledToggle();
      if (resizeObserver) resizeObserver.disconnect();
      if (detachWindowListener) detachWindowListener();
    };
  }, [item.displayTitle, tickerKey]);

  return (
    <span className={rootClass}>
      <span className="hidden sm:inline-flex flex-shrink-0 text-xs sm:text-sm opacity-60 whitespace-nowrap">
        {prefix}
      </span>
      {withHyphen ? (
        <span className="hidden sm:inline-flex flex-shrink-0 opacity-30 text-xs sm:text-sm" aria-hidden="true">
          –
        </span>
      ) : null}
      <span
        ref={ellipsisRef}
        className={`hidden sm:block truncate ${titleClass}`}
      >
        {item.displayTitle}
      </span>
      <span
        ref={containerRef}
        className={`cv-ticker sm:hidden ${titleClass} ${scrollActive ? "cv-ticker--active" : ""}`}
      >
        <span ref={innerRef} className="cv-ticker__inner">
          <span className="cv-ticker__chunk">{item.displayTitle}</span>
          {scrollActive ? (
            <span className="cv-ticker__chunk" aria-hidden="true">{item.displayTitle}</span>
          ) : null}
        </span>
      </span>
    </span>
  );
}

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
  const [generatorBaseFile, setGeneratorBaseFile] = React.useState("main.json");
  const [baseSelectorOpen, setBaseSelectorOpen] = React.useState(false);
  const [analysisLevel, setAnalysisLevel] = React.useState("medium");
  const [openPdfImport, setOpenPdfImport] = React.useState(false);
  const [pdfFile, setPdfFile] = React.useState(null);
  const [pdfImportLoading, setPdfImportLoading] = React.useState(false);
  const [pdfImportError, setPdfImportError] = React.useState("");
  const [pdfImportLogs, setPdfImportLogs] = React.useState([]);
  const [pdfAnalysisLevel, setPdfAnalysisLevel] = React.useState("medium");

  const fileInputRef = React.useRef(null);
  const pdfFileInputRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const dropdownPortalRef = React.useRef(null);
  const logsRef = React.useRef(null);
  const barRef = React.useRef(null);
  const baseSelectorRef = React.useRef(null);
  const baseDropdownRef = React.useRef(null);
  const titleCacheRef = React.useRef(new Map());
  const [tickerResetKey, setTickerResetKey] = React.useState(() => Date.now());
  const [iconRefreshKey, setIconRefreshKey] = React.useState(() => Date.now());
  const lastSelectedRef = React.useRef(null);
  const lastSelectedMetaRef = React.useRef(null);
  const currentItem = React.useMemo(
    () => items.find((it) => it.file === current),
    [items, current],
  );
  const generatorSourceItems = React.useMemo(
    () => items.filter((it) => !it.isGpt),
    [items],
  );
  const generatorBaseItem = React.useMemo(
    () => generatorSourceItems.find((it) => it.file === generatorBaseFile) || null,
    [generatorSourceItems, generatorBaseFile],
  );
  const currentAnalysisOption = React.useMemo(
    () => getAnalysisOption(analysisLevel),
    [analysisLevel],
  );
  const currentPdfAnalysisOption = React.useMemo(
    () => getAnalysisOption(pdfAnalysisLevel),
    [pdfAnalysisLevel],
  );
  const resolvedCurrentItem = React.useMemo(() => {
    // Always prioritize the current item from fresh data
    if (currentItem) return currentItem;

    // Only use cached reference if it matches current selection and exists in items
    const cachedRef = lastSelectedMetaRef.current;
    if (cachedRef && current === cachedRef.file && items.some(it => it.file === cachedRef.file)) {
      // Refresh the cached item with current data to avoid stale properties
      const freshItem = items.find(it => it.file === cachedRef.file);
      if (freshItem) {
        lastSelectedMetaRef.current = freshItem;
        return freshItem;
      }
    }

    return null;
  }, [currentItem, current, items]);
  const emitListChanged = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("cv:list:changed"));
    }
  }, []);
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

  async function reload(preferredCurrent) {
    if (!isAuthenticated) {
      setItems([]);
      setCurrent("main.json");
      titleCacheRef.current.clear();
      lastSelectedRef.current = "main.json";
      lastSelectedMetaRef.current = null;
      return;
    }

    try {
      const res = await fetch("/api/cvs", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("API CV non disponible");
      }
      const data = await res.json();
      const cache = titleCacheRef.current;
      const normalizedItems = Array.isArray(data.items)
        ? data.items.map((it) => enhanceItem(it, cache))
        : [];
      setItems(normalizedItems);

      const candidate = preferredCurrent || lastSelectedRef.current;
      const hasCandidate = candidate && normalizedItems.some((it) => it.file === candidate);
      const serverSuggested = data.current && normalizedItems.some((it) => it.file === data.current)
        ? data.current
        : null;

      let nextCurrent = null;
      if (hasCandidate) {
        nextCurrent = candidate;
      } else if (serverSuggested) {
        nextCurrent = serverSuggested;
      } else if (normalizedItems.length) {
        const mainItem = normalizedItems.find((it) => it.isMain);
        nextCurrent = mainItem ? mainItem.file : normalizedItems[0].file;
      }

      if (nextCurrent) {
        setCurrent(nextCurrent);
        lastSelectedRef.current = nextCurrent;
        try {
          localStorage.setItem("admin:cv", nextCurrent);
        } catch (_err) {}
        if (typeof setCurrentFile === "function") setCurrentFile(nextCurrent);
        // Clear any stale reference first, then set the fresh one
        lastSelectedMetaRef.current = null;
        const matched = normalizedItems.find((it) => it.file === nextCurrent);
        if (matched) {
          lastSelectedMetaRef.current = matched;
        }
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
    if (!generatorSourceItems.length) {
      setGeneratorBaseFile("");
      setBaseSelectorOpen(false);
      return;
    }
    setGeneratorBaseFile((prev) => {
      if (prev && generatorSourceItems.some((it) => it.file === prev)) {
        return prev;
      }
      const preferred = generatorSourceItems.find((it) => it.file === current)
        || generatorSourceItems.find((it) => it.isMain)
        || generatorSourceItems[0];
      return preferred ? preferred.file : prev;
    });
  }, [generatorSourceItems, current]);

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
    // Clear the cached reference to avoid stale data
    lastSelectedMetaRef.current = null;

    const selected = items.find((it) => it.file === file);
    if (selected) {
      lastSelectedMetaRef.current = selected;
    }
    lastSelectedRef.current = file;
    document.cookie =
      "cvFile=" + encodeURIComponent(file) + "; path=/; max-age=31536000";
    try {
      localStorage.setItem("admin:cv", file);
    } catch (_err) {}
    if (typeof setCurrentFile === "function") setCurrentFile(file);
    setCurrent(file);
    // Force icon refresh to prevent caching issues
    setIconRefreshKey(Date.now());
    router.refresh();
    // also refresh list labels, in case ordering/labels changed
    await reload(file);
  }

  React.useEffect(() => {
    setPortalReady(true);
  }, []);

  const openGeneratorModal = React.useCallback(() => {
    setBaseSelectorOpen(false);
    const manualItems = generatorSourceItems;
    let nextBase = "";

    const baseCandidate = currentItem || lastSelectedMetaRef.current;
    if (
      baseCandidate &&
      !baseCandidate.isGpt &&
      manualItems.some((it) => it.file === baseCandidate.file)
    ) {
      nextBase = baseCandidate.file;
    } else {
      const mainCandidate = manualItems.find((it) => it.isMain);
      nextBase = mainCandidate?.file || manualItems[0]?.file || "";
    }

    setGeneratorBaseFile((prev) => {
      if (nextBase) return nextBase;
      return manualItems.some((it) => it.file === prev) ? prev : "";
    });
    setGeneratorError("");
    setOpenGenerator(true);
  }, [currentItem, generatorSourceItems]);

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

  React.useEffect(() => {
    if (!baseSelectorOpen) return undefined;
    function handleClick(event) {
      const container = baseSelectorRef.current;
      const dropdown = baseDropdownRef.current;
      if (container && container.contains(event.target)) return;
      if (dropdown && dropdown.contains(event.target)) return;
      setBaseSelectorOpen(false);
    }

    function handleKey(event) {
      if (event.key === "Escape") setBaseSelectorOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [baseSelectorOpen]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setTickerResetKey(Date.now());
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined" || !barRef.current || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setTickerResetKey(Date.now());
        }
      });
    }, { threshold: 0.6 });
    observer.observe(barRef.current);
    return () => observer.disconnect();
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
      try {
        await reload();
      } catch (reloadError) {
        console.error("Impossible de recharger la liste des CV", reloadError);
      }
      emitListChanged();
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
    setAnalysisLevel("medium");
    setBaseSelectorOpen(false);
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

  function resetPdfImportState() {
    setPdfFile(null);
    setPdfImportError("");
    setPdfImportLogs([]);
    setPdfAnalysisLevel("medium");
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
    if (pdfImportLoading || !pdfFile) return;

    const formData = new FormData();
    formData.append("pdfFile", pdfFile);
    const selectedPdfAnalysis = currentPdfAnalysisOption;
    formData.append("analysisLevel", selectedPdfAnalysis.id);
    formData.append("model", selectedPdfAnalysis.model);

    setPdfImportLoading(true);
    setPdfImportError("");
    setPdfImportLogs([]);

    let finalSuccess = false;
    let finalError = "";
    let finalTargetFile = null;

    const appendPdfLog = (message) => {
      if (!message) return;
      setPdfImportLogs((prev) => [...prev, message]);
    };

    try {
      appendPdfLog("Traitement du fichier PDF en cours...");

      const response = await fetch("/api/chatgpt/import-pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          payload?.error || "Erreur lors de l'import du PDF."
        );
      }

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/x-ndjson")) {
        // Traitement en streaming comme pour le générateur
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
              appendPdfLog(part.trim());
              continue;
            }

            if (evt.type === "stdout" || evt.type === "log") {
              appendPdfLog(evt.message || evt.data || "");
              hasStreamOutput = true;
            } else if (evt.type === "stderr") {
              const raw = evt.message || evt.data || "";
              const trimmed = raw.trim();
              if (/^\[(INFO|AVERTISSEMENT)\]/i.test(trimmed))
                appendPdfLog(trimmed);
              else appendPdfLog(`[Erreur] ${trimmed || raw}`);
            } else if (evt.type === "status") {
              appendPdfLog(evt.message || "");
            } else if (evt.type === "error") {
              finalError = evt.message || "Erreur lors de l'import du PDF.";
              appendPdfLog(`[Erreur] ${finalError}`);
              streamClosed = true;
              break;
            } else if (evt.type === "complete") {
              if (evt.output && !hasStreamOutput) {
                appendPdfLog(evt.output);
              }
              finalSuccess = !!evt.success;
              if (finalSuccess) {
                finalTargetFile = evt.file || null;
                appendPdfLog("Import PDF terminé avec succès.");
              } else {
                finalError = evt.error || evt.output || "L'import a échoué.";
                appendPdfLog(`[Erreur] ${finalError}`);
              }
              streamClosed = true;
              break;
            }
          }
          if (streamClosed) break;
        }

        if (!streamClosed && buffer.trim()) appendPdfLog(buffer.trim());
        await reader.cancel().catch(() => {});

        if (!streamClosed && !finalSuccess && !finalError) {
          finalError = "Flux interrompu avant la fin de l'import.";
        }
      } else {
        // Réponse JSON classique
        const payload = await response.json().catch(() => ({}));
        const generatedFile = payload?.file;

        if (payload?.output) appendPdfLog(payload.output);

        if (generatedFile) {
          finalTargetFile = generatedFile;
          finalSuccess = true;
          appendPdfLog(`CV généré : ${generatedFile}`);
        } else if (payload?.success) {
          finalSuccess = true;
          appendPdfLog("Import terminé.");
        } else {
          finalError = payload?.error || "L'import s'est terminé sans fichier.";
          appendPdfLog(`[Erreur] ${finalError}`);
        }
      }
    } catch (error) {
      finalError = error.message || "Erreur inattendue lors de l'import du PDF.";
      appendPdfLog(`[Erreur] ${finalError}`);
    } finally {
      setPdfImportLoading(false);
    }

    if (finalSuccess) {
      try {
        await reload();
      } catch (reloadError) {
        console.error("Impossible de recharger la liste après import", reloadError);
      }
      emitListChanged();
      if (finalTargetFile) {
        await selectFile(finalTargetFile);
      }
      closePdfImport();
    } else if (finalError) {
      setPdfImportError(finalError);
    }
  }

  async function submitGenerator(event) {
    event.preventDefault();
    if (generatorLoading) return;

    if (!generatorBaseFile) {
      setGeneratorError("Sélectionnez un CV de référence avant de lancer l'analyse.");
      return;
    }

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
    formData.append("baseFile", generatorBaseFile);
    const baseFileLabel = generatorBaseItem?.displayTitle
      || generatorBaseItem?.title
      || "";
    formData.append("baseFileLabel", baseFileLabel);
    const selectedAnalysis = currentAnalysisOption;
    formData.append("analysisLevel", selectedAnalysis.id);
    formData.append("model", selectedAnalysis.model);
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
      try {
        await reload();
      } catch (reloadError) {
        console.error("Impossible de recharger la liste après génération", reloadError);
      }
      emitListChanged();
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
    <>
      <div
        ref={barRef}
        className="no-print sticky top-0 inset-x-0 z-40 w-full bg-white/80 backdrop-blur border-b"
      >
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
            className="w-full min-w-0 rounded border px-3 py-1 text-sm flex items-center justify-between gap-3 hover:shadow overflow-hidden"
            ref={triggerRef}
          >
            <span className="flex items-center gap-3 min-w-0 overflow-hidden">
              {resolvedCurrentItem ? (
                <span
                  key={`icon-${current}-${resolvedCurrentItem.isMain}-${resolvedCurrentItem.isGpt}-${iconRefreshKey}`}
                  className="flex h-6 w-6 items-center justify-center shrink-0"
                >
                  {resolvedCurrentItem.isMain ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wide leading-none">
                      RAW
                    </span>
                  ) : resolvedCurrentItem.isGpt ? (
                    <GptLogo className="h-4 w-4" />
                  ) : (
                    <DefaultCvIcon className="h-4 w-4" size={16} />
                  )}
                </span>
              ) : null}
              <span className="min-w-0">
                {resolvedCurrentItem ? (
                  <ItemLabel
                    item={resolvedCurrentItem}
                    tickerKey={tickerResetKey}
                    withHyphen={false}
                  />
                ) : (
                  <span className="truncate italic text-neutral-500">
                    Chargement en cours ...
                  </span>
                )}
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
                        <span
                          key={`dropdown-icon-${it.file}-${it.isMain}-${it.isGpt}`}
                          className="flex h-6 w-6 items-center justify-center shrink-0"
                        >
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
                        <ItemLabel
                          item={it}
                          className="leading-tight"
                          tickerKey={tickerResetKey}
                          withHyphen={false}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>,
              document.body,
            )
          : null}
        <button
          onClick={openGeneratorModal}
          className="rounded border text-sm hover:shadow inline-flex items-center justify-center leading-none h-8 w-8"
          type="button"
        >
          <GptLogo className="h-4 w-4" />
        </button>
        <button
          onClick={() => setOpenPdfImport(true)}
          className="rounded border text-sm hover:shadow inline-flex items-center justify-center leading-none h-8 w-8"
          type="button"
          title="Importer un CV PDF"
        >
          <img src="/icons/import.png" alt="Import" className="h-4 w-4" />
        </button>
        <button
          onClick={() => router.push("/admin/new")}
          className="rounded border text-sm hover:shadow inline-flex items-center justify-center h-8 w-8"
        >
          ➕
        </button>
        <button
          onClick={() => {
            if (current === "main.json") return;
            setOpenDelete(true);
          }}
          disabled={current === "main.json"}
          className={`rounded border text-sm hover:shadow inline-flex items-center justify-center h-8 w-8 ${current === "main.json" ? "opacity-40 cursor-not-allowed" : "text-red-700"}`}
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
            PDF/Word) pour générer des CV adaptés à partir du CV de référence
            sélectionné.
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">CV de référence</div>
            {generatorSourceItems.length ? (
              <div className="relative" ref={baseSelectorRef}>
                <button
                  type="button"
                  onClick={() => setBaseSelectorOpen((prev) => !prev)}
                  className="w-full min-w-0 rounded border px-3 py-1 text-sm flex items-center justify-between gap-3 hover:shadow bg-white"
                >
                  <span className="flex items-center gap-3 min-w-0 overflow-hidden">
                    {generatorBaseItem ? (
                      <span
                        key={`gen-base-icon-${generatorBaseFile}-${generatorBaseItem.isMain}-${generatorBaseItem.isGpt}`}
                        className="flex h-6 w-6 items-center justify-center shrink-0"
                      >
                        {generatorBaseItem.isMain ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide leading-none">
                            RAW
                          </span>
                        ) : (
                          <DefaultCvIcon className="h-4 w-4" size={16} />
                        )}
                      </span>
                    ) : null}
                    <span className="min-w-0">
                      {generatorBaseItem ? (
                        <ItemLabel
                          item={generatorBaseItem}
                          withHyphen={false}
                          tickerKey={tickerResetKey}
                        />
                      ) : (
                        <span className="truncate italic text-neutral-500">
                          Sélectionnez un CV
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="text-xs opacity-60">▾</span>
                </button>
                {baseSelectorOpen ? (
                  <div
                    ref={baseDropdownRef}
                    className="absolute z-10 mt-1 w-full rounded border bg-white shadow-lg max-h-60 overflow-y-auto"
                  >
                    <ul className="py-1">
                      {generatorSourceItems.map((item) => (
                        <li key={item.file}>
                          <button
                            type="button"
                            onClick={() => {
                              setGeneratorBaseFile(item.file);
                              setBaseSelectorOpen(false);
                            }}
                            className={`w-full px-3 py-1 text-left text-sm flex items-center gap-3 hover:bg-zinc-100 ${item.file === generatorBaseFile ? "bg-zinc-50" : ""}`}
                          >
                            <span
                              key={`gen-dropdown-icon-${item.file}-${item.isMain}-${item.isGpt}`}
                              className="flex h-6 w-6 items-center justify-center shrink-0"
                            >
                              {item.isMain ? (
                                <span className="text-[10px] font-semibold uppercase tracking-wide leading-none">
                                  RAW
                                </span>
                              ) : (
                                <DefaultCvIcon className="h-4 w-4" size={16} />
                              )}
                            </span>
                            <ItemLabel
                              item={item}
                              className="leading-tight"
                              withHyphen={false}
                              tickerKey={tickerResetKey}
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Aucun CV manuel disponible. Créez un CV avant de lancer une
                génération avec l'IA.
              </div>
            )}
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
            <div className="text-sm font-medium">Qualité de l'analyse</div>
            <div className="grid grid-cols-3 gap-1 rounded-lg border bg-neutral-50 p-1 text-xs sm:text-sm">
              {ANALYSIS_OPTIONS.map((option) => {
                const active = option.id === analysisLevel;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setAnalysisLevel(option.id)}
                    className={`rounded-md px-2 py-1 font-medium transition ${active ? "bg-white text-emerald-600 shadow" : "text-neutral-600 hover:bg-white"}`}
                    aria-pressed={active}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-neutral-500">
              {currentAnalysisOption.hint}
            </p>
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
              disabled={generatorLoading || !generatorBaseFile}
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
        open={openPdfImport}
        onClose={closePdfImport}
        title="Importer un CV PDF"
      >
        <form onSubmit={submitPdfImport} className="space-y-4">
          <div className="text-sm text-neutral-700">
            Importez un CV au format PDF pour le convertir automatiquement en
            utilisant l'intelligence artificielle et le schéma de votre CV raw.
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
            {pdfImportLoading ? (
              <div className="h-2 w-full overflow-hidden rounded bg-blue-100">
                <div className="h-full w-full bg-blue-500 animate-pulse"></div>
              </div>
            ) : null}
            <div className="h-40 overflow-y-auto rounded border bg-black/90 p-2 font-mono text-xs text-blue-100">
              {pdfImportLogs.length ? (
                pdfImportLogs.map((line, idx) => (
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
              {currentPdfAnalysisOption.hint}
            </p>
          </div>

          {pdfImportError ? (
            <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
              {pdfImportError}
            </div>
          ) : null}

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
              disabled={pdfImportLoading || !pdfFile}
            >
              {pdfImportLoading ? "Import..." : "Importer"}
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
            <strong>{currentItem ? currentItem.displayTitle : current}</strong> ?
          </p>
          <p className="text-xs opacity-70">
            Cette action est <strong>irréversible</strong>.
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
      <style jsx global>{`
        .cv-ticker {
          max-width: 100%;
        }

        .cv-ticker__inner {
          --cv-ticker-duration: 12s;
          --cv-ticker-shift: -50%;
          display: inline-flex;
          align-items: center;
          gap: 1.5rem;
          transform: translate3d(0, 0, 0);
        }

        .cv-ticker__chunk {
          display: inline-block;
          white-space: nowrap;
        }

        @media (max-width: 639px) {
          .cv-ticker {
            position: relative;
            display: block;
            overflow: hidden;
          }

          .cv-ticker--active .cv-ticker__inner {
            animation: cv-ticker-scroll var(--cv-ticker-duration) linear infinite;
          }
        }

        @keyframes cv-ticker-scroll {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(var(--cv-ticker-shift), 0, 0);
          }
        }
      `}</style>
    </>
  );
}
