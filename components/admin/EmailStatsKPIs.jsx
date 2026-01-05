'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

// Limite SMTP OVH
const SMTP_HOURLY_LIMIT = 200;

/**
 * Retourne la couleur en fonction du pourcentage d'utilisation SMTP
 * @param {number} percent - Pourcentage d'utilisation (0-100)
 * @returns {string} Classe Tailwind ou code couleur hex
 */
function getSmtpColor(percent) {
  if (percent >= 80) return '#ef4444'; // Rouge - Critique
  if (percent >= 50) return '#f59e0b'; // Jaune - Attention
  return '#10b981'; // Vert - OK
}

/**
 * Retourne le label de statut en fonction du pourcentage
 */
function getSmtpStatusLabel(percent) {
  if (percent >= 80) return 'Critique';
  if (percent >= 50) return 'Attention';
  return 'OK';
}

/**
 * EmailStatsKPIs - KPIs email avec jauge SMTP et graphique horaire
 * @param {Object} props
 * @param {number} props.refreshKey - Clé pour rafraîchir les données
 */
export function EmailStatsKPIs({ refreshKey }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, [refreshKey]);

  async function fetchStats() {
    if (!stats) setLoading(true);
    try {
      const res = await fetch('/api/admin/email-stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching email stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !stats) {
    return (
      <div className="bg-white/5 rounded-xl border border-white/10 p-8">
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 rounded-xl border border-red-500/30 p-4">
        <p className="text-red-400">Erreur: {error}</p>
      </div>
    );
  }

  if (!stats) return null;

  const { currentHour, timeline, summary } = stats;
  const smtpColor = getSmtpColor(currentHour.smtpPercent);
  const smtpStatus = getSmtpStatusLabel(currentHour.smtpPercent);

  return (
    <div className="space-y-4">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* SMTP Usage Card with Progress Bar */}
        <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-white/60">SMTP (heure en cours)</p>
            <span className="text-2xl opacity-30">📤</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{currentHour.smtp}</span>
            <span className="text-white/50">/ {SMTP_HOURLY_LIMIT}</span>
          </div>
          {/* Progress Bar */}
          <div className="mt-3">
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(currentHour.smtpPercent, 100)}%`,
                  backgroundColor: smtpColor,
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span
                className="text-sm font-medium"
                style={{ color: smtpColor }}
              >
                {currentHour.smtpPercent}% - {smtpStatus}
              </span>
              {currentHour.resend > 0 && (
                <span className="text-xs text-purple-400">
                  +{currentHour.resend} Resend
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Total Emails 24h */}
        <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/60">Emails envoyés</p>
              <p className="text-3xl font-bold text-white mt-2">{summary.totalSent}</p>
              <p className="text-sm mt-1 text-white/50">dernières 24h</p>
            </div>
            <span className="text-4xl opacity-30">📧</span>
          </div>
        </div>

        {/* Failed Emails */}
        <div className={`backdrop-blur-xl rounded-lg shadow-lg p-6 border ${
          summary.totalFailed > 0
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-white/10 border-white/20'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/60">Échecs</p>
              <p className={`text-3xl font-bold mt-2 ${
                summary.totalFailed > 0 ? 'text-red-400' : 'text-white'
              }`}>
                {summary.totalFailed}
              </p>
              <p className={`text-sm mt-1 ${
                summary.totalFailed > 0 ? 'text-red-400/70' : 'text-white/50'
              }`}>
                {summary.failureRate}% taux d'échec
              </p>
            </div>
            <span className="text-4xl opacity-30">
              {summary.totalFailed > 0 ? '⚠️' : '✅'}
            </span>
          </div>
        </div>
      </div>

      {/* Hourly Chart */}
      <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
        <h4 className="text-sm font-medium text-white/80 mb-4">
          📊 Utilisation SMTP par heure (24h) - Limite: {SMTP_HOURLY_LIMIT}/h
        </h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="label"
              stroke="rgba(255,255,255,0.6)"
              tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="rgba(255,255,255,0.6)"
              tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
              allowDecimals={false}
              domain={[0, (dataMax) => Math.max(dataMax, SMTP_HOURLY_LIMIT * 1.1)]}
            />
            <Tooltip content={<EmailStatsTooltip />} />
            {/* Ligne de limite à 200 */}
            <ReferenceLine
              y={SMTP_HOURLY_LIMIT}
              stroke="#ef4444"
              strokeDasharray="5 5"
              label={{
                value: `Limite: ${SMTP_HOURLY_LIMIT}`,
                fill: '#ef4444',
                fontSize: 11,
                position: 'right',
              }}
            />
            <Bar
              dataKey="smtp"
              name="SMTP"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Custom tooltip for email stats chart
 */
function EmailStatsTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const smtpPercent = data.smtpPercent || 0;

    return (
      <div className="bg-gray-900/95 border border-white/20 rounded-lg p-3 shadow-xl">
        <p className="text-white font-medium mb-2">{label}</p>
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-white/60">SMTP:</span>
            <span className="text-white font-medium">{data.smtp}</span>
            <span className="text-white/40">({smtpPercent}%)</span>
          </p>
          {data.resend > 0 && (
            <p className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-white/60">Resend:</span>
              <span className="text-white font-medium">{data.resend}</span>
            </p>
          )}
          {data.failed > 0 && (
            <p className="flex items-center gap-2 text-red-400">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span>Échecs:</span>
              <span className="font-medium">{data.failed}</span>
            </p>
          )}
        </div>
      </div>
    );
  }
  return null;
}

export default EmailStatsKPIs;
