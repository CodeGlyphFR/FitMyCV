'use client';

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

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-black/95 backdrop-blur-xl border border-white/20 rounded-lg p-3 shadow-2xl">
        <p className="text-white font-semibold text-sm">{data.label} crédits</p>
        <p className="text-blue-300 text-sm mt-1">
          {data.count} utilisateur{data.count > 1 ? 's' : ''}
        </p>
      </div>
    );
  }
  return null;
};

export function CreditDistributionChart({ distribution }) {
  if (!distribution || distribution.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-4 border border-white/20 flex items-center justify-center">
        <span className="text-white/60 text-sm">Aucune donnée</span>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-4 border border-white/20">
      <p className="text-xs text-white/60 mb-2">Crédits / utilisateur</p>
      <ResponsiveContainer width="100%" height={90}>
        <BarChart data={distribution} margin={{ top: 5, right: 5, left: -15, bottom: 0 }} barCategoryGap="15%">
          <YAxis
            stroke="rgba(255,255,255,0.4)"
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            domain={[0, 'dataMax']}
            width={30}
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
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {distribution.map((_, index) => (
              <Cell key={`cell-${index}`} fill={BUCKET_COLORS[index] || BUCKET_COLORS[BUCKET_COLORS.length - 1]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
