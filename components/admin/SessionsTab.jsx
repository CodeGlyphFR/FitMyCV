'use client';

import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { KPICard } from './KPICard';

const COLORS = {
  primary: '#3B82F6',
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#06B6D4',
};

export function SessionsTab({ period, userId, refreshKey, isInitialLoad }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, [period, userId, refreshKey]);

  async function fetchSessions() {
    setLoading(true);
    try {
      const url = `/api/analytics/sessions?period=${period}${userId ? `&userId=${userId}` : ''}`;
      const res = await fetch(url);
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white/60">Chargement des sessions...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { statistics, recentSessions } = data;

  // Préparer les données pour les graphiques

  // 1. Évolution dans le temps (grouper par jour)
  const sessionsByDay = recentSessions.reduce((acc, session) => {
    const date = new Date(session.startedAt).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit'
    });
    if (!acc[date]) {
      acc[date] = {
        date,
        sessions: 0,
        avgDuration: 0,
        totalDuration: 0,
        count: 0
      };
    }
    acc[date].sessions++;
    if (session.duration) {
      acc[date].totalDuration += session.duration;
      acc[date].count++;
      acc[date].avgDuration = Math.round(acc[date].totalDuration / acc[date].count / 60000);
    }
    return acc;
  }, {});

  const timelineData = Object.values(sessionsByDay)
    .sort((a, b) => {
      const [dayA, monthA] = a.date.split('/');
      const [dayB, monthB] = b.date.split('/');
      return new Date(`2024-${monthA}-${dayA}`) - new Date(`2024-${monthB}-${dayB}`);
    })
    .slice(-14); // 14 derniers jours

  // 2. Distribution par heure de la journée
  const sessionsByHour = recentSessions.reduce((acc, session) => {
    const hour = new Date(session.startedAt).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {});

  const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${hour}h`,
    sessions: sessionsByHour[hour] || 0,
  })).filter(d => d.sessions > 0);

  // 3. Distribution par jour de la semaine
  const sessionsByWeekday = recentSessions.reduce((acc, session) => {
    const weekday = new Date(session.startedAt).toLocaleDateString('fr-FR', { weekday: 'long' });
    acc[weekday] = (acc[weekday] || 0) + 1;
    return acc;
  }, {});

  const weekdayOrder = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const weekdayData = weekdayOrder
    .map(day => ({
      day: day.charAt(0).toUpperCase() + day.slice(1, 3),
      sessions: sessionsByWeekday[day] || 0,
    }))
    .filter(d => d.sessions > 0);

  // 4. Distribution des durées (buckets plus visuels)
  const durationBuckets = recentSessions
    .filter(s => s.duration)
    .reduce((acc, session) => {
      const minutes = Math.round(session.duration / 60000);
      let bucket;
      if (minutes < 1) bucket = '< 1min';
      else if (minutes < 5) bucket = '1-5min';
      else if (minutes < 15) bucket = '5-15min';
      else if (minutes < 30) bucket = '15-30min';
      else bucket = '> 30min';
      acc[bucket] = (acc[bucket] || 0) + 1;
      return acc;
    }, {});

  // Trier les buckets dans l'ordre logique
  const bucketOrder = ['< 1min', '1-5min', '5-15min', '15-30min', '> 30min'];
  const durationData = bucketOrder
    .map(bucket => ({
      name: bucket,
      value: durationBuckets[bucket] || 0
    }))
    .filter(d => d.value > 0);

  // 5. Engagement (basé sur pagesViewed)
  const engagementBuckets = recentSessions.reduce((acc, session) => {
    // Utiliser pagesViewed comme métrique d'engagement
    const engagement = session.pagesViewed || 0;

    if (engagement <= 1) acc.rebond++;
    else if (engagement <= 3) acc.faible++;
    else if (engagement <= 7) acc.moyen++;
    else acc.fort++;
    return acc;
  }, { rebond: 0, faible: 0, moyen: 0, fort: 0 });

  const engagementData = [
    { name: 'Rebond', value: engagementBuckets.rebond, color: COLORS.danger },
    { name: 'Faible', value: engagementBuckets.faible, color: COLORS.warning },
    { name: 'Moyen', value: engagementBuckets.moyen, color: COLORS.info },
    { name: 'Fort', value: engagementBuckets.fort, color: COLORS.success },
  ].filter(d => d.value > 0);

  // KPIs calculés
  const activeSessions = recentSessions.filter(s => !s.endedAt).length;
  const completedSessions = recentSessions.filter(s => s.endedAt).length;
  const completionRate = statistics.totalSessions > 0
    ? ((completedSessions / statistics.totalSessions) * 100).toFixed(1)
    : 0;
  const bounceRate = statistics.totalSessions > 0
    ? ((engagementBuckets.rebond / statistics.totalSessions) * 100).toFixed(1)
    : 0;

  // Légende d'engagement pour le tooltip
  const engagementLegend = {
    rebond: '≤1 page',
    faible: '2-3 pages',
    moyen: '4-7 pages',
    fort: '>7 pages'
  };

  return (
    <div className="space-y-6">
      {/* KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon="👥"
          label="Sessions totales"
          value={statistics.totalSessions}
          subtitle={`${activeSessions} actives • ${completedSessions} terminées`}
          description="Nombre total de sessions utilisateurs avec répartition entre sessions actives (en cours) et terminées"
        />
        <KPICard
          icon="⏱️"
          label="Durée moyenne"
          value={`${Math.round(statistics.avgDuration / 60)}m`}
          subtitle={`Médiane: ${Math.round(statistics.medianDuration / 60)}min`}
          description="Temps moyen passé par session et médiane pour mieux comprendre la distribution des durées"
        />
        <KPICard
          icon="📄"
          label="Pages par session"
          value={statistics.avgPagesPerSession.toFixed(1)}
          subtitle="pages vues en moyenne"
          description="Nombre moyen de pages consultées par session, indicateur de l'engagement et de l'exploration utilisateur"
        />
        <KPICard
          icon="📉"
          label="Taux de rebond"
          value={`${bounceRate}%`}
          subtitle="≤ 1 page visitée"
          description="Pourcentage d'utilisateurs n'ayant consulté qu'une seule page avant de quitter le site"
        />
      </div>

      {/* Graphiques principaux */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution dans le temps */}
        <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            📈 Évolution des sessions
            <span className="text-sm font-normal text-white/60">(14 derniers jours)</span>
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={timelineData}>
              <defs>
                <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.6)"
                tick={{ fill: 'rgba(255,255,255,0.6)' }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.6)"
                tick={{ fill: 'rgba(255,255,255,0.6)' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.9)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Area
                type="monotone"
                dataKey="sessions"
                stroke={COLORS.primary}
                fillOpacity={1}
                fill="url(#colorSessions)"
                name="Sessions"
                isAnimationActive={isInitialLoad}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Niveau d'engagement */}
        <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4">🎯 Niveau d'engagement</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={engagementData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                isAnimationActive={isInitialLoad}
              >
                {engagementData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0];
                    return (
                      <div className="bg-black/95 backdrop-blur-xl border border-white/20 rounded-lg p-3 shadow-2xl">
                        <p className="text-white font-semibold mb-1">{data.name}</p>
                        <p className="text-white/80 text-sm">{data.value} sessions</p>
                        <p className="text-white/60 text-xs mt-1">
                          {data.name === 'Rebond' && '≤1 page'}
                          {data.name === 'Faible' && '2-3 pages'}
                          {data.name === 'Moyen' && '4-7 pages'}
                          {data.name === 'Fort' && '>7 pages'}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-4">
            <div className="grid grid-cols-2 gap-2">
              {engagementData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-sm text-white/80">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-white/40 mt-3 pt-3 border-t border-white/10">
              Basé sur le nombre de pages visitées par session
            </div>
          </div>
        </div>
      </div>

      {/* Graphiques secondaires */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions par heure */}
        {hourlyData.length > 0 && (
          <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
            <h3 className="text-lg font-semibold text-white mb-4">⏰ Par heure de la journée</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="hour"
                  stroke="rgba(255,255,255,0.6)"
                  tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.6)"
                  tick={{ fill: 'rgba(255,255,255,0.6)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="sessions" fill={COLORS.info} radius={[4, 4, 0, 0]} isAnimationActive={isInitialLoad} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Sessions par jour de la semaine */}
        {weekdayData.length > 0 && (
          <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
            <h3 className="text-lg font-semibold text-white mb-4">📅 Par jour de la semaine</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weekdayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="day"
                  stroke="rgba(255,255,255,0.6)"
                  tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.6)"
                  tick={{ fill: 'rgba(255,255,255,0.6)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="sessions" fill={COLORS.secondary} radius={[4, 4, 0, 0]} isAnimationActive={isInitialLoad} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Distribution des durées */}
        {durationData.length > 0 && (
          <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
            <h3 className="text-lg font-semibold text-white mb-4">⏳ Distribution des durées</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={durationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="name"
                  stroke="rgba(255,255,255,0.6)"
                  tick={{ fill: 'rgba(255,255,255,0.6)' }}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.6)"
                  tick={{ fill: 'rgba(255,255,255,0.6)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="value" fill={COLORS.success} radius={[0, 4, 4, 0]} isAnimationActive={isInitialLoad} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Tableau des sessions récentes (optionnel) */}
      <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg border border-white/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">📋 Sessions récentes</h3>
          <button
            onClick={() => setShowTable(!showTable)}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors"
          >
            {showTable ? 'Masquer' : 'Afficher'}
          </button>
        </div>

        {showTable && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Début
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Durée
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Événements
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Pages
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {recentSessions.slice(0, 10).map((session) => (
                  <tr key={session.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {session.user?.name || session.user?.email || 'Anonyme'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                      {new Date(session.startedAt).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                      {session.duration
                        ? `${Math.round(session.duration / 60000)}m`
                        : 'En cours'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                      {session.eventsCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                      {session.pagesViewed}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {session.endedAt ? (
                        <span className="px-2 py-1 bg-green-500/20 text-green-300 border border-green-400/30 rounded text-xs">
                          Terminée
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded text-xs animate-pulse">
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
