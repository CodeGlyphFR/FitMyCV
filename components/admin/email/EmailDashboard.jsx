'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Mail, Send, AlertTriangle, Activity } from 'lucide-react';

// Limite SMTP OVH
const SMTP_HOURLY_LIMIT = 200;

/**
 * Retourne la couleur en fonction du pourcentage d'utilisation SMTP
 */
function getSmtpColor(percent) {
  if (percent >= 80) return { hex: '#ef4444', class: 'red' }; // Critique
  if (percent >= 50) return { hex: '#f59e0b', class: 'amber' }; // Attention
  return { hex: '#10b981', class: 'emerald' }; // OK
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
 * EmailDashboard - Section Dashboard avec KPIs redessinés
 */
export function EmailDashboard({ refreshKey }) {
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
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 rounded-xl border border-red-500/30 p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <p className="text-red-400">Erreur: {error}</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const { currentHour, timeline, summary } = stats;
  const smtpColorInfo = getSmtpColor(currentHour.smtpPercent);
  const smtpStatus = getSmtpStatusLabel(currentHour.smtpPercent);

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* SMTP Usage Card */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-white/60">SMTP (heure)</span>
            <div className={`p-2 rounded-lg bg-${smtpColorInfo.class}-500/20`}>
              <Activity className={`w-4 h-4 text-${smtpColorInfo.class}-400`} style={{ color: smtpColorInfo.hex }} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-bold text-white">{currentHour.smtp}</span>
            <span className="text-sm text-white/40">/ {SMTP_HOURLY_LIMIT}</span>
          </div>
          {/* Progress Bar */}
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(currentHour.smtpPercent, 100)}%`,
                backgroundColor: smtpColorInfo.hex,
              }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span
              className="text-xs font-medium"
              style={{ color: smtpColorInfo.hex }}
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

        {/* Total Emails 24h */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-white/60">Envoyés (24h)</span>
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Send className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{summary.totalSent}</span>
            <span className="text-sm text-white/40">emails</span>
          </div>
          <p className="text-xs text-white/40 mt-2">Dernières 24 heures</p>
        </div>

        {/* Failed Emails */}
        <div className={`rounded-xl border p-5 ${
          summary.totalFailed > 0
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-white/5 border-white/10'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-white/60">Échecs</span>
            <div className={`p-2 rounded-lg ${summary.totalFailed > 0 ? 'bg-red-500/20' : 'bg-white/10'}`}>
              <AlertTriangle className={`w-4 h-4 ${summary.totalFailed > 0 ? 'text-red-400' : 'text-white/40'}`} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${summary.totalFailed > 0 ? 'text-red-400' : 'text-white'}`}>
              {summary.totalFailed}
            </span>
            <span className={`text-sm ${summary.totalFailed > 0 ? 'text-red-400/60' : 'text-white/40'}`}>
              ({summary.failureRate}%)
            </span>
          </div>
          <p className={`text-xs mt-2 ${summary.totalFailed > 0 ? 'text-red-400/60' : 'text-white/40'}`}>
            Taux d'échec
          </p>
        </div>

        {/* Provider Mix */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-white/60">Providers</span>
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Mail className="w-4 h-4 text-purple-400" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                SMTP
              </span>
              <span className="text-sm font-medium text-white">{summary.smtpCount || currentHour.smtp}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-purple-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                Resend
              </span>
              <span className="text-sm font-medium text-white">{summary.resendCount || currentHour.resend}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hourly Chart */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-white/80">
            Utilisation SMTP par heure (24h)
          </h4>
          <span className="text-xs text-white/40 px-2 py-1 bg-white/10 rounded-lg">
            Limite: {SMTP_HOURLY_LIMIT}/h
          </span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
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
            {/* Ligne de limite */}
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

export default EmailDashboard;
