"use client";
import React from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAdmin } from "@/components/admin/AdminProvider";
import { useBackgroundTasks } from "@/components/providers/BackgroundTasksProvider";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useSettings } from "@/lib/settings/SettingsContext";
import { useLinkHistory } from "@/hooks/useLinkHistory";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useOutsideClick } from "@/hooks/useOutsideClick";
import DefaultCvIcon from "@/components/ui/DefaultCvIcon";
import TaskQueueDropdown from "@/components/task-queue/TaskQueueDropdown";
import { usePipelineProgressContext } from "@/components/providers/PipelineProgressProvider";
import { calculateOfferProgress } from "@/hooks/usePipelineProgress";

// Custom hooks
import { useTopBarState } from "./hooks/useTopBarState";
import { useCvOperations } from "./hooks/useCvOperations";
import { useGeneratorModal } from "./hooks/useGeneratorModal";
import { useScrollBehavior } from "./hooks/useScrollBehavior";
import { useModalStates } from "./hooks/useModalStates";
import { useExportModal } from "./hooks/useExportModal";
import { useSubscriptionData } from "./hooks/useSubscriptionData";
import { useFilterState } from "./hooks/useFilterState";
import { useResponsiveMode } from "./hooks/useResponsiveMode";
import { BREAKPOINTS } from "@/lib/constants/breakpoints";

// Components
import {
  ItemLabel,
  FilterDropdown,
  CvDropdownPortal,
  UserMenuPortal,
  TopBarModals,
  TopBarStyles,
  TopBarActions
} from "./components";

// Utils
import { getCvIcon } from "./utils/cvUtils";
import { ONBOARDING_EVENTS, emitOnboardingEvent } from "@/lib/onboarding/onboardingEvents";
import { LOADING_EVENTS, emitLoadingEvent } from "@/lib/loading/loadingEvents";
import { useCreditCost } from "@/hooks/useCreditCost";

// Date range constants in milliseconds
const DATE_RANGE_MS = {
  '24h': 86400000,
  '7d': 604800000,
  '30d': 2592000000,
};

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
  const { history: linkHistory, addLinksToHistory, deleteLink: deleteLinkHistory, refreshHistory: refreshLinkHistory } = useLinkHistory();
  const { currentStep, onboardingState } = useOnboarding();
  const { showCosts, getCost } = useCreditCost();
  const { getProgress } = usePipelineProgressContext();
  const jobTitleCost = getCost("generate_from_job_title");

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
    setHasLoadedOnce: state.setHasLoadedOnce,
    hadItemsOnceRef: state.hadItemsOnceRef,
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

  // Export modal hook
  const exportModal = useExportModal({
    currentItem: state.currentItem,
    language,
    addNotification,
    t,
  });

  // Subscription data hook
  const { planName, planIcon, creditBalance, creditRatio, creditsOnlyMode, loading: subscriptionLoading } = useSubscriptionData();

  // Refs
  const triggerRef = React.useRef(null);
  const taskQueueButtonRef = React.useRef(null);
  const barRef = React.useRef(null);
  const baseSelectorRef = React.useRef(null);
  const baseDropdownRef = React.useRef(null);
  const dropdownPortalRef = React.useRef(null);
  const userMenuRef = React.useRef(null);
  const userMenuButtonRef = React.useRef(null);
  const filterButtonRef = React.useRef(null);

  // Filter state hook
  const filter = useFilterState();

  // Détection responsive basée sur matchMedia
  const { isMobile } = useResponsiveMode();

  // Filtered items based on active filters
  const filteredItems = React.useMemo(() => {
    if (!filter.hasActiveFilters) return state.items;

    return state.items.filter(item => {
      if (filter.filters.types.length > 0) {
        const itemType = item.createdBy || 'manual';
        if (!filter.filters.types.includes(itemType)) return false;
      }
      if (filter.filters.language !== null) {
        if (!item.language || item.language !== filter.filters.language) return false;
      }
      if (filter.filters.dateRange) {
        const now = Date.now();
        const created = new Date(item.createdAt).getTime();
        if (Number.isNaN(created)) return false;
        if (now - created > DATE_RANGE_MS[filter.filters.dateRange]) return false;
      }
      return true;
    });
  }, [state.items, filter.filters, filter.hasActiveFilters]);

  // Available filter options (progressive filtering)
  const availableFilterOptions = React.useMemo(() => {
    const items = state.items;
    const getItemsMatchingOtherFilters = (excludeFilter) => {
      return items.filter(item => {
        if (excludeFilter !== 'types' && filter.filters.types.length > 0) {
          const itemType = item.createdBy || 'manual';
          if (!filter.filters.types.includes(itemType)) return false;
        }
        if (excludeFilter !== 'language' && filter.filters.language !== null) {
          if (!item.language || item.language !== filter.filters.language) return false;
        }
        if (excludeFilter !== 'dateRange' && filter.filters.dateRange) {
          const now = Date.now();
          const created = new Date(item.createdAt).getTime();
          if (Number.isNaN(created)) return false;
          if (now - created > DATE_RANGE_MS[filter.filters.dateRange]) return false;
        }
        return true;
      });
    };

    const itemsForTypes = getItemsMatchingOtherFilters('types');
    const availableTypes = new Set(itemsForTypes.map(i => i.createdBy || 'manual'));
    const itemsForLanguages = getItemsMatchingOtherFilters('language');
    const availableLanguages = new Set(itemsForLanguages.map(i => i.language).filter(Boolean));
    const itemsForDates = getItemsMatchingOtherFilters('dateRange');
    const now = Date.now();
    const availableDateRanges = new Set();
    itemsForDates.forEach(item => {
      const created = new Date(item.createdAt).getTime();
      if (!Number.isNaN(created)) {
        const age = now - created;
        if (age <= DATE_RANGE_MS['24h']) availableDateRanges.add('24h');
        if (age <= DATE_RANGE_MS['7d']) availableDateRanges.add('7d');
        if (age <= DATE_RANGE_MS['30d']) availableDateRanges.add('30d');
      }
    });

    return { availableTypes, availableLanguages, availableDateRanges };
  }, [state.items, filter.filters]);

  // Active tasks count
  const activeTasksCount = React.useMemo(() => {
    return tasks.filter(t =>
      (t.status === 'running' || t.status === 'queued') &&
      t.type !== 'calculate-match-score'
    ).length;
  }, [tasks]);

  // Global task progress (0-100)
  const globalTaskProgress = React.useMemo(() => {
    const activeTasks = tasks.filter(t =>
      (t.status === 'running' || t.status === 'queued') &&
      t.type !== 'calculate-match-score'
    );
    if (activeTasks.length === 0) return 0;

    let totalProgress = 0;
    activeTasks.forEach(task => {
      if (task.type === 'cv_generation') {
        const sseProgress = getProgress(task.id);
        if (sseProgress?.offers) {
          const offers = Object.values(sseProgress.offers);
          if (offers.length > 0) {
            const avgOfferProgress = offers.reduce((sum, offer) => sum + calculateOfferProgress(offer), 0) / offers.length;
            totalProgress += avgOfferProgress;
          } else {
            totalProgress += 5;
          }
        } else {
          totalProgress += task.status === 'running' ? 10 : 0;
        }
      } else {
        totalProgress += task.status === 'running' ? 50 : 0;
      }
    });

    return Math.round(totalProgress / activeTasks.length);
  }, [tasks, getProgress]);

  // État pour l'onboarding : CV récemment généré
  const [recentlyGeneratedCv, setRecentlyGeneratedCv] = React.useState(null);

  // Scroll behavior hook
  useScrollBehavior({
    lastScrollY: state.lastScrollY,
    setIsScrollingDown: state.setIsScrollingDown,
    setLastScrollY: state.setLastScrollY,
    listOpen: modals.listOpen,
    triggerRef,
    setDropdownRect: modals.setDropdownRect,
  });

  // ===== CRITICAL useEffect for initial render =====

  React.useEffect(() => {
    state.setPortalReady(true);
  }, []);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    operations.reload();
  }, [isAuthenticated, pathname, searchParams?.toString()]);

  React.useEffect(() => {
    if (pathname === "/auth") return;
    if (!isAuthenticated || state.items.length === 0) return;

    const timer = setTimeout(() => {
      emitLoadingEvent(LOADING_EVENTS.TOPBAR_READY, {
        hasButtons: true,
        itemsCount: state.items.length,
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [isAuthenticated, state.items.length, pathname]);

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
  }, [isAuthenticated]);

  React.useEffect(() => {
    const handleOpenImport = () => modals.setOpenPdfImport(true);
    window.addEventListener("cv:open-import", handleOpenImport);
    return () => window.removeEventListener("cv:open-import", handleOpenImport);
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    const handleCvGenerated = (event) => {
      if (!isMounted) return;
      const cvFilename = event.detail?.cvFilename;
      if (cvFilename) setRecentlyGeneratedCv(cvFilename);
    };
    window.addEventListener(ONBOARDING_EVENTS.CV_GENERATED, handleCvGenerated);
    return () => {
      isMounted = false;
      window.removeEventListener(ONBOARDING_EVENTS.CV_GENERATED, handleCvGenerated);
    };
  }, []);

  React.useEffect(() => {
    const handleCvSelected = (event) => {
      if (event.detail?.source === 'task-queue') {
        state.setCvSelectorGlow(true);
        setTimeout(() => state.setCvSelectorGlow(false), 800);
      }
    };
    window.addEventListener("cv:selected", handleCvSelected);
    return () => window.removeEventListener("cv:selected", handleCvSelected);
  }, []);

  React.useEffect(() => {
    state.setIsMobile(isMobile);
  }, [isMobile]);

  React.useEffect(() => {
    if (modals.listOpen && triggerRef.current) {
      modals.setDropdownRect(triggerRef.current.getBoundingClientRect());
    }
  }, [modals.listOpen, state.items, state.current]);

  React.useEffect(() => {
    if (modals.userMenuOpen && userMenuButtonRef.current) {
      modals.setUserMenuRect(userMenuButtonRef.current.getBoundingClientRect());
    }
  }, [modals.userMenuOpen]);

  // Outside click handlers
  useOutsideClick({
    isOpen: modals.userMenuOpen,
    onClose: () => modals.setUserMenuOpen(false),
    refs: [userMenuButtonRef, userMenuRef],
  });

  useOutsideClick({
    isOpen: modals.listOpen,
    onClose: () => modals.setListOpen(false),
    refs: [triggerRef, dropdownPortalRef],
    shouldSkip: () => state.isScrollingInDropdown,
  });

  useOutsideClick({
    isOpen: generator.baseSelectorOpen,
    onClose: () => generator.setBaseSelectorOpen(false),
    refs: [baseSelectorRef, baseDropdownRef],
  });

  useOutsideClick({
    isOpen: Object.values(generator.linkHistoryDropdowns).some(Boolean),
    onClose: () => generator.setLinkHistoryDropdowns({}),
    dataAttribute: 'link-history-dropdown',
  });

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") state.setTickerResetKey(Date.now());
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined" || !barRef.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) state.setTickerResetKey(Date.now());
      });
    }, { threshold: 0.6 });
    observer.observe(barRef.current);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const handleResize = () => modals.setOpenTaskDropdown(false);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Don't render on auth page
  if (pathname === "/auth") return null;

  // Loading state
  if (status === "loading") {
    return (
      <div
        className="no-print fixed top-0 left-0 right-0 z-[10001] w-full bg-white/15 backdrop-blur-md ios-optimized-blur border-b border-white/20 min-h-[60px]"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
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

  if (!isAuthenticated) return null;

  // No CVs
  if (state.items.length === 0) {
    if (state.hasLoadedOnce) return null;
    if (!state.hadItemsOnceRef.current) return null;

    return (
      <div
        ref={barRef}
        className="no-print fixed top-0 left-0 right-0 z-[10001] w-full bg-white/15 backdrop-blur-md ios-optimized-blur border-b border-white/20 min-h-[60px]"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
          WebkitTransform: 'translate3d(0, 0, 0)',
          transform: 'translate3d(0, 0, 0)',
          pointerEvents: 'auto'
        }}
      >
        <div className="w-full p-3 flex items-center justify-between">
          <span className="text-sm font-medium text-white/60 animate-pulse drop-shadow-lg">
            {t("topbar.loading")}
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={barRef}
        className="no-print fixed top-0 left-0 right-0 z-[10001] w-full bg-white/15 backdrop-blur-md ios-optimized-blur border-b border-white/20 min-h-[60px]"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
          WebkitTransform: 'translate3d(0, 0, 0)',
          transform: 'translate3d(0, 0, 0)',
          pointerEvents: 'auto'
        }}
      >
        <div className="w-full p-3 flex flex-wrap md:flex-nowrap items-center gap-x-2 gap-y-2 sm:gap-3">
          {/* User Icon */}
          <div className="relative order-1 md:order-1">
            <button
              ref={userMenuButtonRef}
              type="button"
              onClick={() => modals.setUserMenuOpen((prev) => !prev)}
              className="h-8 w-8 flex items-center justify-center rounded-full border border-white/40 bg-white/20 backdrop-blur-sm hover:bg-white/30 hover:shadow-sm-xl transition-all duration-200"
              aria-label={t("topbar.userMenu")}
            >
              <img src="/icons/user.png" alt={t("topbar.userMenu")} className="h-5 w-5" />
            </button>
          </div>

          {/* CV Selector */}
          <div className="flex-1 min-w-[120px] md:min-w-[200px] md:max-w-none order-3 md:order-3">
            <button
              data-onboarding="cv-selector"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                modals.setListOpen((prev) => !prev);
              }}
              className={`cv-selector-trigger w-full min-w-0 rounded-lg border backdrop-blur-sm px-3 py-1 text-sm flex items-center justify-between gap-3 overflow-hidden transition-all duration-500 text-white ${
                state.cvSelectorGlow
                  ? 'border-emerald-400 bg-emerald-500/40 shadow-[0_0_20px_rgba(52,211,153,0.6)] hover:bg-emerald-500/50'
                  : 'border-white/40 bg-white/20 hover:bg-white/30 hover:shadow-sm-xl'
              }`}
              ref={triggerRef}
            >
              <span className="flex items-center gap-3 min-w-0 overflow-hidden">
                {state.resolvedCurrentItem ? (
                  <span
                    key={`icon-${state.current}-${state.resolvedCurrentItem.createdBy}-${state.iconRefreshKey}`}
                    className="flex h-6 w-6 items-center justify-center shrink-0"
                  >
                    {getCvIcon(state.resolvedCurrentItem.createdBy, state.resolvedCurrentItem.originalCreatedBy, "h-4 w-4", state.resolvedCurrentItem.isTranslated) || <DefaultCvIcon className="h-4 w-4" size={16} />}
                  </span>
                ) : null}
                <span className="min-w-0">
                  {state.resolvedCurrentItem ? (
                    <ItemLabel item={state.resolvedCurrentItem} tickerKey={state.tickerResetKey} withHyphen={false} t={t} />
                  ) : (
                    <span className="truncate italic text-neutral-500">{t("topbar.loadingInProgress")}</span>
                  )}
                </span>
              </span>
              <span className="text-xs opacity-60">▾</span>
            </button>
          </div>

          {/* Task Manager */}
          <div className="relative order-2 md:order-2">
            <button
              data-onboarding="task-manager"
              ref={taskQueueButtonRef}
              onClick={() => {
                if (window.innerWidth < BREAKPOINTS.TASK_QUEUE_DROPDOWN) {
                  modals.setOpenTaskQueue(true);
                } else {
                  modals.setOpenTaskDropdown(!modals.openTaskDropdown);
                }
              }}
              className={`rounded-lg border border-white/40 backdrop-blur-sm text-white text-sm hover:shadow-sm-xl inline-flex items-center justify-center leading-none h-8 w-8 transition-all duration-200 ${activeTasksCount > 0 ? 'task-progress-button' : 'bg-white/20 hover:bg-white/30'}`}
              style={activeTasksCount > 0 ? { '--task-progress': `${globalTaskProgress}%` } : undefined}
              type="button"
              title={t("topbar.taskQueue")}
            >
              <img src="/icons/task.png" alt={t("topbar.taskQueue")} className="h-4 w-4" />
            </button>

            <TaskQueueDropdown
              isOpen={modals.openTaskDropdown}
              onClose={() => modals.setOpenTaskDropdown(false)}
              buttonRef={taskQueueButtonRef}
              className="hidden md:block"
            />
          </div>

          {/* Filter Button */}
          <div className="relative order-4 md:order-4">
            <button
              ref={filterButtonRef}
              type="button"
              onClick={() => filter.setFilterMenuOpen(!filter.filterMenuOpen)}
              className={`rounded-lg border backdrop-blur-sm text-white text-sm hover:bg-white/30 hover:shadow-sm-xl inline-flex items-center justify-center leading-none h-8 w-8 transition-all duration-200 ${
                filter.hasActiveFilters ? 'border-emerald-400 bg-emerald-500/30' : 'border-white/40 bg-white/20'
              }`}
              title={t("topbar.filter")}
            >
              <img src="/icons/filter.svg" alt={t("topbar.filter")} className="h-4 w-4" />
              {filter.hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 text-[10px] text-gray-900 font-bold flex items-center justify-center">
                  {filter.activeFilterCount}
                </span>
              )}
            </button>

            <FilterDropdown
              isOpen={filter.filterMenuOpen}
              onClose={() => filter.setFilterMenuOpen(false)}
              buttonRef={filterButtonRef}
              filters={filter.filters}
              toggleType={filter.toggleType}
              setLanguage={filter.setLanguage}
              setDateRange={filter.setDateRange}
              clearAllFilters={filter.clearAllFilters}
              hasActiveFilters={filter.hasActiveFilters}
              availableOptions={availableFilterOptions}
              t={t}
            />
          </div>

          {/* Break line */}
          <div className="w-full md:hidden order-6"></div>

          {/* Job Title Input */}
          {settings.feature_search_bar && (
            <div className="flex-1 order-7 md:order-10 lg:flex-none flex justify-start lg:justify-end px-2 md:px-4 py-1 min-w-0">
              <div className="relative w-full md:max-w-[280px] lg:max-w-[400px] flex items-center group job-title-input-wrapper">
                <span className="absolute left-0 text-white/70 drop-shadow flex items-center justify-center w-6 h-6">
                  <img src="/icons/search.png" alt="Search" className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={modals.jobTitleInput}
                  onChange={(e) => modals.setJobTitleInput(e.target.value)}
                  onKeyDown={(e) => modals.handleJobTitleSubmit(e, language, showCosts, jobTitleCost)}
                  placeholder={state.isMobile ? t("topbar.jobTitlePlaceholderMobile") : t("topbar.jobTitlePlaceholder")}
                  className="w-full bg-transparent border-0 border-b-2 pl-8 pr-2 py-1 text-sm italic text-white placeholder-white/50 focus:outline-hidden transition-colors duration-200 border-white/30 focus:border-emerald-400 cursor-text"
                  style={{ caretColor: '#10b981' }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <TopBarActions
            settings={settings}
            generator={generator}
            modals={modals}
            exportModal={exportModal}
            creditsOnlyMode={creditsOnlyMode}
            subscriptionLoading={subscriptionLoading}
            creditBalance={creditBalance}
            creditRatio={creditRatio}
            t={t}
          />
        </div>
      </div>

      {/* CV Dropdown Portal */}
      <CvDropdownPortal
        listOpen={modals.listOpen}
        portalReady={state.portalReady}
        dropdownRect={modals.dropdownRect}
        dropdownPortalRef={dropdownPortalRef}
        filteredItems={filteredItems}
        hasActiveFilters={filter.hasActiveFilters}
        current={state.current}
        currentStep={currentStep}
        onboardingState={onboardingState}
        recentlyGeneratedCv={recentlyGeneratedCv}
        setRecentlyGeneratedCv={setRecentlyGeneratedCv}
        tickerResetKey={state.tickerResetKey}
        isScrollingInDropdown={state.isScrollingInDropdown}
        setIsScrollingInDropdown={state.setIsScrollingInDropdown}
        selectFile={operations.selectFile}
        setListOpen={modals.setListOpen}
        t={t}
      />

      {/* User Menu Portal */}
      <UserMenuPortal
        userMenuOpen={modals.userMenuOpen}
        portalReady={state.portalReady}
        userMenuRect={modals.userMenuRect}
        userMenuRef={userMenuRef}
        session={session}
        creditsOnlyMode={creditsOnlyMode}
        subscriptionLoading={subscriptionLoading}
        planName={planName}
        planIcon={planIcon}
        creditBalance={creditBalance}
        logoutTarget={state.logoutTarget}
        setUserMenuOpen={modals.setUserMenuOpen}
        router={router}
        t={t}
      />

      {/* Modals */}
      <TopBarModals
        generator={generator}
        modals={modals}
        exportModal={exportModal}
        operations={operations}
        state={state}
        linkHistory={linkHistory}
        deleteLinkHistory={deleteLinkHistory}
        refreshLinkHistory={refreshLinkHistory}
        baseSelectorRef={baseSelectorRef}
        baseDropdownRef={baseDropdownRef}
        t={t}
      />

      {/* Styles */}
      <TopBarStyles />
    </>
  );
}
