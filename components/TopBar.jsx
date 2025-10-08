"use client";
import React from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Modal from "./ui/Modal";
import GptLogo from "./ui/GptLogo";
import DefaultCvIcon from "./ui/DefaultCvIcon";
import ImportIcon from "./ui/ImportIcon";
import TranslateIcon from "./ui/TranslateIcon";
import { useAdmin } from "./admin/AdminProvider";
import { useBackgroundTasks } from "@/components/BackgroundTasksProvider";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import TaskQueueModal from "./TaskQueueModal";
import TaskQueueDropdown from "./TaskQueueDropdown";
import QueueIcon from "./ui/QueueIcon";
import { useLinkHistory } from "@/hooks/useLinkHistory";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { ANALYSIS_OPTIONS, getAnalysisLevelLabel } from "@/lib/i18n/cvLabels";

const useIsomorphicLayoutEffect = typeof window !== "undefined"
  ? React.useLayoutEffect
  : React.useEffect;

// Option spéciale pour créer un nouveau CV modèle à partir d'une offre
const CREATE_TEMPLATE_OPTION = "__CREATE_NEW_TEMPLATE__";

function formatDateLabel(value, language = 'fr'){
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  // Format selon la langue : FR = DD/MM/YYYY, EN = MM/DD/YYYY
  if (language === 'en') {
    return `${month}/${day}/${year}`;
  }
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

function getAnalysisOption(id, t){
  const options = ANALYSIS_OPTIONS(t);
  return options.find((option) => option.id === id) || options[1];
}

function getCvIcon(createdBy, originalCreatedBy, className) {
  // createdBy = 'translate-cv' => Translate icon (traduit)
  // createdBy = 'generate-cv' => GPT icon (généré par IA)
  // createdBy = 'create-template' => GPT icon (CV modèle créé par IA)
  // createdBy = 'generate-cv-job-title' => GPT icon (CV généré depuis titre de poste)
  // createdBy = 'improve-cv' => Rocket icon (CV amélioré par IA)
  // createdBy = 'import-pdf' => Import icon (importé depuis PDF)
  // createdBy = null => Pas d'icône (créé manuellement)
  if (createdBy === 'translate-cv') {
    return <TranslateIcon className={className} size={16} />;
  }
  if (createdBy === 'improve-cv') {
    return <span className={className}>🚀</span>; // Icône fusée pour CV amélioré
  }
  if (createdBy === 'generate-cv' || createdBy === 'create-template' || createdBy === 'generate-cv-job-title') {
    return <GptLogo className={className} />;
  }
  if (createdBy === 'import-pdf') {
    return <ImportIcon className={className} size={16} />;
  }
  return null; // Pas d'icône pour les CVs manuels
}


function enhanceItem(item, titleCache = null, fallbackTitle = "CV"){
  const trimmedTitle = typeof item?.title === "string" ? item.title.trim() : "";
  const fileId = typeof item?.file === "string" ? item.file : null;

  let effectiveTitle = trimmedTitle;

  if (!effectiveTitle && titleCache && fileId){
    const cachedTitle = titleCache.get(fileId);
    if (cachedTitle) {
      effectiveTitle = cachedTitle;
    }
  }

  const isGpt = normalizeBoolean(item?.isGpt);
  const hasTitle = effectiveTitle.length > 0;
  const displayTitle = hasTitle ? effectiveTitle : fallbackTitle;
  if (titleCache && hasTitle && fileId){
    titleCache.set(fileId, effectiveTitle);
  }

  // Don't calculate displayDate here - let useMemo handle it for reactivity
  return {
    ...item,
    isGpt,
    isManual: !isGpt,
    hasTitle,
    title: effectiveTitle,
    displayTitle,
  };
}

const ItemLabel = React.memo(function ItemLabel({ item, className = "", withHyphen = true, tickerKey = 0, t }){
  if (!item) return null;
  const rootClass = [
    "flex min-w-0 items-center gap-2 leading-tight overflow-hidden",
    className,
  ].filter(Boolean).join(" ");
  const prefix = item.displayDate || "??/??/????";
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

  const levelLabel = getAnalysisLevelLabel(item.analysisLevel, t);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;
    let cancelled = false;
    let measureTimeout = null;

    const clearScheduledToggle = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const measure = () => {
      if (cancelled) return;

      // Debounce measure to avoid excessive calculations
      if (measureTimeout) {
        clearTimeout(measureTimeout);
      }

      measureTimeout = setTimeout(() => {
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
      }, 50); // 50ms debounce
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
      if (measureTimeout) clearTimeout(measureTimeout);
      if (resizeObserver) resizeObserver.disconnect();
      if (detachWindowListener) detachWindowListener();
    };
  }, [item.displayTitle, item.analysisLevel, item.createdBy, item.isTranslated, tickerKey]);

  const shouldShowLevel = (item.createdBy === 'generate-cv' || item.createdBy === 'import-pdf' || item.createdBy === 'generate-cv-job-title') && levelLabel;

  let displayTitleWithLevel = item.displayTitle;
  if (shouldShowLevel) {
    displayTitleWithLevel = `${displayTitleWithLevel} [${levelLabel}]`;
  }

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
        {displayTitleWithLevel}
      </span>
      <span
        ref={containerRef}
        className={`cv-ticker sm:hidden ${titleClass} ${scrollActive ? "cv-ticker--active" : ""}`}
      >
        <span ref={innerRef} className="cv-ticker__inner">
          <span className="cv-ticker__chunk">{displayTitleWithLevel}</span>
          {scrollActive ? (
            <span className="cv-ticker__chunk" aria-hidden="true">{displayTitleWithLevel}</span>
          ) : null}
        </span>
      </span>
    </span>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Only re-render if these specific props changed
  return (
    prevProps.item?.file === nextProps.item?.file &&
    prevProps.item?.displayTitle === nextProps.item?.displayTitle &&
    prevProps.item?.displayDate === nextProps.item?.displayDate &&
    prevProps.item?.analysisLevel === nextProps.item?.analysisLevel &&
    prevProps.item?.createdBy === nextProps.item?.createdBy &&
    prevProps.tickerKey === nextProps.tickerKey &&
    prevProps.className === nextProps.className &&
    prevProps.withHyphen === nextProps.withHyphen
  );
});

export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setCurrentFile } = useAdmin();
  const { data: session, status } = useSession();
  const isAuthenticated = !!session?.user?.id;
  const { localDeviceId, refreshTasks, addOptimisticTask, removeOptimisticTask } = useBackgroundTasks();
  const { addNotification } = useNotifications();
  const { t, language } = useLanguage();

  const [rawItems, setRawItems] = React.useState([]);

  // Recalculate displayDate when language changes
  const items = React.useMemo(() => {
    return rawItems.map((it) => {
      // Always recalculate from raw dates, ignore any existing dateLabel
      const formattedDate = formatDateLabel(it.createdAt, language)
        || formatDateLabel(it.updatedAt, language);
      const displayDate = formattedDate || it.dateLabel || "??/??/????";
      return { ...it, displayDate };
    });
  }, [rawItems, language]);

  const [current, setCurrent] = React.useState("");
  const [openDelete, setOpenDelete] = React.useState(false);
  const [openGenerator, setOpenGenerator] = React.useState(false);
  const [listOpen, setListOpen] = React.useState(false);
  const [dropdownRect, setDropdownRect] = React.useState(null);
  const [portalReady, setPortalReady] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [userMenuRect, setUserMenuRect] = React.useState(null);
  const userMenuRef = React.useRef(null);
  const userMenuButtonRef = React.useRef(null);

  const [linkInputs, setLinkInputs] = React.useState([""]);
  const [fileSelection, setFileSelection] = React.useState([]);
  const [generatorError, setGeneratorError] = React.useState("");
  const [generatorBaseFile, setGeneratorBaseFile] = React.useState("");
  const [baseSelectorOpen, setBaseSelectorOpen] = React.useState(false);
  const [analysisLevel, setAnalysisLevel] = React.useState("medium");
  const [openPdfImport, setOpenPdfImport] = React.useState(false);
  const [pdfFile, setPdfFile] = React.useState(null);
  const [pdfAnalysisLevel, setPdfAnalysisLevel] = React.useState("medium");
  const [openTaskQueue, setOpenTaskQueue] = React.useState(false);
  const [openTaskDropdown, setOpenTaskDropdown] = React.useState(false);
  const [linkHistoryDropdowns, setLinkHistoryDropdowns] = React.useState({});
  const [openNewCv, setOpenNewCv] = React.useState(false);
  const [newCvFullName, setNewCvFullName] = React.useState("");
  const [newCvCurrentTitle, setNewCvCurrentTitle] = React.useState("");
  const [newCvEmail, setNewCvEmail] = React.useState("");
  const [newCvBusy, setNewCvBusy] = React.useState(false);
  const [newCvError, setNewCvError] = React.useState(null);
  const [isScrollingDown, setIsScrollingDown] = React.useState(false);
  const [lastScrollY, setLastScrollY] = React.useState(0);
  const isScrollingDownRef = React.useRef(false);
  const [jobTitleInput, setJobTitleInput] = React.useState("");
  const [isMobile, setIsMobile] = React.useState(false);
  const [isScrollingInDropdown, setIsScrollingInDropdown] = React.useState(false);

  const { history: linkHistory, addLinksToHistory } = useLinkHistory();

  // Detect mobile screen size
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fileInputRef = React.useRef(null);
  const pdfFileInputRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const taskQueueButtonRef = React.useRef(null);
  const scrollTimeoutRef = React.useRef(null);

  // Close dropdown on window resize (mobile/desktop change)
  React.useEffect(() => {
    const handleResize = () => {
      setOpenTaskDropdown(false);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const dropdownPortalRef = React.useRef(null);
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
    () => items.filter((it) => !it.isGenerated), // Allow imported CVs, exclude only generated ones
    [items],
  );
  const generatorBaseItem = React.useMemo(
    () => generatorSourceItems.find((it) => it.file === generatorBaseFile) || null,
    [generatorSourceItems, generatorBaseFile],
  );
  const currentAnalysisOption = React.useMemo(
    () => getAnalysisOption(analysisLevel, t),
    [analysisLevel, t],
  );
  const currentPdfAnalysisOption = React.useMemo(
    () => getAnalysisOption(pdfAnalysisLevel, t),
    [pdfAnalysisLevel, t],
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

  const reload = React.useCallback(async (preferredCurrent) => {
    if (!isAuthenticated) {
      setRawItems([]);
      setCurrent("");
      titleCacheRef.current.clear();
      lastSelectedRef.current = "";
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
        ? data.items.map((it) => enhanceItem(it, cache, "CV"))
        : [];
      setRawItems(normalizedItems);

      // Priority: 1) preferredCurrent 2) server cookie 3) localStorage/lastSelected 4) first item
      const serverSuggested = data.current && normalizedItems.some((it) => it.file === data.current)
        ? data.current
        : null;
      const candidate = preferredCurrent || lastSelectedRef.current;
      const hasCandidate = candidate && normalizedItems.some((it) => it.file === candidate);

      let nextCurrent = null;
      if (preferredCurrent && normalizedItems.some((it) => it.file === preferredCurrent)) {
        nextCurrent = preferredCurrent;
      } else if (serverSuggested) {
        // Prioritize cookie (set when creating new CV)
        nextCurrent = serverSuggested;
      } else if (hasCandidate) {
        nextCurrent = candidate;
      } else if (normalizedItems.length) {
        nextCurrent = normalizedItems[0].file;
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

        // Notify components that CV has been selected/changed
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("cv:selected", { detail: { file: nextCurrent } }));
        }
      }
    } catch (error) {
      setRawItems([]);
    }
  }, [isAuthenticated, setCurrentFile]);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    reload();
  }, [isAuthenticated, pathname, searchParams?.toString(), reload]);

  // Listen for import event from EmptyState
  React.useEffect(() => {
    const handleOpenImport = () => {
      setOpenPdfImport(true);
    };
    window.addEventListener("cv:open-import", handleOpenImport);
    return () => window.removeEventListener("cv:open-import", handleOpenImport);
  }, []);

  React.useEffect(() => {
    if (!generatorSourceItems.length) {
      setGeneratorBaseFile(CREATE_TEMPLATE_OPTION);
      setBaseSelectorOpen(false);
      return;
    }
    setGeneratorBaseFile((prev) => {
      // Conserver l'option template si elle est sélectionnée
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

  React.useEffect(() => {
    if (!isAuthenticated) return undefined;
    const onChanged = () => reload();
    window.addEventListener("cv:list:changed", onChanged);
    window.addEventListener("realtime:cv:list:changed", onChanged); // Écouter les mises à jour temps réel
    window.addEventListener("focus", onChanged);
    return () => {
      window.removeEventListener("cv:list:changed", onChanged);
      window.removeEventListener("realtime:cv:list:changed", onChanged);
      window.removeEventListener("focus", onChanged);
    };
  }, [isAuthenticated, reload]);

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

    // Rafraîchir d'abord Next.js et la liste
    router.refresh();
    await reload(file);

    // Puis déclencher les événements pour les composants clients
    if (typeof window !== "undefined") {
      // Petit délai pour laisser router.refresh() se propager
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("cv:selected", { detail: { file } }));

        // Déclencher les mêmes événements que RealtimeRefreshProvider pour la cohérence
        window.dispatchEvent(new CustomEvent('realtime:cv:updated', { detail: { filename: file } }));
        window.dispatchEvent(new CustomEvent('realtime:cv:metadata:updated', { detail: { filename: file } }));
        window.dispatchEvent(new CustomEvent('realtime:cv:list:changed', { detail: { filename: file } }));

      }, 100);
    }
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
      !baseCandidate.isGenerated && // Allow imported CVs as base
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
    if (listOpen && triggerRef.current) {
      setDropdownRect(triggerRef.current.getBoundingClientRect());
    }
  }, [listOpen, items, current]);

  React.useEffect(() => {
    if (userMenuOpen && userMenuButtonRef.current) {
      setUserMenuRect(userMenuButtonRef.current.getBoundingClientRect());
    }
  }, [userMenuOpen]);

  React.useEffect(() => {
    let touchHandled = false;
    let touchTimeout = null;

    function handleClick(event) {
      // Prevent duplicate handling on iOS
      if (event.type === 'touchstart') {
        touchHandled = true;
        if (touchTimeout) clearTimeout(touchTimeout);
        touchTimeout = setTimeout(() => {
          touchHandled = false;
        }, 500);
      } else if (event.type === 'mousedown' && touchHandled) {
        return;
      }

      const buttonEl = userMenuButtonRef.current;
      const menuEl = userMenuRef.current;
      if (buttonEl && buttonEl.contains(event.target)) return;
      if (menuEl && menuEl.contains(event.target)) return;
      setUserMenuOpen(false);
    }

    function handleKey(event) {
      if (event.key === "Escape") setUserMenuOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick, { passive: true });
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
      document.removeEventListener("keydown", handleKey);
      if (touchTimeout) clearTimeout(touchTimeout);
    };
  }, []);

  // Unified scroll handler
  React.useEffect(() => {
    let scrollEndTimeout = null;
    let lastDirection = null;
    let isScrolling = false;

    function handleScroll() {
      // Only on mobile (width < 768px)
      if (window.innerWidth >= 768) {
        setIsScrollingDown(false);
        // Don't close dropdown on scroll - let outside click handle it
        return;
      }

      // TEMPORARY: Disable hide/show on mobile to test
      setIsScrollingDown(false);
      return;

      // On mobile: don't close dropdown immediately, let user interaction handle it
      // This prevents the dropdown from closing during scroll-triggered events

      const currentScrollY = window.scrollY;
      isScrolling = true;

      // Clear scroll end timeout
      if (scrollEndTimeout) {
        clearTimeout(scrollEndTimeout);
      }

      const scrollDelta = currentScrollY - lastScrollY;

      // Determine scroll direction
      let currentDirection = null;
      if (scrollDelta > 5 && currentScrollY > 60) {
        currentDirection = 'down';
      } else if (scrollDelta < -5) {
        currentDirection = 'up';
      }

      // Only update state if direction changed or is significant
      if (currentDirection === 'down' && lastDirection !== 'down') {
        setIsScrollingDown(true);
        lastDirection = 'down';
      } else if (currentDirection === 'up' && lastDirection !== 'up') {
        setIsScrollingDown(false);
        lastDirection = 'up';
      }

      setLastScrollY(currentScrollY);

      // After scroll stops (no scroll event for 150ms), always show topbar
      scrollEndTimeout = setTimeout(() => {
        setIsScrollingDown(false);
        lastDirection = null;
        isScrolling = false;
      }, 150);
    }

    function updatePosition() {
      if (listOpen && triggerRef.current) {
        setDropdownRect(triggerRef.current.getBoundingClientRect());
      }
    }

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (scrollEndTimeout) {
        clearTimeout(scrollEndTimeout);
      }
    };
  }, [lastScrollY, listOpen]);

  React.useEffect(() => {
    let touchHandled = false;
    let touchTimeout = null;

    function handleClick(event) {
      if (!listOpen) return; // Only handle when dropdown is open
      if (isScrollingInDropdown) return; // Don't close while scrolling

      // On iOS, touchstart fires before mousedown
      // Set flag to prevent duplicate handling
      if (event.type === 'touchstart') {
        touchHandled = true;
        if (touchTimeout) clearTimeout(touchTimeout);
        touchTimeout = setTimeout(() => {
          touchHandled = false;
        }, 500);
      } else if (event.type === 'mousedown' && touchHandled) {
        // Skip mousedown if touchstart was just handled
        return;
      }

      const triggerEl = triggerRef.current;
      const dropdownEl = dropdownPortalRef.current;

      if (!triggerEl) return;

      // Ignore clicks on trigger
      if (triggerEl.contains(event.target)) {
        return;
      }

      // Ignore clicks inside dropdown
      if (dropdownEl && dropdownEl.contains(event.target)) {
        return;
      }

      setListOpen(false);
    }

    function handleKey(event) {
      if (event.key === "Escape" && listOpen) {
        setListOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick, { passive: true });
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
      document.removeEventListener("keydown", handleKey);
      if (touchTimeout) clearTimeout(touchTimeout);
    };
  }, [listOpen, isScrollingInDropdown]);

  React.useEffect(() => {
    if (!baseSelectorOpen) return undefined;
    let touchHandled = false;
    let touchTimeout = null;

    function handleClick(event) {
      // Prevent duplicate handling on iOS
      if (event.type === 'touchstart') {
        touchHandled = true;
        if (touchTimeout) clearTimeout(touchTimeout);
        touchTimeout = setTimeout(() => {
          touchHandled = false;
        }, 500);
      } else if (event.type === 'mousedown' && touchHandled) {
        return;
      }

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
    document.addEventListener("touchstart", handleClick, { passive: true });
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
      document.removeEventListener("keydown", handleKey);
      if (touchTimeout) clearTimeout(touchTimeout);
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
      }
      emitListChanged();
      router.refresh();
    } catch (e) {
      alert(
        t("deleteModal.errors.deleteFailed") + " " + (e && e.message ? e.message : String(e)),
      );
      setOpenDelete(false);
    }
  }

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


  function resetPdfImportState() {
    setPdfFile(null);
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
    if (!pdfFile) return;

    const selectedPdfAnalysis = currentPdfAnalysisOption;
    const fileName = pdfFile.name;

    // Créer la tâche optimiste immédiatement
    const optimisticTaskId = addOptimisticTask({
      type: 'import-pdf',
      label: `Import '${fileName}'`,
      metadata: { fileName, analysisLevel: selectedPdfAnalysis.id },
      shouldUpdateCvList: true,
    });

    // Fermer le modal et notifier immédiatement
    addNotification({
      type: "info",
      message: t("pdfImport.notifications.scheduled", { fileName }),
      duration: 2500,
    });
    closePdfImport();

    // Envoyer la requête en arrière-plan
    try {
      const formData = new FormData();
      formData.append("pdfFile", pdfFile);
      formData.append("analysisLevel", selectedPdfAnalysis.id);
      formData.append("model", selectedPdfAnalysis.model);
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

      // Succès : supprimer la tâche optimiste et rafraîchir
      removeOptimisticTask(optimisticTaskId);
      await refreshTasks();
    } catch (error) {
      // Échec : supprimer la tâche optimiste et notifier
      removeOptimisticTask(optimisticTaskId);
      addNotification({
        type: "error",
        message: error?.message || t("pdfImport.notifications.error"),
        duration: 4000,
      });
    }
  }

  async function exportToPdf() {
    if (!currentItem) {
      alert(t("export.noCvSelected"));
      return;
    }

    try {
      const response = await fetch("/api/export-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: currentItem,
          language: language,
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de l'export PDF");
      }

      // Créer un blob à partir de la réponse
      const blob = await response.blob();

      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      const filename = currentItem.file || currentItem.name || currentItem.filename || currentItem;
      a.download = `CV_${filename.replace ? filename.replace(".json", "") : filename}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert(t("export.errors.exportFailed"));
    }
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

    // Save links to history
    if (cleanedLinks.length > 0) {
      addLinksToHistory(cleanedLinks);
    }

    const selectedAnalysis = currentAnalysisOption;

    // Créer la tâche optimiste et préparer la notification
    let optimisticTaskId, notificationMessage, endpoint;

    if (isTemplateCreation) {
      // Mode création de template
      const baseCvName = t("cvGenerator.createTemplateOption");
      optimisticTaskId = addOptimisticTask({
        type: 'create-template-cv',
        label: t("cvGenerator.templateCreationLabel"),
        metadata: {
          analysisLevel: selectedAnalysis.id,
          linksCount: cleanedLinks.length,
          filesCount: (fileSelection || []).length,
        },
        shouldUpdateCvList: true,
      });
      notificationMessage = t("cvGenerator.notifications.templateScheduled");
      endpoint = "/api/background-tasks/create-template-cv";
    } else {
      // Mode adaptation de CV existant
      const baseCvName = generatorBaseItem?.displayTitle || generatorBaseItem?.title || generatorBaseFile;
      optimisticTaskId = addOptimisticTask({
        type: 'generate-cv',
        label: `Adaptation du CV '${baseCvName}'`,
        metadata: {
          baseFile: generatorBaseFile,
          analysisLevel: selectedAnalysis.id,
          linksCount: cleanedLinks.length,
          filesCount: (fileSelection || []).length,
        },
        shouldUpdateCvList: true,
      });
      notificationMessage = t("cvGenerator.notifications.scheduled", { baseCvName });
      endpoint = "/api/background-tasks/generate-cv";
    }

    // Fermer le modal et notifier immédiatement
    addNotification({
      type: "info",
      message: notificationMessage,
      duration: 2500,
    });
    closeGenerator();

    // Envoyer la requête en arrière-plan
    try {
      const formData = new FormData();
      formData.append("links", JSON.stringify(cleanedLinks));

      if (!isTemplateCreation) {
        // Seulement pour l'adaptation de CV
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

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Impossible de mettre la tâche en file.");
      }

      // Succès : supprimer la tâche optimiste et rafraîchir
      removeOptimisticTask(optimisticTaskId);
      await refreshTasks();
    } catch (error) {
      // Échec : supprimer la tâche optimiste et notifier
      removeOptimisticTask(optimisticTaskId);
      addNotification({
        type: "error",
        message: error?.message || t("cvGenerator.notifications.error"),
        duration: 4000,
      });
    }
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
          email: newCvEmail.trim()
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erreur");

      // Set the newly created CV as current
      document.cookie = "cvFile=" + encodeURIComponent(data.file) + "; path=/; max-age=31536000";
      try {
        localStorage.setItem("admin:cv", data.file);
      } catch (_err) {}

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cv:list:changed"));
        window.dispatchEvent(new CustomEvent("cv:selected", { detail: { file: data.file } }));
      }

      // Close modal and reset form
      setOpenNewCv(false);
      setNewCvFullName("");
      setNewCvCurrentTitle("");
      setNewCvEmail("");

      // Reload CV list
      await reload(data.file);

      addNotification({
        type: "success",
        message: t("newCvModal.notifications.success"),
        duration: 3000,
      });

      // Recharger la page pour afficher le nouveau CV
      router.refresh();
    } catch (e) {
      setNewCvError(e?.message || "Erreur");
    }
    setNewCvBusy(false);
  }

  async function handleJobTitleSubmit(event) {
    if (event.key !== 'Enter') return;

    const trimmedJobTitle = jobTitleInput.trim();
    if (!trimmedJobTitle) return;

    // Créer une tâche optimiste
    const optimisticTaskId = addOptimisticTask({
      type: 'job-title-generation',
      label: t("jobTitleGenerator.notifications.scheduled", { jobTitle: trimmedJobTitle }),
      metadata: { jobTitle: trimmedJobTitle },
      shouldUpdateCvList: true,
    });

    // Notifier immédiatement
    addNotification({
      type: "info",
      message: t("jobTitleGenerator.notifications.scheduled", { jobTitle: trimmedJobTitle }),
      duration: 2500,
    });

    // Réinitialiser le champ
    setJobTitleInput("");

    // Envoyer la requête en arrière-plan
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
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Impossible de mettre la tâche en file.");
      }

      // Succès : supprimer la tâche optimiste et rafraîchir
      removeOptimisticTask(optimisticTaskId);
      await refreshTasks();
    } catch (error) {
      // Échec : supprimer la tâche optimiste et notifier
      removeOptimisticTask(optimisticTaskId);
      addNotification({
        type: "error",
        message: error?.message || t("jobTitleGenerator.notifications.error"),
        duration: 4000,
      });
    }
  }

  // Ne rien afficher sur la page de login
  if (pathname === "/auth") {
    return null;
  }

  if (status === "loading") {
    return (
      <div
        className="no-print sticky top-0 inset-x-0 z-[10001] w-full bg-white border-b min-h-[60px]"
        style={{
          position: '-webkit-sticky',
          paddingTop: 'env(safe-area-inset-top)',
          marginTop: 'calc(-1 * env(safe-area-inset-top))',
          transform: isScrollingDown ? 'translateY(-100%)' : 'translateY(0)',
          transition: 'transform 0.15s ease-out',
          willChange: 'transform',
          pointerEvents: 'auto'
        }}
      >
        <div className="w-full p-3 flex items-center justify-between">
          <span className="text-sm font-medium">{t("topbar.loading")}</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Hide TopBar if no CVs exist
  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <div
        ref={barRef}
        className="no-print sticky top-0 inset-x-0 z-[10001] w-full bg-white border-b min-h-[60px]"
        style={{
          position: '-webkit-sticky',
          paddingTop: 'env(safe-area-inset-top)',
          marginTop: 'calc(-1 * env(safe-area-inset-top))',
          transform: isScrollingDown ? 'translateY(-100%)' : 'translateY(0)',
          transition: 'transform 0.15s ease-out',
          willChange: 'transform',
          pointerEvents: 'auto'
        }}
      >
        <div className="w-full p-3 flex flex-wrap items-center gap-x-2 gap-y-2 sm:gap-3">
        {/* User Icon */}
        <div className="relative order-1 md:order-1">
          <button
            ref={userMenuButtonRef}
            type="button"
            onClick={() => setUserMenuOpen((prev) => !prev)}
            className="h-8 w-8 flex items-center justify-center rounded-full border hover:shadow bg-white"
            aria-label={t("topbar.userMenu")}
          >
            <Image
              src="/images/user-icon.png"
              alt={t("topbar.userMenu")}
              width={20}
              height={20}
              className="object-contain"
            />
          </button>
        </div>
        {/* CV Selector */}
        <div className="flex-1 min-w-[120px] md:min-w-[200px] md:max-w-none order-3 md:order-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setListOpen((prev) => !prev);
            }}
            className="w-full min-w-0 rounded border px-3 py-1 text-sm flex items-center justify-between gap-3 hover:shadow overflow-hidden"
            ref={triggerRef}
          >
            <span className="flex items-center gap-3 min-w-0 overflow-hidden">
              {resolvedCurrentItem ? (
                <span
                  key={`icon-${current}-${resolvedCurrentItem.createdBy}-${iconRefreshKey}`}
                  className="flex h-6 w-6 items-center justify-center shrink-0"
                >
                  {getCvIcon(resolvedCurrentItem.createdBy, resolvedCurrentItem.originalCreatedBy, "h-4 w-4") || <DefaultCvIcon className="h-4 w-4" size={16} />}
                </span>
              ) : null}
              <span className="min-w-0">
                {resolvedCurrentItem ? (
                  <ItemLabel
                    item={resolvedCurrentItem}
                    tickerKey={tickerResetKey}
                    withHyphen={false}
                    t={t}
                  />
                ) : (
                  <span className="truncate italic text-neutral-500">
                    {t("topbar.loadingInProgress")}
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
                  zIndex: 10002,
                }}
                className="rounded border bg-white shadow-lg"
              >
                <ul
                  className="max-h-[240px] overflow-y-auto py-1"
                  onScroll={() => {
                    // Set flag when scrolling starts
                    setIsScrollingInDropdown(true);
                  }}
                  onScrollEnd={() => {
                    // Clear flag when scrolling ends (after delay)
                    setTimeout(() => setIsScrollingInDropdown(false), 100);
                  }}
                  onWheel={(e) => {
                    const target = e.currentTarget;
                    const isAtTop = target.scrollTop === 0;
                    const isAtBottom = target.scrollTop + target.clientHeight >= target.scrollHeight;

                    // Prevent page scroll when scrolling inside dropdown
                    if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
                      // Allow propagation only at edges when trying to scroll further
                      return;
                    }
                    e.stopPropagation();
                  }}
                >
                  {items.map((it) => (
                    <li key={it.file}>
                      <button
                        type="button"
                        onClick={async () => {
                          await selectFile(it.file);
                          setListOpen(false);
                        }}
                        className={`w-full px-3 py-1 text-left text-sm flex items-center gap-3 hover:bg-zinc-100 ${it.file === current ? "bg-blue-50 border-l-2 border-blue-500" : ""}`}
                      >
                        <span
                          key={`dropdown-icon-${it.file}-${it.createdBy}`}
                          className="flex h-6 w-6 items-center justify-center shrink-0"
                        >
                          {getCvIcon(it.createdBy, it.originalCreatedBy, "h-4 w-4") || <DefaultCvIcon className="h-4 w-4" size={16} />}
                        </span>
                        <ItemLabel
                          item={it}
                          className="leading-tight"
                          tickerKey={tickerResetKey}
                          withHyphen={false}
                          t={t}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>,
              document.body,
            )
          : null}
        {userMenuOpen && portalReady && userMenuRect
          ? createPortal(
              <div
                ref={userMenuRef}
                style={{
                  position: "fixed",
                  top: userMenuRect.bottom + 8,
                  left: userMenuRect.left,
                  zIndex: 10002,
                }}
                className="rounded-lg border bg-white shadow-lg p-2 text-sm space-y-1 min-w-[10rem] max-w-[16rem]"
              >
                <div className="px-2 py-1 text-xs uppercase text-neutral-500 truncate">
                  {session?.user?.name || t("topbar.user")}
                </div>
                <button
                  className="w-full text-left rounded px-2 py-1 hover:bg-neutral-100"
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/");
                  }}
                >
                  {t("topbar.myCvs")}
                </button>
                <button
                  className="w-full text-left rounded px-2 py-1 hover:bg-neutral-100"
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/account");
                  }}
                >
                  {t("topbar.myAccount")}
                </button>
                <button
                  className="w-full text-left rounded px-2 py-1 hover:bg-neutral-100"
                  onClick={() => {
                    setUserMenuOpen(false);
                    signOut({ callbackUrl: logoutTarget });
                  }}
                >
                  {t("topbar.logout")}
                </button>
              </div>,
              document.body,
            )
          : null}
        {/* Task Manager */}
        <div className="relative order-2 md:order-2">
          <button
            ref={taskQueueButtonRef}
            onClick={() => {
              // On mobile: open modal, on desktop: toggle dropdown
              if (window.innerWidth < 768) {
                setOpenTaskQueue(true);
              } else {
                setOpenTaskDropdown(!openTaskDropdown);
              }
            }}
            className="rounded border text-sm hover:shadow inline-flex items-center justify-center leading-none h-8 w-8"
            type="button"
            title={t("topbar.taskQueue")}
          >
            <QueueIcon className="h-4 w-4" />
          </button>

          {/* Desktop Dropdown */}
          <TaskQueueDropdown
            isOpen={openTaskDropdown}
            onClose={() => setOpenTaskDropdown(false)}
            buttonRef={taskQueueButtonRef}
            className="hidden md:block"
          />
        </div>
        {/* Break line on mobile */}
        <div className="w-full md:hidden order-5"></div>

        {/* Job Title Input - Second Line on mobile, end of first line on desktop */}
        <div className="w-auto flex-1 order-6 md:order-9 md:flex-none flex justify-start md:justify-end px-4 py-1 min-w-0">
          <div className="relative w-full md:w-[400px] flex items-center group job-title-input-wrapper">
            {/* Search icon with pulse animation */}
            <span className="absolute left-0 text-gray-400 text-lg flex items-center justify-center w-6 h-6">
              🔍
            </span>

            {/* Animated underline - removed */}

            {/* Input field */}
            <input
              type="text"
              value={jobTitleInput}
              onChange={(e) => setJobTitleInput(e.target.value)}
              onKeyDown={handleJobTitleSubmit}
              placeholder={isMobile ? t("topbar.jobTitlePlaceholderMobile") : t("topbar.jobTitlePlaceholder")}
              className="w-full bg-transparent border-0 border-b border-gray-300 pl-8 pr-2 py-1 text-sm italic text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-500"
              style={{ caretColor: '#3B82F6' }}
            />

            {/* Sparkle effect - removed */}
          </div>
        </div>

        {/* GPT Button */}
        <button
          onClick={openGeneratorModal}
          className="rounded border text-sm hover:shadow inline-flex items-center justify-center leading-none h-8 w-8 order-8 md:order-4"
          type="button"
        >
          <GptLogo className="h-4 w-4" />
        </button>
        {/* Add Button */}
        <button
          onClick={() => setOpenNewCv(true)}
          className="rounded border text-sm hover:shadow inline-flex items-center justify-center h-8 w-8 order-7 md:order-5"
          type="button"
        >
          ➕
        </button>
        {/* Import Button */}
        <button
          onClick={() => setOpenPdfImport(true)}
          className="rounded border text-sm hover:shadow inline-flex items-center justify-center leading-none h-8 w-8 order-9 md:order-6"
          type="button"
          title={t("pdfImport.title")}
        >
          <img src="/icons/import.png" alt="Import" className="h-4 w-4" />
        </button>
        {/* Export Button */}
        <button
          onClick={exportToPdf}
          className="rounded border text-sm hover:shadow inline-flex items-center justify-center leading-none h-8 w-8 order-10 md:order-7"
          type="button"
          title="Exporter en PDF"
        >
          <img src="/icons/export.png" alt="Export" className="h-4 w-4" />
        </button>
        {/* Delete Button */}
        <button
          onClick={() => setOpenDelete(true)}
          className="rounded border text-sm hover:shadow inline-flex items-center justify-center h-8 w-8 text-red-700 order-4 md:order-8"
          title={t("topbar.delete")}
        >
          ❌
        </button>
      </div>

      <Modal
        open={openGenerator}
        onClose={closeGenerator}
        title={t("cvGenerator.title")}
      >
        <form onSubmit={submitGenerator} className="space-y-4">
          <div className="text-sm text-neutral-700">
            {t("cvGenerator.description")}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">{t("cvGenerator.referenceCV")}</div>
            {/* Toujours afficher le dropdown car on a l'option template */}
            {true ? (
              <div className="relative" ref={baseSelectorRef}>
                <button
                  type="button"
                  onClick={() => setBaseSelectorOpen((prev) => !prev)}
                  className="w-full min-w-0 rounded border px-3 py-1 text-sm flex items-center justify-between gap-3 hover:shadow bg-white"
                >
                  <span className="flex items-center gap-3 min-w-0 overflow-hidden">
                    {generatorBaseFile === CREATE_TEMPLATE_OPTION ? (
                      <>
                        <span className="flex h-6 w-6 items-center justify-center shrink-0">
                          <span className="text-lg">✨</span>
                        </span>
                        <span className="font-medium text-blue-600">
                          {t("cvGenerator.createTemplateOption")}
                        </span>
                      </>
                    ) : generatorBaseItem ? (
                      <>
                        <span
                          key={`gen-base-icon-${generatorBaseFile}-${generatorBaseItem.createdBy}`}
                          className="flex h-6 w-6 items-center justify-center shrink-0"
                        >
                          {getCvIcon(generatorBaseItem.createdBy, generatorBaseItem.originalCreatedBy, "h-4 w-4") || <DefaultCvIcon className="h-4 w-4" size={16} />}
                        </span>
                        <span className="min-w-0">
                          <ItemLabel
                            item={generatorBaseItem}
                            withHyphen={false}
                            tickerKey={tickerResetKey}
                            t={t}
                          />
                        </span>
                      </>
                    ) : (
                      <span className="truncate italic text-neutral-500">
                        {t("cvGenerator.selectCV")}
                      </span>
                    )}
                  </span>
                  <span className="text-xs opacity-60">▾</span>
                </button>
                {baseSelectorOpen ? (
                  <div
                    ref={baseDropdownRef}
                    className="absolute z-10 mt-1 w-full rounded border bg-white shadow-lg max-h-60 overflow-y-auto"
                  >
                    <ul className="py-1">
                      {/* Option spéciale : Créer un nouveau modèle de CV */}
                      <li key={CREATE_TEMPLATE_OPTION}>
                        <button
                          type="button"
                          onClick={() => {
                            setGeneratorBaseFile(CREATE_TEMPLATE_OPTION);
                            setBaseSelectorOpen(false);
                          }}
                          className={`w-full px-3 py-1 text-left text-sm flex items-center gap-3 hover:bg-zinc-100 ${CREATE_TEMPLATE_OPTION === generatorBaseFile ? "bg-zinc-50" : ""}`}
                        >
                          <span className="flex h-6 w-6 items-center justify-center shrink-0">
                            <span className="text-lg">✨</span>
                          </span>
                          <span className="font-medium text-blue-600">
                            {t("cvGenerator.createTemplateOption")}
                          </span>
                        </button>
                      </li>
                      {/* Séparateur */}
                      {generatorSourceItems.length > 0 && (
                        <li className="my-1 border-t border-gray-200"></li>
                      )}
                      {/* CVs existants */}
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
                              key={`gen-dropdown-icon-${item.file}-${item.createdBy}`}
                              className="flex h-6 w-6 items-center justify-center shrink-0"
                            >
                              {getCvIcon(item.createdBy, item.originalCreatedBy, "h-4 w-4") || <DefaultCvIcon className="h-4 w-4" size={16} />}
                            </span>
                            <ItemLabel
                              item={item}
                              className="leading-tight"
                              withHyphen={false}
                              tickerKey={tickerResetKey}
                              t={t}
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
                {t("cvGenerator.noManualCV")}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">{t("cvGenerator.links")}</div>
            {linkInputs.map((value, index) => (
              <div key={index} className="flex gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setLinkHistoryDropdowns(prev => ({
                        ...prev,
                        [index]: !prev[index]
                      }));
                    }}
                    className="h-full rounded border px-2 py-1 text-xs hover:bg-gray-50"
                    title={t("cvGenerator.loadRecentLink")}
                    disabled={linkHistory.length === 0}
                  >
                    📋
                  </button>
                  {linkHistoryDropdowns[index] && linkHistory.length > 0 && (
                    <div className="absolute left-0 top-full mt-1 w-80 max-h-60 overflow-y-auto bg-white border rounded shadow-lg z-10">
                      <div className="p-2 border-b bg-gray-50 text-xs font-medium text-gray-600">
                        {t("cvGenerator.recentLinks")}
                      </div>
                      <ul className="py-1">
                        {linkHistory.map((link, histIndex) => (
                          <li key={histIndex}>
                            <button
                              type="button"
                              onClick={() => {
                                updateLink(link, index);
                                setLinkHistoryDropdowns(prev => ({
                                  ...prev,
                                  [index]: false
                                }));
                              }}
                              className="w-full px-3 py-2 text-left text-xs hover:bg-gray-100 truncate"
                              title={link}
                            >
                              {link}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
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
                  title={t("topbar.delete")}
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addLinkField}
                className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                ➕ {t("cvGenerator.addLink")}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">{t("cvGenerator.files")}</div>
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
                <div className="font-medium">{t("cvGenerator.selection")}</div>
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
                  {t("cvGenerator.clearFiles")}
                </button>
              </div>
            ) : null}
          </div>


          <div className="space-y-2">
            <div className="text-sm font-medium">{t("cvGenerator.analysisQuality")}</div>
            <div className="grid grid-cols-3 gap-1 rounded-lg border bg-neutral-50 p-1 text-xs sm:text-sm">
              {ANALYSIS_OPTIONS(t).map((option) => {
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
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {t("cvGenerator.cancel")}
            </button>
            <button
              type="submit"
              className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!generatorBaseFile}
            >
              {t("cvGenerator.validate")}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={openPdfImport}
        onClose={closePdfImport}
        title={t("pdfImport.title")}
      >
        <form onSubmit={submitPdfImport} className="space-y-4">
          <div className="text-sm text-neutral-700">
            {t("pdfImport.description")}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">{t("pdfImport.pdfFile")}</div>
            <input
              ref={pdfFileInputRef}
              className="w-full rounded border px-2 py-1 text-sm"
              type="file"
              accept=".pdf"
              onChange={onPdfFileChanged}
            />
            {pdfFile ? (
              <div className="rounded border bg-neutral-50 px-3 py-2 text-xs">
                <div className="font-medium">{t("pdfImport.fileSelected")}</div>
                <div className="truncate">{pdfFile.name}</div>
              </div>
            ) : null}
          </div>


          <div className="space-y-2">
            <div className="text-sm font-medium">{t("pdfImport.analysisQuality")}</div>
            <div className="grid grid-cols-3 gap-1 rounded-lg border bg-neutral-50 p-1 text-xs sm:text-sm">
              {ANALYSIS_OPTIONS(t).map((option) => {
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


          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closePdfImport}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {t("pdfImport.cancel")}
            </button>
            <button
              type="submit"
              className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!pdfFile}
            >
              {t("pdfImport.import")}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        title={t("deleteModal.title")}
      >
        <div className="space-y-3">
          <p className="text-sm">
            {t("deleteModal.question")}{" "}
            <strong>{currentItem ? currentItem.displayTitle : current}</strong> ?
          </p>
          <p className="text-xs opacity-70">
            {t("deleteModal.warning")} <strong>{t("deleteModal.irreversible")}</strong>.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOpenDelete(false)}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {t("deleteModal.no")}
            </button>
            <button
              onClick={deleteCurrent}
              className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
            >
              {t("deleteModal.yes")}
            </button>
          </div>
        </div>
      </Modal>

      {/* Mobile Modal */}
      <TaskQueueModal
        open={openTaskQueue}
        onClose={() => setOpenTaskQueue(false)}
      />

      {/* New CV Modal */}
      <Modal
        open={openNewCv}
        onClose={() => {
          setOpenNewCv(false);
          setNewCvFullName("");
          setNewCvCurrentTitle("");
          setNewCvEmail("");
          setNewCvError(null);
        }}
        title={t("newCvModal.title")}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm block mb-1">
              {t("newCvModal.fullName")}<span className="text-red-500" aria-hidden="true"> {t("newCvModal.required")}</span>
            </label>
            <input
              className="w-full rounded border px-3 py-2"
              value={newCvFullName}
              onChange={(e) => setNewCvFullName(e.target.value)}
              placeholder="Ex: Jean Dupont"
              required
            />
          </div>
          <div>
            <label className="text-sm block mb-1">
              {t("newCvModal.currentTitle")}<span className="text-red-500" aria-hidden="true"> {t("newCvModal.required")}</span>
            </label>
            <input
              className="w-full rounded border px-3 py-2"
              value={newCvCurrentTitle}
              onChange={(e) => setNewCvCurrentTitle(e.target.value)}
              placeholder="Ex: Développeur Full-Stack"
              required
            />
          </div>
          <div>
            <label className="text-sm block mb-1">{t("newCvModal.email")}</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={newCvEmail}
              onChange={(e) => setNewCvEmail(e.target.value)}
              placeholder="email@exemple.com"
            />
          </div>
          {newCvError ? (
            <div className="text-sm text-red-600">{String(newCvError)}</div>
          ) : null}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setOpenNewCv(false);
                setNewCvFullName("");
                setNewCvCurrentTitle("");
                setNewCvEmail("");
                setNewCvError(null);
              }}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {t("newCvModal.cancel")}
            </button>
            <button
              onClick={createNewCv}
              disabled={newCvBusy || !newCvFullName.trim() || !newCvCurrentTitle.trim()}
              className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {newCvBusy ? t("newCvModal.creating") : t("newCvModal.create")}
            </button>
          </div>
          <p className="text-xs opacity-70">
            {t("newCvModal.hint")}
          </p>
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

        /* Job title input animations - disabled */

        /* Animated gradient underline */
        .animated-underline {
          animation: gradient-shift 3s ease infinite;
          background-size: 200% 100%;
        }

        @keyframes gradient-shift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        /* Sparkle effect */
        .sparkle-effect {
          animation: sparkle-rotate 2s linear infinite;
        }

        @keyframes sparkle-rotate {
          0%, 100% {
            transform: rotate(0deg) scale(1);
          }
          25% {
            transform: rotate(10deg) scale(1.1);
          }
          50% {
            transform: rotate(0deg) scale(1);
          }
          75% {
            transform: rotate(-10deg) scale(1.1);
          }
        }

        /* Placeholder styling - no animation */
        input[type="text"]::placeholder {
          opacity: 1;
        }

        /* Focus state: stop animations */
        .job-title-input-wrapper:focus-within {
          animation: none;
        }

        .job-title-input-wrapper:focus-within .search-icon-pulse {
          animation: none;
          transform: scale(1.1);
          color: #3B82F6;
        }
      `}</style>
    </>
  );
}
