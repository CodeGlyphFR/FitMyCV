'use client';

import { useState } from 'react';

/**
 * KPI Card component for displaying key metrics
 */
export function KPICard({ title, label, value, subtitle, icon, trend, description }) {
  const displayTitle = title || label; // Support both title and label props
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
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

      {/* Custom Tooltip */}
      {description && showTooltip && (
        <div className="absolute z-50 -top-2 left-1/2 transform -translate-x-1/2 -translate-y-full mb-2 pointer-events-none">
          <div className="bg-gray-900/98 backdrop-blur-xl border border-white/30 rounded-lg px-4 py-3 shadow-2xl max-w-xs">
            <div className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">ℹ️</span>
              <p className="text-sm text-white/90 leading-relaxed">{description}</p>
            </div>
          </div>
          {/* Arrow */}
          <div className="absolute left-1/2 transform -translate-x-1/2 top-full">
            <div className="w-3 h-3 bg-gray-900/98 border-r border-b border-white/30 transform rotate-45 -mt-1.5"></div>
          </div>
        </div>
      )}
    </div>
  );
}
