'use client';

import { useState, useEffect } from 'react';
import { KPICard } from './KPICard';
import { OnboardingStatusChart } from './OnboardingStatusChart';
import { OnboardingDropoffChart } from './OnboardingDropoffChart';
import { OnboardingTimeline } from './OnboardingTimeline';
import { OnboardingModalStats } from './OnboardingModalStats';
import { OnboardingUsersTable } from './OnboardingUsersTable';

/**
 * Onglet principal du dashboard Onboarding
 * Affiche les KPIs, charts et table des utilisateurs
 */
export function OnboardingTab({ period, refreshKey, isInitialLoad = true }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, [period, refreshKey]);

  async function fetchData() {
    try {
      if (!data) setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/onboarding/analytics?period=${period}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(errorData.error || 'Failed to fetch data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching onboarding analytics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white/60">Chargement des données d'onboarding...</div>
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

  const { kpis, stepDropoff, modals, timeline } = data;

  // Déterminer la couleur du score de santé
  const healthScoreColor = kpis.healthScore >= 70
    ? 'text-emerald-400'
    : kpis.healthScore >= 50
      ? 'text-amber-400'
      : 'text-rose-400';

  const healthScoreSubtitle = kpis.healthScore >= 70
    ? 'Bon'
    : kpis.healthScore >= 50
      ? 'Attention'
      : 'Critique';

  return (
    <div className="space-y-6 pb-8">
      {/* Section 1: KPIs Principaux */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon="📈"
          label="Taux de complétion"
          value={`${kpis.completionRate}%`}
          subtitle={`${kpis.completed} complétés`}
          subtitleClassName="text-emerald-400/70"
          description="Pourcentage d'utilisateurs ayant terminé les 9 étapes de l'onboarding parmi ceux qui l'ont démarré"
        />
        <KPICard
          icon="⏭️"
          label="Taux d'abandon"
          value={`${kpis.skipRate}%`}
          subtitle={`${kpis.skipped} abandons`}
          subtitleClassName="text-orange-400/70"
          description="Pourcentage d'utilisateurs ayant cliqué sur 'Passer l'onboarding' parmi ceux qui l'ont démarré"
        />
        <KPICard
          icon="⏱️"
          label="Temps moyen"
          value={kpis.avgCompletionTime || '-'}
          subtitle="pour compléter"
          description="Durée moyenne entre le début et la fin de l'onboarding pour les utilisateurs l'ayant complété"
        />
        <KPICard
          icon="💚"
          label="Score de santé"
          value={kpis.healthScore}
          subtitle={healthScoreSubtitle}
          subtitleClassName={healthScoreColor}
          description="Indicateur composite : (taux complétion × 0.6) + ((100 - taux abandon) × 0.4). Vert ≥70, Jaune 50-69, Rouge <50"
        />
      </div>

      {/* Section 2: KPIs Secondaires (Compteurs) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          icon="👥"
          label="Total utilisateurs"
          value={kpis.totalUsers}
          description="Nombre total d'utilisateurs sur la période sélectionnée"
        />
        <KPICard
          icon="🚀"
          label="Démarrés"
          value={kpis.started}
          description="Utilisateurs ayant commencé l'onboarding (étape 1+)"
        />
        <KPICard
          icon="✅"
          label="Complétés"
          value={kpis.completed}
          subtitle={kpis.totalUsers > 0 ? `${Math.round((kpis.completed / kpis.totalUsers) * 100)}% du total` : '-'}
          subtitleClassName="text-emerald-400/60"
          description="Utilisateurs ayant terminé les 9 étapes avec succès"
        />
        <KPICard
          icon="🔄"
          label="En cours"
          value={kpis.inProgress}
          description="Utilisateurs actuellement en progression dans l'onboarding"
        />
        <KPICard
          icon="⚠️"
          label="Bloqués"
          value={kpis.stuckCount}
          subtitle="> 7 jours"
          subtitleClassName="text-red-400/70"
          description="Utilisateurs n'ayant pas progressé depuis plus de 7 jours"
        />
        <KPICard
          icon="❌"
          label="Non démarrés"
          value={kpis.notStarted}
          description="Utilisateurs n'ayant jamais commencé l'onboarding"
        />
      </div>

      {/* Section 3: Charts (Status Distribution + Drop-off) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OnboardingStatusChart data={kpis} isInitialLoad={isInitialLoad} />
        <OnboardingDropoffChart data={stepDropoff} isInitialLoad={isInitialLoad} />
      </div>

      {/* Section 4: Timeline + Modal Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OnboardingTimeline data={timeline} isInitialLoad={isInitialLoad} />
        <OnboardingModalStats data={modals} />
      </div>

      {/* Section 5: Table des utilisateurs */}
      <OnboardingUsersTable refreshKey={refreshKey} />
    </div>
  );
}
