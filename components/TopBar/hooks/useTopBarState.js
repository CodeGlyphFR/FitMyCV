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

  // Scroll behavior
  const [isScrollingDown, setIsScrollingDown] = React.useState(false);
  const [lastScrollY, setLastScrollY] = React.useState(0);
  const [isScrollingInDropdown, setIsScrollingInDropdown] = React.useState(false);

  // Animation triggers
  const [tickerResetKey, setTickerResetKey] = React.useState(() => Date.now());
  const [iconRefreshKey, setIconRefreshKey] = React.useState(() => Date.now());

  // Logout URL
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

    // Derived
    currentItem,
    resolvedCurrentItem,
  };
}
