'use client';

import { useState, useEffect } from 'react';
import { Settings, ChevronDown, ChevronRight } from 'lucide-react';
import {
  EMAIL_SECTION_CONFIG,
  EMAIL_COLOR_CLASSES,
} from '@/lib/admin/emailConfig';

/**
 * Navigation latérale pour l'onglet Email (desktop)
 * Se transforme en accordéon sur mobile
 */
export function EmailNav({
  sections,
  activeSection,
  onSectionChange,
  isMobile = false,
  expandedSection = null,
  onToggleExpand = null,
  children,
}) {
  // Sur desktop : navigation sidebar
  if (!isMobile) {
    return (
      <nav className="space-y-1">
        {sections.map((sectionId) => {
          const config = EMAIL_SECTION_CONFIG[sectionId] || {
            icon: Settings,
            label: sectionId,
            color: 'blue',
          };
          const colors = EMAIL_COLOR_CLASSES[config.color];
          const Icon = config.icon;
          const isActive = activeSection === sectionId;

          return (
            <button
              key={sectionId}
              onClick={() => onSectionChange(sectionId)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left
                ${isActive
                  ? colors.active
                  : `bg-white/5 border-white/10 text-white/80 ${colors.hover}`
                }
              `}
            >
              {/* Indicateur actif */}
              <div
                className={`w-1 h-6 rounded-full transition-all ${
                  isActive ? colors.indicator : 'bg-transparent'
                }`}
              />

              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? colors.icon : 'text-white/50'}`} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{config.label}</span>
                </div>
                {isActive && config.description && (
                  <p className="text-xs text-white/50 mt-0.5 truncate">{config.description}</p>
                )}
              </div>
            </button>
          );
        })}
      </nav>
    );
  }

  // Sur mobile : accordéon
  return (
    <div className="space-y-2">
      {sections.map((sectionId) => {
        const config = EMAIL_SECTION_CONFIG[sectionId] || {
          icon: Settings,
          label: sectionId,
          color: 'blue',
        };
        const colors = EMAIL_COLOR_CLASSES[config.color];
        const Icon = config.icon;
        const isExpanded = expandedSection === sectionId;

        return (
          <div key={sectionId} className="rounded-lg border border-white/10 overflow-hidden">
            {/* Header accordéon */}
            <button
              onClick={() => onToggleExpand?.(sectionId)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 transition-all text-left
                ${isExpanded
                  ? `${colors.active} border-b border-white/10`
                  : `bg-white/5 text-white/80 ${colors.hover}`
                }
              `}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isExpanded ? colors.icon : 'text-white/50'}`} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{config.label}</span>
                </div>
              </div>

              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-white/50" />
              ) : (
                <ChevronRight className="w-4 h-4 text-white/50" />
              )}
            </button>

            {/* Contenu accordéon */}
            {isExpanded && (
              <div className="p-4 bg-white/5">
                {typeof children === 'function' ? children(sectionId) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Hook pour détecter si on est sur mobile
 */
export function useIsMobile(breakpoint = 1024) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return isMobile;
}

export default EmailNav;
