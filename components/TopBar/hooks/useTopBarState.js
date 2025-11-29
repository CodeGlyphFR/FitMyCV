import React from "react";
import { formatDateLabel } from "../utils/cvUtils";

/**
 * Hook centralisé pour gérer le state principal de la TopBar
 */
export function useTopBarState(language) {
  // CV list and current selection
  const [rawItems, setRawItems] = React.useState([]);
  const [current, setCurrent] = React.useState("");

  // Recalculate displayDate when language changes
  const items = React.useMemo(() => {
    return rawItems.map((it) => {
      const formattedDate = formatDateLabel(it.createdAt, language)
        || formatDateLabel(it.updatedAt, language);
      const displayDate = formattedDate || it.dateLabel || "??/??/????";
      return { ...it, displayDate };
    });
  }, [rawItems, language]);

  // UI state
  const [portalReady, setPortalReady] = React.useState(false);
  const [cvSelectorGlow, setCvSelectorGlow] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  // Flag pour savoir si le premier chargement est terminé
  // Permet de distinguer "en cours de chargement" vs "vraiment aucun CV"
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false);

  // Ref pour tracker si on a déjà eu des CV (pour afficher skeleton uniquement lors de race conditions)
  const hadItemsOnceRef = React.useRef(false);

  // Scroll behavior
  const [isScrollingDown, setIsScrollingDown] = React.useState(false);
  const [lastScrollY, setLastScrollY] = React.useState(0);
  const [isScrollingInDropdown, setIsScrollingInDropdown] = React.useState(false);

  // Animation triggers - Initialized with 0 to avoid hydration mismatch, updated in useEffect
  const [tickerResetKey, setTickerResetKey] = React.useState(0);
  const [iconRefreshKey, setIconRefreshKey] = React.useState(0);

  // Logout URL - Default value to avoid hydration mismatch, updated in useEffect
  const [logoutTarget, setLogoutTarget] = React.useState("/auth?mode=login");

  // Update client-only values after mount to avoid hydration mismatch
  React.useEffect(() => {
    // Update animation keys with current timestamp
    setTickerResetKey(Date.now());
    setIconRefreshKey(Date.now());

    // Update logout target with window.location if available
    if (typeof window !== "undefined" && window.location?.origin) {
      setLogoutTarget(`${window.location.origin.replace(/\/$/, "")}/auth?mode=login`);
    } else if (process.env.NEXT_PUBLIC_SITE_URL) {
      setLogoutTarget(`${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/auth?mode=login`);
    }
  }, []);

  // Refs
  const titleCacheRef = React.useRef(new Map());
  const lastSelectedRef = React.useRef(null);
  const lastSelectedMetaRef = React.useRef(null);
  const isScrollingDownRef = React.useRef(false);

  // Derived state
  const currentItem = React.useMemo(
    () => items.find((it) => it.file === current),
    [items, current]
  );

  const resolvedCurrentItem = React.useMemo(() => {
    if (currentItem) return currentItem;

    const cachedRef = lastSelectedMetaRef.current;
    if (cachedRef && current === cachedRef.file && items.some(it => it.file === cachedRef.file)) {
      const freshItem = items.find(it => it.file === cachedRef.file);
      if (freshItem) {
        lastSelectedMetaRef.current = freshItem;
        return freshItem;
      }
    }

    return null;
  }, [currentItem, current, items]);

  return {
    // State
    rawItems,
    setRawItems,
    items,
    current,
    setCurrent,
    portalReady,
    setPortalReady,
    cvSelectorGlow,
    setCvSelectorGlow,
    isMobile,
    setIsMobile,
    hasLoadedOnce,
    setHasLoadedOnce,
    isScrollingDown,
    setIsScrollingDown,
    lastScrollY,
    setLastScrollY,
    isScrollingInDropdown,
    setIsScrollingInDropdown,
    tickerResetKey,
    setTickerResetKey,
    iconRefreshKey,
    setIconRefreshKey,
    logoutTarget,
    setLogoutTarget,

    // Refs
    titleCacheRef,
    lastSelectedRef,
    lastSelectedMetaRef,
    isScrollingDownRef,
    hadItemsOnceRef,

    // Derived
    currentItem,
    resolvedCurrentItem,
  };
}
