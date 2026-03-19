'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const BUCKET_COLORS = [
  '#10B981', // emerald
  '#22C55E', // green
  '#84CC16', // lime
  '#EAB308', // yellow
  '#F59E0B', // amber
  '#F97316', // orange
  '#EF4444', // red
  '#DC2626', // red darker
  '#991B1B', // red darkest
];

const CustomTooltip = ({ active, payload, showPercent }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-black/95 backdrop-blur-xl border border-white/20 rounded-lg p-3 shadow-2xl">
        <p className="text-white font-semibold text-sm">{data.label} crédits</p>
        <p className="text-blue-300 text-sm mt-1">
          {showPercent
            ? `${data.percent.toFixed(1)}%`
            : `${data.count} utilisateur${data.count > 1 ? 's' : ''}`
          }
        </p>
      </div>
    );
  }
  return null;
};

export function CreditDistributionChart({ distribution }) {
  const [showPercent, setShowPercent] = useState(false);

  const chartData = useMemo(() => {
    if (!distribution || distribution.length === 0) return [];
    const total = distribution.reduce((sum, d) => sum + d.count, 0);

    if (showPercent) {
      const bucketMap = {};
      distribution.forEach(d => { bucketMap[d.label] = d.count; });
      const grouped = [
        { label: '0', count: bucketMap['0'] || 0 },
        { label: '1-4', count: (bucketMap['1-2'] || 0) + (bucketMap['3-4'] || 0) },
        { label: '5-9', count: (bucketMap['5-7'] || 0) + (bucketMap['8-9'] || 0) },
        { label: '10-14', count: (bucketMap['10-12'] || 0) + (bucketMap['13-14'] || 0) },
        { label: '15', count: bucketMap['15'] || 0 },
        { label: '> 15', count: bucketMap['> 15'] || 0 },
      ];
      return grouped.map(d => ({
        ...d,
        percent: total > 0 ? (d.count / total) * 100 : 0,
      }));
    }

    return distribution.map(d => ({
      ...d,
      percent: total > 0 ? (d.count / total) * 100 : 0,
    }));
  }, [distribution, showPercent]);

  if (!distribution || distribution.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-4 border border-white/20 flex items-center justify-center">
        <span className="text-white/60 text-sm">Aucune donnée</span>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-4 border border-white/20">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-white/60">Crédits / utilisateur</p>
        <button
          onClick={() => setShowPercent(!showPercent)}
          className="flex items-center gap-1.5 text-[10px] text-white/50 hover:text-white/80 transition-colors"
          title={showPercent ? 'Afficher en valeurs absolues' : 'Afficher en pourcentages'}
        >
          <span className={showPercent ? 'text-white/40' : 'text-white/80 font-medium'}>#</span>
          <div className="relative w-7 h-3.5 bg-white/15 rounded-full cursor-pointer">
            <div
              className={`absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                showPercent ? 'left-3.5 bg-blue-400' : 'left-0.5 bg-white/50'
              }`}
            />
          </div>
          <span className={showPercent ? 'text-white/80 font-medium' : 'text-white/40'}>%</span>
        </button>
      </div>
      <ResponsiveContainer width="100%" height={90}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }} barCategoryGap="15%">
          <YAxis
            stroke="rgba(255,255,255,0.4)"
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            domain={[0, 'dataMax']}
            width={30}
            tickFormatter={showPercent ? (v) => `${Math.round(v)}%` : undefined}
          />
          <XAxis
            dataKey="label"
            stroke="rgba(255,255,255,0.4)"
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={30}
          />
          <Tooltip content={<CustomTooltip showPercent={showPercent} />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar dataKey={showPercent ? 'percent' : 'count'} radius={[3, 3, 0, 0]}>
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={BUCKET_COLORS[index] || BUCKET_COLORS[BUCKET_COLORS.length - 1]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
