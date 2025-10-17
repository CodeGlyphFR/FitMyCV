import React from "react";
import { getAnalysisLevelLabel } from "@/lib/i18n/cvLabels";

const useIsomorphicLayoutEffect = typeof window !== "undefined"
  ? React.useLayoutEffect
  : React.useEffect;

/**
 * Composant d'affichage d'un label de CV avec animation ticker pour mobile
 */
const ItemLabel = React.memo(function ItemLabel({
  item,
  className = "",
  withHyphen = true,
  tickerKey = 0,
  t
}) {
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
            setScrollActive(true);
          }
          return;
        }

        inner.style.setProperty("--cv-ticker-shift", `${-totalWidth}px`);
        inner.style.setProperty("--cv-ticker-duration", `${duration}s`);
        if (!scrollActiveRef.current) {
          clearScheduledToggle();
          setScrollActive(true);
        } else {
          clearScheduledToggle();
        }
      }, 10); // 10ms debounce - réduit pour un démarrage plus rapide
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
      <span className="flex-shrink-0 text-xs sm:text-sm opacity-60 whitespace-nowrap">
        {prefix}
      </span>
      {withHyphen ? (
        <span className="flex-shrink-0 opacity-30 text-xs sm:text-sm" aria-hidden="true">
          –
        </span>
      ) : null}
      <span
        ref={containerRef}
        className={`cv-ticker ${titleClass} ${scrollActive ? "cv-ticker--active" : ""}`}
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

export default ItemLabel;
