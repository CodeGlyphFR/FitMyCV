'use client';

/**
 * Graphique d'évolution du MRR (Monthly Recurring Revenue) sur les derniers mois
 */
export function MRRHistoryChart({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="text-center py-8 text-white/60">
        Aucune donnée d'historique disponible
      </div>
    );
  }

  const maxMRR = Math.max(...history.map(h => h.mrr));
  const minMRR = Math.min(...history.map(h => h.mrr));

  return (
    <div className="space-y-4">
      {/* Graphique en barres */}
      <div className="flex items-end justify-between gap-2 h-64 border-b border-white/10 pb-2">
        {history.map((item, index) => {
          const percentage = maxMRR > 0 ? (item.mrr / maxMRR) * 100 : 0;
          const isLatest = index === history.length - 1;

          return (
            <div key={index} className="flex-1 flex flex-col items-center gap-2">
              {/* Valeur */}
              <div className="text-xs text-white/60 font-medium">
                {item.mrr.toFixed(0)}€
              </div>

              {/* Barre */}
              <div className="w-full flex items-end justify-center h-full">
                <div
                  className={`w-full rounded-t-lg transition-all duration-500 ${
                    isLatest
                      ? 'bg-gradient-to-t from-emerald-500/40 to-emerald-400/60'
                      : 'bg-gradient-to-t from-blue-500/30 to-blue-400/50'
                  }`}
                  style={{ height: `${Math.max(percentage, 5)}%` }}
                />
              </div>

              {/* Mois */}
              <div className="text-xs text-white/40 rotate-[-45deg] origin-top-left mt-2 whitespace-nowrap">
                {item.month}
              </div>
            </div>
          );
        })}
      </div>

      {/* Légende */}
      <div className="flex items-center justify-center gap-6 text-xs text-white/60">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500/40" />
          <span>Historique</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-emerald-500/40" />
          <span>Actuel</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
        <div className="text-center">
          <div className="text-white/40 text-xs mb-1">Plus bas</div>
          <div className="text-white font-medium">{minMRR.toFixed(2)}€</div>
        </div>
        <div className="text-center">
          <div className="text-white/40 text-xs mb-1">Actuel</div>
          <div className="text-emerald-400 font-medium text-lg">{history[history.length - 1]?.mrr.toFixed(2)}€</div>
        </div>
        <div className="text-center">
          <div className="text-white/40 text-xs mb-1">Plus haut</div>
          <div className="text-white font-medium">{maxMRR.toFixed(2)}€</div>
        </div>
      </div>
    </div>
  );
}
