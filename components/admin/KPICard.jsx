'use client';

/**
 * KPI Card component for displaying key metrics
 */
export function KPICard({ title, value, subtitle, icon, trend }) {
  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20 hover:bg-white/15 transition-all">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white/60">{title}</p>
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
  );
}
