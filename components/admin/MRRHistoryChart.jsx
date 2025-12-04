'use client';

// Options de période disponibles
const PERIODS = [
  { value: '12months', label: '12 mois' },
  { value: '6months', label: '6 mois' },
  { value: 'month', label: 'Ce mois' },
  { value: 'week', label: 'Cette semaine' }
];

// Options de métrique
const METRICS = [
  { value: 'mrr', label: 'MRR' },
  { value: 'arr', label: 'ARR' }
];

/**
 * Graphique d'évolution MRR/ARR avec sélecteurs de période, année et métrique
 * Affichage en ligne SVG avec ordonnée partant de 0
 */
export function MRRHistoryChart({
  history,
  period = '12months',
  year,
  metric = 'mrr',
  availableYears = [],
  onPeriodChange,
  onYearChange,
  onMetricChange
}) {
  // Convertir "janv. 2024" → "Jan 24"
  const formatShortMonth = (monthStr) => {
    const parts = monthStr.split(' ');
    if (parts.length === 2) {
      const month = parts[0].slice(0, 3);
      const yr = parts[1].slice(-2);
      return `${month.charAt(0).toUpperCase() + month.slice(1)} ${yr}`;
    }
    return monthStr;
  };

  // Obtenir le label selon le type de données (mois ou label générique)
  const getLabel = (item) => {
    if (item.month) return formatShortMonth(item.month);
    return item.label || '';
  };

  // Obtenir la valeur selon la métrique sélectionnée (préserve null)
  const getValue = (item) => {
    const val = item[metric];
    return val === null || val === undefined ? null : val;
  };

  /**
   * Arrondit au niveau supérieur selon l'ordre de grandeur
   * 23 → 30, 122 → 130, 1243 → 1300, 12548 → 13000
   */
  const roundUpToNiceNumber = (value) => {
    if (value <= 0) return 10;
    if (value < 10) return 10;

    // Trouver l'ordre de grandeur (10, 100, 1000, etc.)
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    // Le step est magnitude/10 mais minimum 10
    const step = Math.max(10, magnitude / 10);

    return Math.ceil(value / step) * step;
  };

  // Rendu des contrôles (même si pas de données)
  const renderControls = () => (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {/* Toggle MRR/ARR */}
      <div className="flex gap-1">
        {METRICS.map(m => (
          <button
            key={m.value}
            onClick={() => onMetricChange?.(m.value)}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              metric === m.value
                ? 'bg-sky-500/30 text-sky-400 border border-sky-500/50'
                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Sélecteur année + période */}
      <div className="flex items-center gap-2">
        {/* Année (visible seulement pour 12m et 6m) */}
        {(period === '12months' || period === '6months') && availableYears.length > 0 && (
          <select
            value={year}
            onChange={(e) => onYearChange?.(parseInt(e.target.value))}
            className="px-2 py-1 text-xs bg-white/10 border border-white/20 rounded-md text-white/80 focus:outline-none focus:border-emerald-500/50"
          >
            {availableYears.map(y => (
              <option key={y} value={y} className="bg-slate-800 text-white">{y}</option>
            ))}
          </select>
        )}

        {/* Périodes */}
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => onPeriodChange?.(p.value)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                period === p.value
                  ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/50'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Si pas de données
  if (!history || history.length === 0) {
    return (
      <div className="space-y-4">
        {renderControls()}
        <div className="text-center py-8 text-white/60">
          Aucune donnée d'historique disponible
        </div>
      </div>
    );
  }

  // Calculer min/max pour la métrique sélectionnée (en ignorant les null)
  const values = history.map(h => getValue(h)).filter(v => v !== null && v !== undefined);
  const rawMaxValue = values.length > 0 ? Math.max(...values) : 0;
  // Ajouter 10% de marge puis arrondir pour que le max ne touche pas le haut
  const maxValue = roundUpToNiceNumber(rawMaxValue * 1.1);
  const minValue = values.length > 0 ? Math.min(...values) : 0;

  // Trouver la dernière valeur non-null pour "Actuel" (compatible ES5+)
  let lastValidIndex = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    const val = getValue(history[i]);
    if (val !== null && val !== undefined) {
      lastValidIndex = i;
      break;
    }
  }
  const currentValue = lastValidIndex >= 0 ? getValue(history[lastValidIndex]) : 0;

  // Points valides pour le graphique
  const validPoints = history
    .map((item, index) => ({ value: getValue(item), index, label: getLabel(item) }))
    .filter(p => p.value !== null);

  // Générer le path SVG pour la ligne
  const generateLinePath = () => {
    if (validPoints.length < 1) return '';

    return validPoints.map((point, i) => {
      const x = history.length > 1
        ? (point.index / (history.length - 1)) * 100
        : 50;
      const y = maxValue > 0
        ? 100 - (point.value / maxValue) * 100
        : 0;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  // Générer le path SVG pour la zone remplie
  const generateAreaPath = () => {
    const linePath = generateLinePath();
    if (!linePath || validPoints.length < 1) return '';

    const firstX = history.length > 1
      ? (validPoints[0].index / (history.length - 1)) * 100
      : 50;
    const lastX = history.length > 1
      ? (validPoints[validPoints.length - 1].index / (history.length - 1)) * 100
      : 50;

    return `${linePath} L ${lastX} 100 L ${firstX} 100 Z`;
  };

  // Couleurs selon la métrique
  const lineColor = metric === 'mrr' ? '#10B981' : '#8B5CF6';
  const areaColor = metric === 'mrr' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(139, 92, 246, 0.15)';

  // Valeurs pour l'axe Y (5 niveaux : 0, 25%, 50%, 75%, 100%)
  const yAxisValues = [100, 75, 50, 25, 0].map(pct => ({
    pct,
    value: (maxValue * pct) / 100
  }));

  return (
    <div className="space-y-4">
      {/* Contrôles */}
      {renderControls()}

      {/* Zone du graphique */}
      <div className="relative" style={{ height: '240px' }}>
        {/* Axe Y avec valeurs */}
        <div className="absolute left-0 top-0 bottom-6 w-14 flex flex-col justify-between">
          {yAxisValues.map(({ pct, value }) => (
            <div key={pct} className="text-[10px] text-white/40 text-right pr-2">
              {value.toFixed(0)}€
            </div>
          ))}
        </div>

        {/* Grille horizontale */}
        <div className="absolute left-14 right-0 top-0 bottom-6 flex flex-col justify-between pointer-events-none">
          {yAxisValues.map(({ pct }) => (
            <div key={pct} className="border-t border-white/10" />
          ))}
        </div>

        {/* Graphique SVG */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute left-14 right-0 top-0 bottom-6"
          style={{ width: 'calc(100% - 56px)', height: 'calc(100% - 24px)' }}
        >
          {/* Zone remplie sous la courbe */}
          <path
            d={generateAreaPath()}
            fill={areaColor}
          />

          {/* Ligne principale */}
          <path
            d={generateLinePath()}
            fill="none"
            stroke={lineColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Points avec valeurs - divs CSS pour éviter la déformation du SVG */}
        <div className="absolute left-14 right-0 top-0 bottom-6" style={{ pointerEvents: 'none' }}>
          {validPoints.map((point, i) => {
            const xPercent = history.length > 1
              ? (point.index / (history.length - 1)) * 100
              : 50;
            const yPercent = maxValue > 0
              ? (1 - point.value / maxValue) * 100
              : 100;
            const isLast = i === validPoints.length - 1;
            const isFirst = i === 0;

            return (
              <div
                key={point.index}
                className="absolute"
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                {/* Valeur au-dessus du point */}
                <div
                  className={`absolute bottom-full mb-1 text-[9px] whitespace-nowrap
                              ${metric === 'mrr' ? 'text-emerald-400' : 'text-purple-400'}
                              ${isLast ? 'right-0' : isFirst ? 'left-0' : 'left-1/2 -translate-x-1/2'}`}
                >
                  {point.value.toFixed(0)}€
                </div>

                {/* Point */}
                <div
                  className={`rounded-full ${
                    isLast
                      ? (metric === 'mrr' ? 'bg-emerald-500' : 'bg-purple-500')
                      : `bg-slate-900 border ${metric === 'mrr' ? 'border-emerald-500' : 'border-purple-500'}`
                  }`}
                  style={{
                    width: isLast ? '8px' : '5px',
                    height: isLast ? '8px' : '5px',
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Labels en bas (axe X) - positionnés absolument comme les points */}
        <div className="absolute left-14 right-0 bottom-0 h-6">
          {history.map((item, index) => {
            const value = getValue(item);
            const isNull = value === null;
            // Afficher moins de labels si trop nombreux
            const shouldShow = history.length <= 12 || index % 2 === 0 || index === history.length - 1;

            if (!shouldShow) return null;

            const xPercent = history.length > 1
              ? (index / (history.length - 1)) * 100
              : 50;

            return (
              <div
                key={index}
                className={`absolute text-[9px] ${isNull ? 'text-white/20' : 'text-white/40'}`}
                style={{
                  left: `${xPercent}%`,
                  transform: 'translateX(-50%)'
                }}
              >
                {getLabel(item)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
        <div className="text-center">
          <div className="text-white/40 text-xs mb-1">Plus bas</div>
          <div className="text-white font-medium">{minValue.toFixed(2)}€</div>
        </div>
        <div className="text-center">
          <div className="text-white/40 text-xs mb-1">Actuel</div>
          <div className={`font-medium text-lg ${metric === 'mrr' ? 'text-emerald-400' : 'text-purple-400'}`}>
            {currentValue.toFixed(2)}€
          </div>
        </div>
        <div className="text-center">
          <div className="text-white/40 text-xs mb-1">Plus haut</div>
          <div className="text-white font-medium">{maxValue.toFixed(2)}€</div>
        </div>
      </div>
    </div>
  );
}
