"use client";
import React from "react";
import { createPortal } from "react-dom";
import { signOut, useSession } from "next-auth/react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAdmin } from "@/components/admin/AdminProvider";
import { useBackgroundTasks } from "@/components/BackgroundTasksProvider";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useSettings } from "@/lib/settings/SettingsContext";
import { useLinkHistory } from "@/hooks/useLinkHistory";
import GptLogo from "@/components/ui/GptLogo";
import DefaultCvIcon from "@/components/ui/DefaultCvIcon";
import TokenCounter from "@/components/ui/TokenCounter";
import TaskQueueModal from "@/components/TaskQueueModal";
import TaskQueueDropdown from "@/components/TaskQueueDropdown";

// Custom hooks
import { useTopBarState } from "./hooks/useTopBarState";
import { useCvOperations } from "./hooks/useCvOperations";
import { useGeneratorModal } from "./hooks/useGeneratorModal";
import { useScrollBehavior } from "./hooks/useScrollBehavior";
import { useModalStates } from "./hooks/useModalStates";

// Components
import ItemLabel from "./components/ItemLabel";
import CvGeneratorModal from "./modals/CvGeneratorModal";
import PdfImportModal from "./modals/PdfImportModal";
import DeleteCvModal from "./modals/DeleteCvModal";
import NewCvModal from "./modals/NewCvModal";

// Utils
import { getCvIcon } from "./utils/cvUtils";
import { CREATE_TEMPLATE_OPTION } from "./utils/constants";

export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setCurrentFile } = useAdmin();
  const { data: session, status } = useSession();
  const isAuthenticated = !!session?.user?.id;
  const { tasks, localDeviceId, refreshTasks, addOptimisticTask, removeOptimisticTask } = useBackgroundTasks();
  const { addNotification } = useNotifications();
  const { t, language } = useLanguage();
  const { settings } = useSettings();
  const { history: linkHistory, addLinksToHistory } = useLinkHistory();

  // Main state hook
  const state = useTopBarState(language);

  // CV operations hook
  const operations = useCvOperations({
    isAuthenticated,
    setCurrentFile,
    items: state.items,
    current: state.current,
    titleCacheRef: state.titleCacheRef,
    lastSelectedRef: state.lastSelectedRef,
    lastSelectedMetaRef: state.lastSelectedMetaRef,
    setRawItems: state.setRawItems,
    setCurrent: state.setCurrent,
    setIconRefreshKey: state.setIconRefreshKey,
    currentItem: state.currentItem,
    language,
    t,
  });

  // Modal states hook
  const modals = useModalStates({
    t,
    addOptimisticTask,
    removeOptimisticTask,
    refreshTasks,
    addNotification,
    localDeviceId,
    reload: operations.reload,
    router,
  });

  // Generator modal hook
  const generator = useGeneratorModal({
    items: state.items,
    currentItem: state.currentItem,
    lastSelectedMetaRef: state.lastSelectedMetaRef,
    current: state.current,
    addOptimisticTask,
    removeOptimisticTask,
    refreshTasks,
    addNotification,
    localDeviceId,
    t,
    addLinksToHistory,
  });

  // Refs
  const triggerRef = React.useRef(null);
  const taskQueueButtonRef = React.useRef(null);
  const barRef = React.useRef(null);
  const baseSelectorRef = React.useRef(null);
  const baseDropdownRef = React.useRef(null);
  const dropdownPortalRef = React.useRef(null);
  const userMenuRef = React.useRef(null);
  const userMenuButtonRef = React.useRef(null);

  // Active tasks count
  const activeTasksCount = React.useMemo(() => {
    return tasks.filter(t => t.status === 'running' || t.status === 'queued').length;
  }, [tasks]);

  // Token state for search bar
  const [userRefreshCount, setUserRefreshCount] = React.useState(5);
  const [canUseSearchBar, setCanUseSearchBar] = React.useState(true);
  const [isLoadingTokens, setIsLoadingTokens] = React.useState(false);

  // Fetch user tokens
  const fetchUserTokens = React.useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoadingTokens(true);
    try {
      const response = await fetch('/api/user/rate-limit', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        console.error('[TopBar] Failed to fetch tokens');
        setIsLoadingTokens(false);
        return;
      }

      const data = await response.json();
      setUserRefreshCount(data.refreshCount || 0);
      setCanUseSearchBar(data.canRefresh ?? true);
      setIsLoadingTokens(false);
    } catch (error) {
      console.error('[TopBar] Error fetching tokens:', error);
      setIsLoadingTokens(false);
    }
  }, [isAuthenticated]);

  // Scroll behavior hook
  useScrollBehavior({
    lastScrollY: state.lastScrollY,
    setIsScrollingDown: state.setIsScrollingDown,
    setLastScrollY: state.setLastScrollY,
    listOpen: modals.listOpen,
    triggerRef,
    setDropdownRect: modals.setDropdownRect,
  });

  // Portal ready
  React.useEffect(() => {
    state.setPortalReady(true);
  }, [state]);

  // Logout target
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        state.setLogoutTarget(
          `${window.location.origin.replace(/\/$/, "")}/auth?mode=login`
        );
      } catch (_err) {}
    }
  }, [state]);

  // Reload CV list
  React.useEffect(() => {
    if (!isAuthenticated) return;
    operations.reload();
  }, [isAuthenticated, pathname, searchParams?.toString(), operations.reload]);

  // Listen for CV list changes
  React.useEffect(() => {
    if (!isAuthenticated) return undefined;
    const onChanged = () => operations.reload();
    window.addEventListener("cv:list:changed", onChanged);
    window.addEventListener("realtime:cv:list:changed", onChanged);
    window.addEventListener("focus", onChanged);
    return () => {
      window.removeEventListener("cv:list:changed", onChanged);
      window.removeEventListener("realtime:cv:list:changed", onChanged);
      window.removeEventListener("focus", onChanged);
    };
  }, [isAuthenticated, operations.reload]);

  // Listen for import event
  React.useEffect(() => {
    const handleOpenImport = () => {
      modals.setOpenPdfImport(true);
    };
    window.addEventListener("cv:open-import", handleOpenImport);
    return () => window.removeEventListener("cv:open-import", handleOpenImport);
  }, [modals]);

  // CV selector glow animation
  React.useEffect(() => {
    const handleCvSelected = (event) => {
      if (event.detail?.source === 'task-queue') {
        state.setCvSelectorGlow(true);
        setTimeout(() => {
          state.setCvSelectorGlow(false);
        }, 800);
      }
    };
    window.addEventListener("cv:selected", handleCvSelected);
    return () => {
      window.removeEventListener("cv:selected", handleCvSelected);
    };
  }, [state]);

  // Detect mobile
  React.useEffect(() => {
    const checkMobile = () => {
      state.setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [state]);

  // Dropdown position updates
  React.useEffect(() => {
    if (modals.listOpen && triggerRef.current) {
      modals.setDropdownRect(triggerRef.current.getBoundingClientRect());
    }
  }, [modals.listOpen, state.items, state.current, modals]);

  React.useEffect(() => {
    if (modals.userMenuOpen && userMenuButtonRef.current) {
      modals.setUserMenuRect(userMenuButtonRef.current.getBoundingClientRect());
    }
  }, [modals.userMenuOpen, modals]);

  // User menu outside click handler
  React.useEffect(() => {
    let touchHandled = false;
    let touchTimeout = null;

    function handleClick(event) {
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
      modals.setUserMenuOpen(false);
    }

    function handleKey(event) {
      if (event.key === "Escape") modals.setUserMenuOpen(false);
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
  }, [modals]);

  // CV dropdown outside click handler
  React.useEffect(() => {
    let touchHandled = false;
    let touchTimeout = null;

    function handleClick(event) {
      if (!modals.listOpen) return;
      if (state.isScrollingInDropdown) return;

      if (event.type === 'touchstart') {
        touchHandled = true;
        if (touchTimeout) clearTimeout(touchTimeout);
        touchTimeout = setTimeout(() => {
          touchHandled = false;
        }, 500);
      } else if (event.type === 'mousedown' && touchHandled) {
        return;
      }

      const triggerEl = triggerRef.current;
      const dropdownEl = dropdownPortalRef.current;

      if (!triggerEl) return;
      if (triggerEl.contains(event.target)) return;
      if (dropdownEl && dropdownEl.contains(event.target)) return;

      modals.setListOpen(false);
    }

    function handleKey(event) {
      if (event.key === "Escape" && modals.listOpen) {
        modals.setListOpen(false);
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
  }, [modals.listOpen, state.isScrollingInDropdown, modals, state]);

  // Base selector outside click handler
  React.useEffect(() => {
    if (!generator.baseSelectorOpen) return undefined;
    let touchHandled = false;
    let touchTimeout = null;

    function handleClick(event) {
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
      generator.setBaseSelectorOpen(false);
    }

    function handleKey(event) {
      if (event.key === "Escape") generator.setBaseSelectorOpen(false);
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
  }, [generator.baseSelectorOpen, generator]);

  // Ticker reset on visibility change
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        state.setTickerResetKey(Date.now());
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [state]);

  // Ticker reset on intersection
  React.useEffect(() => {
    if (typeof window === "undefined" || !barRef.current || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          state.setTickerResetKey(Date.now());
        }
      });
    }, { threshold: 0.6 });
    observer.observe(barRef.current);
    return () => observer.disconnect();
  }, [state]);

  // Close dropdown on resize
  React.useEffect(() => {
    const handleResize = () => {
      modals.setOpenTaskDropdown(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [modals]);

  // Fetch tokens on mount
  React.useEffect(() => {
    fetchUserTokens();
  }, [fetchUserTokens]);

  // Listen for token updates
  React.useEffect(() => {
    const handleTokensUpdated = () => {
      fetchUserTokens();
    };
    window.addEventListener('tokens:updated', handleTokensUpdated);
    return () => window.removeEventListener('tokens:updated', handleTokensUpdated);
  }, [fetchUserTokens]);

  // Listen for optimistic token decrement
  React.useEffect(() => {
    const handleOptimisticDecrement = () => {
      setUserRefreshCount(prev => Math.max(0, prev - 1));
    };
    window.addEventListener('tokens:optimistic-decrement', handleOptimisticDecrement);
    return () => window.removeEventListener('tokens:optimistic-decrement', handleOptimisticDecrement);
  }, []);

  // Listen for realtime task updates (which affect token count)
  React.useEffect(() => {
    const handleRealtimeTaskUpdate = () => {
      fetchUserTokens();
    };
    const handleRealtimeCvUpdate = () => {
      fetchUserTokens();
    };
    const handleRealtimeCvMetadataUpdate = () => {
      fetchUserTokens();
    };

    window.addEventListener('realtime:task:updated', handleRealtimeTaskUpdate);
    window.addEventListener('realtime:cv:updated', handleRealtimeCvUpdate);
    window.addEventListener('realtime:cv:metadata:updated', handleRealtimeCvMetadataUpdate);

    return () => {
      window.removeEventListener('realtime:task:updated', handleRealtimeTaskUpdate);
      window.removeEventListener('realtime:cv:updated', handleRealtimeCvUpdate);
      window.removeEventListener('realtime:cv:metadata:updated', handleRealtimeCvMetadataUpdate);
    };
  }, [fetchUserTokens]);

  // Polling de backup pour les tokens (toutes les 10 secondes)
  React.useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      fetchUserTokens().catch(err => {
        console.error('[TopBar] Error polling tokens:', err);
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [isAuthenticated, fetchUserTokens]);

  // Rafraîchir les tokens quand la fenêtre redevient active
  React.useEffect(() => {
    if (!isAuthenticated) return;

    const handleFocus = () => {
      fetchUserTokens();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isAuthenticated, fetchUserTokens]);

  // Don't render on auth page
  if (pathname === "/auth") {
    return null;
  }

  // Loading state
  if (status === "loading") {
    return (
      <div
        className="no-print sticky top-0 inset-x-0 z-[10001] w-full bg-white/15 backdrop-blur-xl border-b border-white/20 min-h-[60px]"
        style={{
          position: '-webkit-sticky',
          paddingTop: 'env(safe-area-inset-top)',
          marginTop: 'calc(-1 * env(safe-area-inset-top))',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
          WebkitPerspective: 1000,
          perspective: 1000,
          WebkitTransform: 'translate3d(0, 0, 0)',
          transform: 'translate3d(0, 0, 0)',
          pointerEvents: 'auto'
        }}
      >
        <div className="w-full p-3 flex items-center justify-between">
          <span className="text-sm font-medium text-white drop-shadow-lg">{t("topbar.loading")}</span>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // No CVs
  if (state.items.length === 0) {
    return null;
  }

  return (
    <>
      <div
        ref={barRef}
        className="no-print sticky top-0 inset-x-0 z-[10001] w-full bg-white/15 backdrop-blur-xl border-b border-white/20 min-h-[60px]"
        style={{
          position: '-webkit-sticky',
          paddingTop: 'env(safe-area-inset-top)',
          marginTop: 'calc(-1 * env(safe-area-inset-top))',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
          WebkitPerspective: 1000,
          perspective: 1000,
          WebkitTransform: 'translate3d(0, 0, 0)',
          transform: 'translate3d(0, 0, 0)',
          pointerEvents: 'auto'
        }}
      >
        <div className="w-full p-3 flex flex-wrap items-center gap-x-2 gap-y-2 sm:gap-3">
          {/* User Icon */}
          <div className="relative order-1 md:order-1">
            <button
              ref={userMenuButtonRef}
              type="button"
              onClick={() => modals.setUserMenuOpen((prev) => !prev)}
              className="h-8 w-8 flex items-center justify-center rounded-full border border-white/40 bg-white/20 backdrop-blur-sm hover:bg-white/30 hover:shadow-xl transition-all duration-200"
              aria-label={t("topbar.userMenu")}
            >
              <img
                src="/icons/user.png"
                alt={t("topbar.userMenu")}
                className="h-5 w-5"
              />
            </button>
          </div>

          {/* CV Selector */}
          <div className="flex-1 min-w-[120px] md:min-w-[200px] md:max-w-none order-3 md:order-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                modals.setListOpen((prev) => !prev);
              }}
              className={`cv-selector-trigger w-full min-w-0 rounded-lg border backdrop-blur-sm px-3 py-1 text-sm flex items-center justify-between gap-3 overflow-hidden transition-all duration-500 text-white ${
                state.cvSelectorGlow
                  ? 'border-emerald-400 bg-emerald-500/40 shadow-[0_0_20px_rgba(52,211,153,0.6)] hover:bg-emerald-500/50'
                  : 'border-white/40 bg-white/20 hover:bg-white/30 hover:shadow-xl'
              }`}
              ref={triggerRef}
            >
              <span className="flex items-center gap-3 min-w-0 overflow-hidden">
                {state.resolvedCurrentItem ? (
                  <span
                    key={`icon-${state.current}-${state.resolvedCurrentItem.createdBy}-${state.iconRefreshKey}`}
                    className="flex h-6 w-6 items-center justify-center shrink-0"
                  >
                    {getCvIcon(state.resolvedCurrentItem.createdBy, state.resolvedCurrentItem.originalCreatedBy, "h-4 w-4") || <DefaultCvIcon className="h-4 w-4" size={16} />}
                  </span>
                ) : null}
                <span className="min-w-0">
                  {state.resolvedCurrentItem ? (
                    <ItemLabel
                      item={state.resolvedCurrentItem}
                      tickerKey={state.tickerResetKey}
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

          {/* CV Dropdown Portal */}
          {modals.listOpen && state.portalReady && modals.dropdownRect
            ? createPortal(
                <>
                  <div className="fixed inset-0 z-[10001] bg-transparent cv-dropdown-no-animation" onClick={() => modals.setListOpen(false)} />
                  <div
                    ref={dropdownPortalRef}
                    style={{
                      position: "fixed",
                      top: modals.dropdownRect.bottom + 4,
                      left: modals.dropdownRect.left,
                      width: modals.dropdownRect.width,
                      zIndex: 10002,
                      opacity: 1,
                    }}
                    className="rounded-lg border border-white/30 bg-white/15 backdrop-blur-xl shadow-2xl cv-dropdown-no-animation"
                  >
                    <ul
                      className="max-h-[240px] overflow-y-auto py-1"
                      onScroll={() => {
                        state.setIsScrollingInDropdown(true);
                      }}
                      onScrollEnd={() => {
                        setTimeout(() => state.setIsScrollingInDropdown(false), 100);
                      }}
                      onWheel={(e) => {
                        const target = e.currentTarget;
                        const isAtTop = target.scrollTop === 0;
                        const isAtBottom = target.scrollTop + target.clientHeight >= target.scrollHeight;

                        if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
                          return;
                        }
                        e.stopPropagation();
                      }}
                    >
                      {state.items.map((it) => (
                        <li key={it.file}>
                          <button
                            type="button"
                            onClick={async () => {
                              await operations.selectFile(it.file);
                              modals.setListOpen(false);
                            }}
                            className={`w-full px-3 py-1 text-left text-sm flex items-center gap-3 hover:bg-white/25 text-white transition-colors duration-200 ${it.file === state.current ? "bg-white/20 border-l-2 border-emerald-400" : ""}`}
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
                              tickerKey={state.tickerResetKey}
                              withHyphen={false}
                              t={t}
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>,
                document.body,
              )
            : null}

          {/* User Menu Portal */}
          {modals.userMenuOpen && state.portalReady && modals.userMenuRect
            ? createPortal(
                <>
                  <div className="fixed inset-0 z-[10001] backdrop-blur-sm bg-transparent" onClick={() => modals.setUserMenuOpen(false)} />
                  <div
                    ref={userMenuRef}
                    style={{
                      position: "fixed",
                      top: modals.userMenuRect.bottom + 8,
                      left: modals.userMenuRect.left,
                      zIndex: 10002,
                    }}
                    className="rounded-lg border border-white/30 bg-white/15 backdrop-blur-xl shadow-2xl p-2 text-sm space-y-1 min-w-[10rem] max-w-[16rem]"
                  >
                    <div className="px-2 py-1 text-xs uppercase text-white/70 drop-shadow truncate">
                      {session?.user?.name || t("topbar.user")}
                    </div>
                    <button
                      className="w-full text-left rounded px-2 py-1 hover:bg-white/25 text-white transition-colors duration-200"
                      onClick={() => {
                        modals.setUserMenuOpen(false);
                        router.push("/");
                      }}
                    >
                      {t("topbar.myCvs")}
                    </button>
                    <button
                      className="w-full text-left rounded px-2 py-1 hover:bg-white/25 text-white transition-colors duration-200"
                      onClick={() => {
                        modals.setUserMenuOpen(false);
                        router.push("/account");
                      }}
                    >
                      {t("topbar.myAccount")}
                    </button>
                    <button
                      className="w-full text-left rounded px-2 py-1 hover:bg-white/25 text-white transition-colors duration-200"
                      onClick={() => {
                        modals.setUserMenuOpen(false);
                        signOut({ callbackUrl: state.logoutTarget });
                      }}
                    >
                      {t("topbar.logout")}
                    </button>
                  </div>
                </>,
                document.body,
              )
            : null}

          {/* Task Manager */}
          <div className="relative order-2 md:order-2">
            <button
              ref={taskQueueButtonRef}
              onClick={() => {
                if (window.innerWidth < 768) {
                  modals.setOpenTaskQueue(true);
                } else {
                  modals.setOpenTaskDropdown(!modals.openTaskDropdown);
                }
              }}
              className="rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm text-white text-sm hover:bg-white/30 hover:shadow-xl inline-flex items-center justify-center leading-none h-8 w-8 transition-all duration-200"
              type="button"
              title={t("topbar.taskQueue")}
            >
              <img src="/icons/task.png" alt={t("topbar.taskQueue")} className="h-4 w-4 " />
              {activeTasksCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-300 border-2 border-white flex items-center justify-center text-gray-900 text-[10px] font-bold drop-shadow-lg animate-pulse"
                >
                  {activeTasksCount}
                </span>
              )}
            </button>

            <TaskQueueDropdown
              isOpen={modals.openTaskDropdown}
              onClose={() => modals.setOpenTaskDropdown(false)}
              buttonRef={taskQueueButtonRef}
              className="hidden md:block"
            />
          </div>

          {/* Break line on mobile */}
          <div className="w-full md:hidden order-5"></div>

          {/* Job Title Input */}
          {settings.feature_search_bar && (
            <div className="w-auto flex-1 order-6 md:order-9 md:flex-none flex justify-start md:justify-end px-4 py-1 min-w-0">
              <div className="relative w-full md:w-[400px] flex items-center group job-title-input-wrapper">
                {/* Token Counter - haut droite de la search bar */}
                <div className="absolute -right-2 -top-2 z-10">
                  <TokenCounter refreshCount={userRefreshCount} isLoading={isLoadingTokens} />
                </div>

                <span className="absolute left-0 text-white/70 drop-shadow flex items-center justify-center w-6 h-6">
                  <img src="/icons/search.png" alt="Search" className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={modals.jobTitleInput}
                  onChange={(e) => modals.setJobTitleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (!canUseSearchBar) {
                      e.preventDefault();
                      return;
                    }
                    modals.handleJobTitleSubmit(e, language);
                  }}
                  placeholder={state.isMobile ? t("topbar.jobTitlePlaceholderMobile") : t("topbar.jobTitlePlaceholder")}
                  disabled={!canUseSearchBar}
                  className={`w-full bg-transparent border-0 border-b-2 pl-8 pr-2 py-1 text-sm italic text-white placeholder-white/50 focus:outline-none transition-colors duration-200 ${
                    canUseSearchBar
                      ? 'border-white/30 focus:border-emerald-400 cursor-text'
                      : 'border-white/10 cursor-not-allowed opacity-50'
                  }`}
                  style={{ caretColor: '#10b981' }}
                  title={!canUseSearchBar ? "Plus de tokens disponibles" : ""}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {settings.feature_ai_generation && (
            <button
              onClick={generator.openGeneratorModal}
              className="rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm text-white text-sm hover:bg-white/30 hover:shadow-xl inline-flex items-center justify-center leading-none h-8 w-8 order-8 md:order-4 transition-all duration-200"
              type="button"
            >
              <GptLogo className="h-4 w-4" />
            </button>
          )}
          {settings.feature_manual_cv && (
            <button
              onClick={() => modals.setOpenNewCv(true)}
              className="rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm text-white text-sm hover:bg-white/30 hover:shadow-xl inline-flex items-center justify-center h-8 w-8 order-7 md:order-5 transition-all duration-200"
              type="button"
            >
              <img src="/icons/add.png" alt="Add" className="h-4 w-4 " />
            </button>
          )}
          {settings.feature_import && (
            <button
              onClick={() => modals.setOpenPdfImport(true)}
              className="rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm text-white text-sm hover:bg-white/30 hover:shadow-xl inline-flex items-center justify-center leading-none h-8 w-8 order-9 md:order-6 transition-all duration-200"
              type="button"
              title={t("pdfImport.title")}
            >
              <img src="/icons/import.png" alt="Import" className="h-4 w-4 " />
            </button>
          )}
          {settings.feature_export && (
            <button
              onClick={operations.exportToPdf}
              className="rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm text-white text-sm hover:bg-white/30 hover:shadow-xl inline-flex items-center justify-center leading-none h-8 w-8 order-10 md:order-7 transition-all duration-200"
              type="button"
              title="Exporter en PDF"
            >
              <img src="/icons/export.png" alt="Export" className="h-4 w-4 " />
            </button>
          )}
          <button
            onClick={() => modals.setOpenDelete(true)}
            className="rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm text-white text-sm hover:bg-white/30 hover:shadow-xl inline-flex items-center justify-center h-8 w-8 order-4 md:order-8 transition-all duration-200"
            title={t("topbar.delete")}
          >
            <img src="/icons/delete.png" alt="Delete" className="h-4 w-4 " />
          </button>
        </div>
      </div>

      {/* Modals */}
      <CvGeneratorModal
        open={generator.openGenerator}
        onClose={generator.closeGenerator}
        onSubmit={generator.submitGenerator}
        linkInputs={generator.linkInputs}
        updateLink={generator.updateLink}
        addLinkField={generator.addLinkField}
        removeLinkField={generator.removeLinkField}
        fileSelection={generator.fileSelection}
        onFilesChanged={generator.onFilesChanged}
        clearFiles={generator.clearFiles}
        fileInputRef={generator.fileInputRef}
        generatorBaseFile={generator.generatorBaseFile}
        setGeneratorBaseFile={generator.setGeneratorBaseFile}
        baseSelectorOpen={generator.baseSelectorOpen}
        setBaseSelectorOpen={generator.setBaseSelectorOpen}
        generatorSourceItems={generator.generatorSourceItems}
        generatorBaseItem={generator.generatorBaseItem}
        analysisLevel={generator.analysisLevel}
        setAnalysisLevel={generator.setAnalysisLevel}
        currentAnalysisOption={generator.currentAnalysisOption}
        generatorError={generator.generatorError}
        linkHistory={linkHistory}
        linkHistoryDropdowns={generator.linkHistoryDropdowns}
        setLinkHistoryDropdowns={generator.setLinkHistoryDropdowns}
        tickerResetKey={state.tickerResetKey}
        t={t}
        baseSelectorRef={baseSelectorRef}
        baseDropdownRef={baseDropdownRef}
      />

      <PdfImportModal
        open={modals.openPdfImport}
        onClose={modals.closePdfImport}
        onSubmit={modals.submitPdfImport}
        pdfFile={modals.pdfFile}
        onPdfFileChanged={modals.onPdfFileChanged}
        pdfFileInputRef={modals.pdfFileInputRef}
        pdfAnalysisLevel={modals.pdfAnalysisLevel}
        setPdfAnalysisLevel={modals.setPdfAnalysisLevel}
        currentPdfAnalysisOption={modals.currentPdfAnalysisOption}
        t={t}
      />

      <DeleteCvModal
        open={modals.openDelete}
        onClose={() => modals.setOpenDelete(false)}
        onConfirm={() => {
          operations.deleteCurrent();
          modals.setOpenDelete(false);
        }}
        currentItem={state.currentItem}
        current={state.current}
        t={t}
      />

      <NewCvModal
        open={modals.openNewCv}
        onClose={() => modals.setOpenNewCv(false)}
        onCreate={modals.createNewCv}
        fullName={modals.newCvFullName}
        setFullName={modals.setNewCvFullName}
        currentTitle={modals.newCvCurrentTitle}
        setCurrentTitle={modals.setNewCvCurrentTitle}
        email={modals.newCvEmail}
        setEmail={modals.setNewCvEmail}
        error={modals.newCvError}
        setError={modals.setNewCvError}
        busy={modals.newCvBusy}
        t={t}
      />

      <TaskQueueModal
        open={modals.openTaskQueue}
        onClose={() => modals.setOpenTaskQueue(false)}
      />

      {/* Styles */}
      <style jsx global>{`
        .cv-selector-trigger:active {
          opacity: 1 !important;
          transform: none !important;
        }

        .cv-dropdown-no-animation {
          animation: none !important;
          transition: none !important;
          transform: none !important;
          will-change: auto !important;
        }

        .cv-ticker {
          max-width: 100%;
          position: relative;
          display: block;
          overflow: hidden;
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

        .cv-ticker--active .cv-ticker__inner {
          animation: cv-ticker-scroll var(--cv-ticker-duration) linear infinite;
        }

        @keyframes cv-ticker-scroll {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(var(--cv-ticker-shift), 0, 0);
          }
        }

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

        input[type="text"]::placeholder {
          opacity: 1;
        }

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
