'use client';

import { useState, useEffect } from 'react';
import { OverviewTab } from '@/components/admin/OverviewTab';
import { FeaturesTab } from '@/components/admin/FeaturesTab';
import { ErrorsTab } from '@/components/admin/ErrorsTab';
import { SettingsTab } from '@/components/admin/SettingsTab';
import { OpenAICostsTab } from '@/components/admin/OpenAICostsTab';
import { FeedbackTab } from '@/components/admin/FeedbackTab';
import { UsersTab } from '@/components/admin/UsersTab';
import { SubscriptionPlansTab } from '@/components/admin/SubscriptionPlansTab';
import { RevenueTab } from '@/components/admin/RevenueTab';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { UserFilter } from '@/components/admin/UserFilter';
import { TabsBar } from '@/components/admin/TabsBar';

const TABS = [
  { id: 'overview', label: 'Vue d\'ensemble', icon: '📊' },
  { id: 'features', label: 'Features', icon: '⚡' },
  { id: 'errors', label: 'Erreurs', icon: '🐛' },
  { id: 'openai-costs', label: 'OpenAI Costs', icon: '💰' },
  { id: 'feedback', label: 'Feedback', icon: '💬' },
  { id: 'users', label: 'Utilisateurs', icon: '👨‍💼' },
  { id: 'revenue', label: 'Revenus', icon: '💵' },
  { id: 'subscriptions', label: 'Abonnements', icon: '💳' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod] = useState('30d');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Reset animations when changing tabs
  useEffect(() => {
    setIsInitialLoad(true);
  }, [activeTab]);

  // Update browser tab title based on active tab
  useEffect(() => {
    const tab = TABS.find(t => t.id === activeTab);
    const tabLabel = tab?.label || 'Analytics Dashboard';
    document.title = `${tabLabel} - Analytics Dashboard`;

    return () => {
      document.title = 'CV Site';
    };
  }, [activeTab]);

  // Auto-refresh every 10 seconds (skip for Settings tab)
  useEffect(() => {
    // Don't auto-refresh the Settings tab
    if (activeTab === 'settings') return;

    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
      setIsInitialLoad(false); // Disable animations for auto-refresh only
    }, 10000);

    return () => clearInterval(interval);
  }, [activeTab]);

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
              {!['settings', 'users', 'subscriptions', 'revenue'].includes(activeTab) && (
                <UserFilter value={selectedUserId} onChange={setSelectedUserId} />
              )}
              {['overview', 'features', 'sessions', 'errors', 'openai-costs', 'feedback'].includes(activeTab) && (
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
            {['overview', 'features', 'sessions', 'errors', 'openai-costs', 'feedback'].includes(activeTab) && (
              <DateRangePicker value={period} onChange={setPeriod} />
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-900/98 backdrop-blur-xl border-b border-white/10 sticky top-12 md:top-[73px] z-40 md:z-30 will-change-transform">
        <div className="max-w-7xl mx-auto md:px-4 sm:px-6 lg:px-8">
          <TabsBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>

      {/* User Filter - Mobile only (below tabs) */}
      {!['settings', 'users', 'subscriptions', 'revenue'].includes(activeTab) && (
        <div className="md:hidden bg-gray-900/98 backdrop-blur-xl border-b border-white/10 sticky top-[5.5rem] z-40 will-change-transform">
          <div className="px-4 py-3">
            <UserFilter value={selectedUserId} onChange={setSelectedUserId} />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-0">
        {activeTab === 'overview' && <OverviewTab period={period} userId={selectedUserId} refreshKey={refreshKey} isInitialLoad={isInitialLoad} />}
        {activeTab === 'features' && <FeaturesTab period={period} userId={selectedUserId} refreshKey={refreshKey} isInitialLoad={isInitialLoad} />}
        {activeTab === 'errors' && <ErrorsTab period={period} userId={selectedUserId} refreshKey={refreshKey} isInitialLoad={isInitialLoad} />}
        {activeTab === 'openai-costs' && <OpenAICostsTab period={period} userId={selectedUserId} refreshKey={refreshKey} isInitialLoad={isInitialLoad} />}
        {activeTab === 'feedback' && <FeedbackTab period={period} userId={selectedUserId} refreshKey={refreshKey} isInitialLoad={isInitialLoad} />}
        {activeTab === 'users' && <UsersTab refreshKey={refreshKey} />}
        {activeTab === 'revenue' && <RevenueTab refreshKey={refreshKey} />}
        {activeTab === 'subscriptions' && <SubscriptionPlansTab refreshKey={refreshKey} />}
        {activeTab === 'settings' && <SettingsTab refreshKey={refreshKey} />}
      </div>
    </div>
  );
}
