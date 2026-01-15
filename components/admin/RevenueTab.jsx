'use client';

import { useState, useEffect } from 'react';
import { KPICard } from './KPICard';
import { PlanDistributionChart } from './PlanDistributionChart';
import { MRRHistoryChart } from './MRRHistoryChart';

const currentYear = new Date().getFullYear();

// Fonction pour générer le titre dynamique
const getPeriodTitle = (period, metric, year) => {
  const metricLabel = metric.toUpperCase();
  switch (period) {
    case '12months':
      return `Évolution ${metricLabel} (${year})`;
    case '6months':
      return `Évolution ${metricLabel} (6 mois - ${year})`;
    case 'month':
      return `Évolution ${metricLabel} (ce mois)`;
    case 'week':
      return `Évolution ${metricLabel} (cette semaine)`;
    default:
      return `Évolution ${metricLabel}`;
  }
};

export function RevenueTab({ refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('12months');
  const [year, setYear] = useState(currentYear);
  const [metric, setMetric] = useState('mrr');

  useEffect(() => {
    fetchData(period, year);
  }, [refreshKey]);

  async function fetchData(p = period, y = year) {
    try {
      // Only show loader if no data yet (initial load)
      if (!data) {
        setLoading(true);
      }
      setError(null);

      const response = await fetch(`/api/admin/revenue?period=${p}&year=${y}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Failed to fetch revenue data');
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      console.error('Error fetching revenue data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    fetchData(newPeriod, year);
  };

  const handleYearChange = (newYear) => {
    setYear(newYear);
    fetchData(period, newYear);
  };

  const handleMetricChange = (newMetric) => {
    setMetric(newMetric);
    // Pas besoin de refetch, le composant affiche déjà les deux métriques
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white/60">Chargement des données de revenus...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-400">Erreur : {error}</div>
      </div>
    );
  }

  if (!data) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatPercentage = (value) => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6 pb-8">
      {/* KPI Cards principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon="📅"
          label="MRR Réel"
          value={formatCurrency(data.realMRR)}
          subtitle="abonnements mensuels"
          description="Revenus des abonnements mensuels uniquement (sans conversion des annuels)"
        />
        <KPICard
          icon="📆"
          label="ARR Réel"
          value={formatCurrency(data.realARR)}
          subtitle="abonnements annuels"
          description="Revenus des abonnements annuels uniquement (sans conversion des mensuels)"
        />
        <KPICard
          icon="💰"
          label="Total Récurrent"
          value={formatCurrency(data.totalRevenue)}
          subtitle="revenus abonnements"
          description="Total des revenus récurrents (MRR réel + ARR réel)"
        />
        <KPICard
          icon="💎"
          label="Revenus Crédits"
          value={formatCurrency(data.creditRevenue)}
          subtitle="packs vendus"
          description="Revenus totaux des packs de crédits vendus"
        />
      </div>

      {/* KPI Cards secondaires */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KPICard
          icon="📉"
          label="Taux de Churn"
          value={`${data.churnRate.toFixed(2)}%`}
          subtitle="annulations ce mois"
          description="Pourcentage d'utilisateurs ayant annulé leur abonnement ce mois-ci par rapport au total d'abonnements actifs en début de mois"
        />
        <KPICard
          icon="🎯"
          label="Taux de Conversion"
          value={`${data.conversionRate.toFixed(2)}%`}
          subtitle="utilisateurs payants"
          description="Pourcentage d'utilisateurs avec un abonnement payant actif par rapport au total d'utilisateurs"
        />
      </div>

      {/* Graphiques - Distribution 1/3, MRR 2/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribution des plans - 1/3 */}
        <div className="lg:col-span-1 bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>📊</span>
            Distribution des Plans
          </h3>
          <PlanDistributionChart distribution={data.planDistribution} />
        </div>

        {/* Historique MRR/ARR - 2/3 */}
        <div className="lg:col-span-2 bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6 overflow-hidden">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>📈</span>
            {getPeriodTitle(period, metric, year)}
          </h3>
          <MRRHistoryChart
            history={data.revenueHistory}
            period={period}
            year={year}
            metric={metric}
            availableYears={data.availableYears || []}
            onPeriodChange={handlePeriodChange}
            onYearChange={handleYearChange}
            onMetricChange={handleMetricChange}
          />
        </div>
      </div>

      {/* Détails par plan */}
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>💼</span>
          Détails par Plan
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-4 text-white/60 font-medium">Plan</th>
                <th className="text-right py-3 px-4 text-white/60 font-medium">Utilisateurs</th>
                <th className="text-right py-3 px-4 text-white/60 font-medium">MRR</th>
                <th className="text-right py-3 px-4 text-white/60 font-medium">ARR</th>
                <th className="text-right py-3 px-4 text-white/60 font-medium">Total</th>
                <th className="text-right py-3 px-4 text-white/60 font-medium">% du Total</th>
              </tr>
            </thead>
            <tbody>
              {data.planDistribution.map((plan) => {
                const planTotal = plan.realMRR + plan.realARR;
                const percentageOfTotal = data.totalRevenue > 0 ? (planTotal / data.totalRevenue) * 100 : 0;

                return (
                  <tr key={plan.planId} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="py-3 px-4 text-white">{plan.planName}</td>
                    <td className="py-3 px-4 text-white text-right">{plan.count}</td>
                    <td className="py-3 px-4 text-blue-400 text-right">{formatCurrency(plan.realMRR)}</td>
                    <td className="py-3 px-4 text-purple-400 text-right">{formatCurrency(plan.realARR)}</td>
                    <td className="py-3 px-4 text-emerald-400 text-right font-medium">
                      {formatCurrency(planTotal)}
                    </td>
                    <td className="py-3 px-4 text-white/60 text-right">
                      {percentageOfTotal.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-white/20 font-semibold">
                <td className="py-3 px-4 text-white">Total</td>
                <td className="py-3 px-4 text-white text-right">
                  {data.planDistribution.reduce((sum, p) => sum + p.count, 0)}
                </td>
                <td className="py-3 px-4 text-blue-400 text-right font-bold">
                  {formatCurrency(data.realMRR)}
                </td>
                <td className="py-3 px-4 text-purple-400 text-right font-bold">
                  {formatCurrency(data.realARR)}
                </td>
                <td className="py-3 px-4 text-emerald-400 text-right font-bold">
                  {formatCurrency(data.totalRevenue)}
                </td>
                <td className="py-3 px-4 text-white/60 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Ventes de Crédits */}
      {data.creditPackDetails && data.creditPackDetails.length > 0 && (
        <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>💎</span>
            Ventes de Crédits
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-white/60 font-medium">Pack</th>
                  <th className="text-right py-3 px-4 text-white/60 font-medium">Nombre de ventes</th>
                  <th className="text-right py-3 px-4 text-white/60 font-medium">Prix unitaire</th>
                  <th className="text-right py-3 px-4 text-white/60 font-medium">Revenus total</th>
                  <th className="text-right py-3 px-4 text-white/60 font-medium">% du Total</th>
                </tr>
              </thead>
              <tbody>
                {data.creditPackDetails.map((pack) => {
                  const percentageOfTotal = data.creditRevenue > 0 ? (pack.totalRevenue / data.creditRevenue) * 100 : 0;

                  return (
                    <tr key={pack.packId} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="py-3 px-4 text-white">{pack.packName}</td>
                      <td className="py-3 px-4 text-white text-right">{pack.salesCount}</td>
                      <td className="py-3 px-4 text-white text-right">{formatCurrency(pack.price)}</td>
                      <td className="py-3 px-4 text-yellow-400 text-right font-medium">
                        {formatCurrency(pack.totalRevenue)}
                      </td>
                      <td className="py-3 px-4 text-white/60 text-right">
                        {percentageOfTotal.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-white/20 font-semibold">
                  <td className="py-3 px-4 text-white">Total</td>
                  <td className="py-3 px-4 text-white text-right">
                    {data.creditPackDetails.reduce((sum, p) => sum + p.salesCount, 0)}
                  </td>
                  <td className="py-3 px-4 text-white text-right">-</td>
                  <td className="py-3 px-4 text-yellow-400 text-right font-bold">
                    {formatCurrency(data.creditRevenue)}
                  </td>
                  <td className="py-3 px-4 text-white/60 text-right">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
