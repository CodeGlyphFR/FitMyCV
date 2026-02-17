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
import { OnboardingTab } from '@/components/admin/OnboardingTab';
import { EmailManagementTab } from '@/components/admin/EmailManagementTab';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { UserFilter } from '@/components/admin/UserFilter';
import { TabsBar } from '@/components/admin/TabsBar';

// Liste des onglets valides
const VALID_TABS = ['overview', 'features', 'errors', 'openai-costs', 'feedback', 'users', 'onboarding', 'revenue', 'subscriptions', 'emails', 'settings'];

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod] = useState('30d');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [triggeredAlerts, setTriggeredAlerts] = useState(null);

  // Initialiser l'onglet depuis l'URL au montage
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (VALID_TABS.includes(hash)) {
      setActiveTab(hash);
    }
  }, []);

  // Mettre à jour l'URL quand on change d'onglet
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    window.history.replaceState(null, '', `#${tabId}`);
  };

  // Fetch triggered alerts
  const fetchTriggeredAlerts = async () => {
    try {
      const res = await fetch('/api/admin/openai-alerts/triggered');
      if (res.ok) {
        const data = await res.json();
        setTriggeredAlerts(data);
      }
    } catch (error) {
      console.error('Error fetching triggered alerts:', error);
    }
  };

  // Tabs configuration with dynamic badges
  const TABS = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: '📊' },
    { id: 'features', label: 'Features', icon: '⚡' },
    { id: 'errors', label: 'Erreurs', icon: '🐛' },
    { id: 'openai-costs', label: 'OpenAI Costs', icon: '💰', badge: triggeredAlerts?.totalTriggered || 0 },
    { id: 'feedback', label: 'Feedback', icon: '💬' },
    { id: 'users', label: 'Utilisateurs', icon: '👨‍💼' },
    { id: 'onboarding', label: 'Onboarding', icon: '🎯' },
    { id: 'revenue', label: 'Revenus', icon: '💵' },
    { id: 'subscriptions', label: 'Abonnements', icon: '💳' },
    { id: 'emails', label: 'Gestion Emails', icon: '📧' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  // Fetch triggered alerts on mount and refresh
  useEffect(() => {
    fetchTriggeredAlerts();
  }, [refreshKey]);

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

  // Auto-refresh every 10 seconds (skip for Settings and Emails tabs)
  // Utilise Page Visibility API pour stopper le polling quand l'onglet est inactif
  useEffect(() => {
    // Don't auto-refresh the Settings or Emails tabs (editor loses focus)
    if (activeTab === 'settings' || activeTab === 'emails') return;

    let interval = null;

    const startPolling = () => {
      // Ne pas démarrer si déjà en cours
      if (interval) return;
      interval = setInterval(() => {
        setRefreshKey(prev => prev + 1);
        setIsInitialLoad(false); // Disable animations for auto-refresh only
      }, 10000);
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refresh immédiat au retour sur l'onglet + redémarrer le polling
        setRefreshKey(prev => prev + 1);
        setIsInitialLoad(false);
        startPolling();
      } else {
        stopPolling();
      }
    };

    // Démarrer le polling seulement si l'onglet est visible
    if (document.visibilityState === 'visible') {
      startPolling();
    }

    // Écouter les changements de visibilité
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
              {!['settings', 'users', 'subscriptions', 'revenue', 'onboarding', 'emails'].includes(activeTab) && (
                <UserFilter value={selectedUserId} onChange={setSelectedUserId} />
              )}
              {['overview', 'features', 'sessions', 'errors', 'openai-costs', 'feedback', 'onboarding'].includes(activeTab) && (
                <DateRangePicker value={period} onChange={setPeriod} />
              )}
              <div className="h-6 w-px bg-white/10"></div>
              <button
                onClick={() => window.open('/api/admin/docs/index.html', '_blank')}
                className="text-white/60 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
                title="Documentation technique"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1.1.2.01.707.293l5.414 5.414a1.1.2.01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
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
            <div className="flex items-center gap-2">
              {['overview', 'features', 'sessions', 'errors', 'openai-costs', 'feedback', 'onboarding'].includes(activeTab) && (
                <DateRangePicker value={period} onChange={setPeriod} />
              )}
              <button
                onClick={() => window.open('/api/admin/docs/index.html', '_blank')}
                className="text-white/60 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
                title="Documentation technique"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1.1.2.01.707.293l5.414 5.414a1.1.2.01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-900/98 backdrop-blur-xl border-b border-white/10 sticky top-12 md:top-[73px] z-40 md:z-30 will-change-transform">
        <div className="max-w-7xl mx-auto md:px-4 sm:px-6 lg:px-8">
          <TabsBar tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
      </div>

      {/* User Filter - Mobile only (below tabs) */}
      {!['settings', 'users', 'subscriptions', 'revenue', 'onboarding', 'emails'].includes(activeTab) && (
        <div className="md:hidden bg-gray-900/98 backdrop-blur-xl border-b border-white/10 sticky top-[5.5rem] z-40 will-change-transform">
          <div className="px-4 py-3">
            <UserFilter value={selectedUserId} onChange={setSelectedUserId} />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-0">
        {activeTab === 'overview' && <OverviewTab period={period} userId={selectedUserId} refreshKey={refreshKey} isInitialLoad={isInitialLoad} triggeredAlerts={triggeredAlerts} />}
        {activeTab === 'features' && <FeaturesTab period={period} userId={selectedUserId} refreshKey={refreshKey} isInitialLoad={isInitialLoad} />}
        {activeTab === 'errors' && <ErrorsTab period={period} userId={selectedUserId} refreshKey={refreshKey} isInitialLoad={isInitialLoad} />}
        {activeTab === 'openai-costs' && <OpenAICostsTab period={period} userId={selectedUserId} refreshKey={refreshKey} isInitialLoad={isInitialLoad} triggeredAlerts={triggeredAlerts} />}
        {activeTab === 'feedback' && <FeedbackTab period={period} userId={selectedUserId} refreshKey={refreshKey} isInitialLoad={isInitialLoad} />}
        {activeTab === 'users' && <UsersTab refreshKey={refreshKey} />}
        {activeTab === 'onboarding' && <OnboardingTab period={period} refreshKey={refreshKey} isInitialLoad={isInitialLoad} />}
        {activeTab === 'revenue' && <RevenueTab refreshKey={refreshKey} />}
        {activeTab === 'subscriptions' && <SubscriptionPlansTab refreshKey={refreshKey} />}
        {activeTab === 'emails' && <EmailManagementTab refreshKey={refreshKey} />}
        {activeTab === 'settings' && <SettingsTab refreshKey={refreshKey} />}
      </div>
    </div>
  );
}
