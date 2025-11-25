'use client';

/**
 * Composant affichant les statistiques de complétion des modales d'onboarding
 * Grille 2x3 avec mini-cards pour chaque modale
 */
export function OnboardingModalStats({ data }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Taux de complétion des modales</h3>
        <div className="text-white/60 text-center py-8">Aucune donnée disponible</div>
      </div>
    );
  }

  // Ordre des modales
  const modalOrder = ['welcome', 'step1', 'step2', 'step6', 'step8', 'completion'];
  const modalIcons = {
    welcome: '👋',
    step1: '✏️',
    step2: '🤖',
    step6: '⚡',
    step8: '📤',
    completion: '🎉',
  };

  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Taux de complétion des modales</h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {modalOrder.map(key => {
          const modal = data[key];
          if (!modal) return null;

          const rateColor = getRateColor(modal.rate);

          return (
            <div
              key={key}
              className="bg-white/5 rounded-lg border border-white/10 p-4 hover:bg-white/10 transition"
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{modalIcons[key]}</span>
                <span className="text-white/90 font-medium text-sm">{modal.name}</span>
              </div>

              {/* Taux */}
              <div className="flex items-end justify-between mb-2">
                <span className={`text-2xl font-bold ${rateColor}`}>
                  {modal.rate}%
                </span>
                <span className="text-white/40 text-xs">
                  {modal.completed}/{modal.total}
                </span>
              </div>

              {/* Barre de progression */}
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getBarColorClass(modal.rate)}`}
                  style={{ width: `${modal.rate}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Moyenne globale */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-white/60 text-sm">Moyenne globale</span>
          <span className="text-white font-medium">
            {calculateAverage(data)}%
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Détermine la couleur du texte selon le taux
 */
function getRateColor(rate) {
  if (rate >= 80) return 'text-emerald-400';
  if (rate >= 60) return 'text-amber-400';
  return 'text-rose-400';
}

/**
 * Détermine la classe de couleur de la barre
 */
function getBarColorClass(rate) {
  if (rate >= 80) return 'bg-emerald-500';
  if (rate >= 60) return 'bg-amber-500';
  return 'bg-rose-500';
}

/**
 * Calcule la moyenne des taux de complétion
 */
function calculateAverage(data) {
  const rates = Object.values(data).map(m => m.rate).filter(r => !isNaN(r));
  if (rates.length === 0) return 0;
  return Math.round(rates.reduce((a, b) => a + b, 0) / rates.length * 10) / 10;
}
