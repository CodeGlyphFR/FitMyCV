'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * KPI Card component for displaying key metrics
 */
export function KPICard({ title, label, value, subtitle, icon, trend, description }) {
  const displayTitle = title || label; // Support both title and label props
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipRect, setTooltipRect] = useState(null);
  const [portalReady, setPortalReady] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (showTooltip && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setTooltipRect(rect);
    }
  }, [showTooltip]);

  return (
    <>
      <div
        ref={cardRef}
        className="relative bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20 hover:bg-white/15 transition-all"
        onMouseEnter={() => description && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white/60">{displayTitle}</p>
          <p className="text-3xl font-bold text-white mt-2">{value}</p>
          {subtitle && (
            <p className="text-sm text-white/50 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="text-4xl opacity-30">{icon}</div>
        )}
      </div>
      {trend && (
        <div className={`text-sm mt-4 ${trend.positive ? 'text-green-400' : 'text-red-400'}`}>
          {trend.value}
        </div>
      )}

      </div>

      {/* Custom Tooltip */}
      {description && showTooltip && portalReady && tooltipRect && createPortal(
        <div
          style={{
            position: 'fixed',
            top: tooltipRect.bottom + 8,
            left: tooltipRect.left + tooltipRect.width / 2,
            transform: 'translateX(-50%)',
            zIndex: 10004,
          }}
          className="pointer-events-none"
        >
          {/* Arrow */}
          <div className="absolute left-1/2 transform -translate-x-1/2 -top-2">
            <div className="w-3 h-3 bg-gray-900 border-l border-t border-white/30 transform rotate-45"></div>
          </div>
          <div className="bg-gray-900 border border-white/30 rounded-lg px-4 py-3 shadow-2xl w-64">
            <div className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5 flex-shrink-0">ℹ️</span>
              <p className="text-sm text-white/90 leading-relaxed whitespace-normal">{description}</p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
