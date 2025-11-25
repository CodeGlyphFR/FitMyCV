'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

/**
 * Composant affichant les taux de drop-off entre chaque étape
 * Couleurs: vert (<10%), jaune (10-20%), rouge (>20%)
 */
export function OnboardingDropoffChart({ data, isInitialLoad = true }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Taux d'abandon par transition</h3>
        <div className="text-white/60 text-center py-12">Aucune donnée disponible</div>
      </div>
    );
  }

  // Préparer les données avec les couleurs
  const chartData = data.map(item => ({
    ...item,
    label: `${item.from}→${item.to}`,
    fill: getDropoffColor(item.dropoffRate),
  }));

  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Taux d'abandon par transition</h3>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="label"
            stroke="rgba(255,255,255,0.6)"
            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11, angle: -45, textAnchor: 'end' }}
            height={60}
          />
          <YAxis
            stroke="rgba(255,255,255,0.6)"
            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
            domain={[0, 'dataMax + 5']}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="dropoffRate"
            isAnimationActive={isInitialLoad}
            animationDuration={800}
            radius={[4, 4, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Légende */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-emerald-500"></div>
          <span className="text-white/60">Bon (&lt;10%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-amber-500"></div>
          <span className="text-white/60">Attention (10-20%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-rose-500"></div>
          <span className="text-white/60">Critique (&gt;20%)</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Détermine la couleur selon le taux de drop-off
 */
function getDropoffColor(rate) {
  if (rate < 10) return '#10B981'; // Emerald-500 (bon)
  if (rate < 20) return '#F59E0B'; // Amber-500 (attention)
  return '#F43F5E'; // Rose-500 (critique)
}

/**
 * Tooltip personnalisé
 */
function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const color = getDropoffColor(data.dropoffRate);

    return (
      <div className="bg-gray-900/95 border border-white/20 rounded-lg p-4 shadow-xl">
        <p className="text-white font-medium mb-2">
          {data.fromName} → {data.toName}
        </p>
        <div className="space-y-1 text-sm">
          <p className="text-white/80">
            <span className="text-white/60">Taux d'abandon :</span>{' '}
            <span style={{ color }}>{data.dropoffRate}%</span>
          </p>
          <p className="text-white/80">
            <span className="text-white/60">Utilisateurs perdus :</span> {data.dropoffCount}
          </p>
        </div>
      </div>
    );
  }
  return null;
}
