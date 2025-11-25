'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

/**
 * Composant de visualisation de la répartition des statuts d'onboarding
 * Affiche un Donut Chart montrant les pourcentages de chaque statut
 */
export function OnboardingStatusChart({ data, isInitialLoad = true }) {
  if (!data) {
    return (
      <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Répartition des Statuts</h3>
        <div className="text-white/60 text-center py-12">Aucune donnée disponible</div>
      </div>
    );
  }

  // Préparer les données pour le chart
  const chartData = [
    { name: 'Complété', value: data.completed || 0, color: '#10B981' },
    { name: 'En cours', value: data.inProgress || 0, color: '#3B82F6' },
    { name: 'Abandonné', value: data.skipped || 0, color: '#F59E0B' },
    { name: 'Bloqué', value: data.stuckCount || 0, color: '#EF4444' },
    { name: 'Non démarré', value: data.notStarted || 0, color: '#6B7280' },
  ].filter(d => d.value > 0);

  // Si toutes les valeurs sont à 0, afficher un message
  if (chartData.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Répartition des Statuts</h3>
        <div className="text-white/60 text-center py-12">Aucun utilisateur dans cette période</div>
      </div>
    );
  }

  // Calcul du total pour les pourcentages
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Répartition des Statuts</h3>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            isAnimationActive={isInitialLoad}
            animationDuration={800}
            label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip total={total} />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            content={<CustomLegend data={chartData} total={total} />}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Statistique centrale */}
      <div className="text-center -mt-4">
        <span className="text-white/60 text-sm">Total : {total} utilisateur{total > 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

/**
 * Tooltip personnalisé
 */
function CustomTooltip({ active, payload, total }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const percent = ((data.value / total) * 100).toFixed(1);

    return (
      <div className="bg-gray-900/95 border border-white/20 rounded-lg p-4 shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: data.color }}
          />
          <span className="text-white font-medium">{data.name}</span>
        </div>
        <div className="space-y-1 text-sm">
          <p className="text-white/80">
            <span className="text-white/60">Nombre :</span> {data.value} utilisateur{data.value > 1 ? 's' : ''}
          </p>
          <p className="text-white/80">
            <span className="text-white/60">Part :</span> {percent}%
          </p>
        </div>
      </div>
    );
  }
  return null;
}

/**
 * Légende personnalisée
 */
function CustomLegend({ data, total }) {
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-2">
      {data.map((item, index) => {
        const percent = ((item.value / total) * 100).toFixed(0);
        return (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-white/80 text-sm">
              {item.name} ({percent}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}
