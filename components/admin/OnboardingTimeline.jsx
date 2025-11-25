'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

/**
 * Composant affichant l'activité onboarding sur les 14 derniers jours
 * 3 lignes: Démarrés, Complétés, Abandonnés
 */
export function OnboardingTimeline({ data, isInitialLoad = true }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Activité (14 derniers jours)</h3>
        <div className="text-white/60 text-center py-12">Aucune donnée disponible</div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Activité (14 derniers jours)</h3>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="date"
            stroke="rgba(255,255,255,0.6)"
            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
          />
          <YAxis
            stroke="rgba(255,255,255,0.6)"
            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => <span className="text-white/80">{value}</span>}
          />
          <Line
            type="monotone"
            dataKey="started"
            name="Démarrés"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={{ r: 4, fill: '#3B82F6' }}
            activeDot={{ r: 6 }}
            isAnimationActive={isInitialLoad}
            animationDuration={800}
          />
          <Line
            type="monotone"
            dataKey="completed"
            name="Complétés"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ r: 4, fill: '#10B981' }}
            activeDot={{ r: 6 }}
            isAnimationActive={isInitialLoad}
            animationDuration={800}
          />
          <Line
            type="monotone"
            dataKey="skipped"
            name="Abandonnés"
            stroke="#F59E0B"
            strokeWidth={2}
            dot={{ r: 4, fill: '#F59E0B' }}
            activeDot={{ r: 6 }}
            isAnimationActive={isInitialLoad}
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Tooltip personnalisé
 */
function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900/95 border border-white/20 rounded-lg p-4 shadow-xl">
        <p className="text-white font-medium mb-2">{label}</p>
        <div className="space-y-1 text-sm">
          {payload.map((entry, index) => (
            <p key={index} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              ></span>
              <span className="text-white/60">{entry.name} :</span>
              <span className="text-white">{entry.value}</span>
            </p>
          ))}
        </div>
      </div>
    );
  }
  return null;
}
