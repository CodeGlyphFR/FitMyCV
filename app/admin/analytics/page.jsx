'use client';

import { useState } from 'react';
import { OverviewTab } from '@/components/admin/OverviewTab';
import { FeaturesTab } from '@/components/admin/FeaturesTab';
import { SessionsTab } from '@/components/admin/SessionsTab';
import { ErrorsTab } from '@/components/admin/ErrorsTab';
import { ExportsTab } from '@/components/admin/ExportsTab';
import { SettingsTab } from '@/components/admin/SettingsTab';
import { DateRangePicker } from '@/components/admin/DateRangePicker';

const TABS = [
  { id: 'overview', label: 'Vue d\'ensemble', icon: '📊' },
  { id: 'features', label: 'Features', icon: '⚡' },
  { id: 'sessions', label: 'Sessions', icon: '👥' },
  { id: 'errors', label: 'Erreurs', icon: '🐛' },
  { id: 'exports', label: 'Exports', icon: '📥' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod] = useState('30d');

  return (
    <div className="min-h-screen">
      {/* Header simplifié */}
      <div className="bg-white/10 backdrop-blur-xl border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.location.href = '/'}
                className="text-white/60 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Retour
              </button>
              <div className="h-6 w-px bg-white/10"></div>
              <div>
                <h1 className="text-xl font-bold text-white">Analytics Dashboard</h1>
                <p className="text-white/60 text-sm">Administration</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {['overview', 'sessions', 'errors'].includes(activeTab) && (
                <DateRangePicker value={period} onChange={setPeriod} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-[73px] z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-6 overflow-x-auto scrollbar-hide touch-pan-x px-2 -mx-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition whitespace-nowrap flex-shrink-0
                  ${
                    activeTab === tab.id
                      ? 'border-blue-400 text-white'
                      : 'border-transparent text-white/60 hover:text-white hover:border-white/20'
                  }
                `}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && <OverviewTab period={period} />}
        {activeTab === 'features' && <FeaturesTab />}
        {activeTab === 'sessions' && <SessionsTab period={period} />}
        {activeTab === 'errors' && <ErrorsTab period={period} />}
        {activeTab === 'exports' && <ExportsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}
