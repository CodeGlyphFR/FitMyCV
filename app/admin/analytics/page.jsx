'use client';

import { useState } from 'react';
import { OverviewTab } from '@/components/admin/OverviewTab';
import { FeaturesTab } from '@/components/admin/FeaturesTab';
import { SessionsTab } from '@/components/admin/SessionsTab';
import { ErrorsTab } from '@/components/admin/ErrorsTab';
import { ExportsTab } from '@/components/admin/ExportsTab';
import { SettingsTab } from '@/components/admin/SettingsTab';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { UserFilter } from '@/components/admin/UserFilter';

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
  const [selectedUserId, setSelectedUserId] = useState(null);

  return (
    <div className="min-h-screen">
      {/* Header - Desktop */}
      <div className="hidden md:block bg-white/10 backdrop-blur-xl border-b border-white/10 sticky top-0 z-40">
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
              <UserFilter value={selectedUserId} onChange={setSelectedUserId} />
              {['overview', 'features', 'sessions', 'errors'].includes(activeTab) && (
                <DateRangePicker value={period} onChange={setPeriod} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Header - Mobile */}
      <div className="md:hidden bg-gray-900/98 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50 h-12 will-change-transform">
        <div className="px-4 h-full flex items-center">
          <div className="flex justify-between items-center w-full">
            <button
              onClick={() => window.location.href = '/'}
              className="text-white/60 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm">Retour</span>
            </button>
            <h1 className="text-sm font-bold text-white">Analytics Dashboard</h1>
            {['overview', 'features', 'sessions', 'errors'].includes(activeTab) && (
              <DateRangePicker value={period} onChange={setPeriod} />
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-900/98 backdrop-blur-xl border-b border-white/10 sticky top-12 md:top-[73px] z-40 md:z-30 will-change-transform">
        <div className="max-w-7xl mx-auto md:px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4 md:space-x-6 overflow-x-auto scrollbar-hide touch-pan-x px-4 md:px-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border-b-2 font-medium text-xs md:text-sm transition whitespace-nowrap flex-shrink-0
                  ${
                    activeTab === tab.id
                      ? 'border-blue-400 text-white'
                      : 'border-transparent text-white/60 hover:text-white hover:border-white/20'
                  }
                `}
              >
                <span className="text-base md:text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* User Filter - Mobile only (below tabs) */}
      <div className="md:hidden bg-gray-900/98 backdrop-blur-xl border-b border-white/10 sticky top-[5.5rem] z-40 will-change-transform">
        <div className="px-4 py-3">
          <UserFilter value={selectedUserId} onChange={setSelectedUserId} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-0">
        {activeTab === 'overview' && <OverviewTab period={period} userId={selectedUserId} />}
        {activeTab === 'features' && <FeaturesTab period={period} userId={selectedUserId} />}
        {activeTab === 'sessions' && <SessionsTab period={period} userId={selectedUserId} />}
        {activeTab === 'errors' && <ErrorsTab period={period} userId={selectedUserId} />}
        {activeTab === 'exports' && <ExportsTab userId={selectedUserId} />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}
