'use client';

import { useState } from 'react';
import { EmailNav, useIsMobile } from './email/EmailNav';
import { EmailDashboard } from './email/EmailDashboard';
import { EmailTemplatesSection } from './email/EmailTemplatesSection';
import { EmailHistorySection } from './email/EmailHistorySection';
import { EmailConfigSection } from './email/EmailConfigSection';
import {
  EMAIL_SECTION_ORDER,
  EMAIL_SECTION_CONFIG,
} from '@/lib/admin/emailConfig';

/**
 * EmailManagementTab - Onglet Email admin avec navigation sidebar/accordéons
 */
export function EmailManagementTab({ refreshKey }) {
  // Navigation state
  const [activeSection, setActiveSection] = useState('dashboard');
  const [expandedSection, setExpandedSection] = useState('dashboard'); // Default expanded on mobile
  const isMobile = useIsMobile(1024);

  // Refresh key for logs (triggered after test email sent)
  const [logsRefreshKey, setLogsRefreshKey] = useState(0);

  const handleToggleExpand = (sectionId) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  const handleLogsRefresh = () => {
    setLogsRefreshKey((prev) => prev + 1);
  };

  // Render section content
  const renderSectionContent = (sectionId) => {
    switch (sectionId) {
      case 'dashboard':
        return <EmailDashboard refreshKey={logsRefreshKey} />;
      case 'templates':
        return (
          <EmailTemplatesSection
            refreshKey={refreshKey}
            onLogsRefresh={handleLogsRefresh}
          />
        );
      case 'history':
        return <EmailHistorySection refreshKey={logsRefreshKey} />;
      case 'config':
        return <EmailConfigSection />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Layout principal : sidebar + contenu sur desktop, accordéons sur mobile */}
      {isMobile ? (
        // Mobile : Accordéons
        <EmailNav
          sections={EMAIL_SECTION_ORDER}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          isMobile={true}
          expandedSection={expandedSection}
          onToggleExpand={handleToggleExpand}
        >
          {(sectionId) => renderSectionContent(sectionId)}
        </EmailNav>
      ) : (
        // Desktop : Sidebar + Contenu
        <div className="flex gap-6">
          {/* Sidebar navigation */}
          <div className="w-56 flex-shrink-0">
            <div className="sticky top-4">
              <EmailNav
                sections={EMAIL_SECTION_ORDER}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                isMobile={false}
              />
            </div>
          </div>

          {/* Contenu principal */}
          <div className="flex-1 min-w-0">
            <div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg p-6 border border-white/20">
              <h4 className="text-lg font-semibold text-white mb-6 pb-3 border-b border-white/10 flex items-center gap-3">
                {EMAIL_SECTION_CONFIG[activeSection] && (
                  <>
                    {(() => {
                      const Icon = EMAIL_SECTION_CONFIG[activeSection].icon;
                      return <Icon className="w-5 h-5 text-white/70" />;
                    })()}
                  </>
                )}
                {EMAIL_SECTION_CONFIG[activeSection]?.label || activeSection}
              </h4>
              {renderSectionContent(activeSection)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmailManagementTab;
