'use client';

import { useState, useEffect } from 'react';
import {
  Cpu,
  Coins,
  Settings,
  FileImage,
  LayoutList,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// Configuration des catégories avec leurs icônes et couleurs
const CATEGORY_CONFIG = {
  ai_models: {
    icon: Cpu,
    label: 'Modèles IA',
    color: 'blue',
    description: 'Sélection des modèles OpenAI',
  },
  credits: {
    icon: Coins,
    label: 'Crédits',
    color: 'emerald',
    description: 'Coûts par fonctionnalité',
  },
  features: {
    icon: Settings,
    label: 'Fonctionnalités',
    color: 'purple',
    description: 'Activer/désactiver les features',
  },
  system: {
    icon: Settings,
    label: 'Système',
    color: 'orange',
    description: 'Configuration générale',
  },
  pdf_import: {
    icon: FileImage,
    label: 'Import PDF',
    color: 'sky',
    description: 'Paramètres Vision AI',
  },
  cv_display: {
    icon: LayoutList,
    label: 'Affichage CV',
    color: 'violet',
    description: 'Ordre des sections',
  },
  danger: {
    icon: AlertTriangle,
    label: 'Zone danger',
    color: 'red',
    description: 'Actions irréversibles',
  },
};

// Mapping des couleurs Tailwind
const COLOR_CLASSES = {
  blue: {
    active: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
    hover: 'hover:bg-blue-500/10',
    icon: 'text-blue-400',
    indicator: 'bg-blue-400',
  },
  emerald: {
    active: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
    hover: 'hover:bg-emerald-500/10',
    icon: 'text-emerald-400',
    indicator: 'bg-emerald-400',
  },
  purple: {
    active: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
    hover: 'hover:bg-purple-500/10',
    icon: 'text-purple-400',
    indicator: 'bg-purple-400',
  },
  orange: {
    active: 'bg-orange-500/20 border-orange-500/50 text-orange-300',
    hover: 'hover:bg-orange-500/10',
    icon: 'text-orange-400',
    indicator: 'bg-orange-400',
  },
  sky: {
    active: 'bg-sky-500/20 border-sky-500/50 text-sky-300',
    hover: 'hover:bg-sky-500/10',
    icon: 'text-sky-400',
    indicator: 'bg-sky-400',
  },
  violet: {
    active: 'bg-violet-500/20 border-violet-500/50 text-violet-300',
    hover: 'hover:bg-violet-500/10',
    icon: 'text-violet-400',
    indicator: 'bg-violet-400',
  },
  red: {
    active: 'bg-red-500/20 border-red-500/50 text-red-300',
    hover: 'hover:bg-red-500/10',
    icon: 'text-red-400',
    indicator: 'bg-red-400',
  },
};

/**
 * Navigation latérale pour les settings (desktop)
 * Se transforme en accordéon sur mobile
 */
export function SettingsNav({
  categories,
  activeCategory,
  onCategoryChange,
  modifiedCounts = {},
  isMobile = false,
  expandedCategory = null,
  onToggleExpand = null,
  children,
  // Props pour le footer de sauvegarde (desktop uniquement)
  hasChanges = false,
  saving = false,
  onSave = null,
  onCancel = null,
  modifiedSettingsList = [],
}) {
  // Sur desktop : navigation sidebar avec footer sauvegarde
  if (!isMobile) {
    return (
      <div className="flex flex-col h-full">
        <nav className="space-y-1 flex-1">
          {categories.map((categoryId) => {
            const config = CATEGORY_CONFIG[categoryId] || {
              icon: Settings,
              label: categoryId,
              color: 'blue',
            };
            const colors = COLOR_CLASSES[config.color];
            const Icon = config.icon;
            const isActive = activeCategory === categoryId;
            const modifiedCount = modifiedCounts[categoryId] || 0;

            return (
              <button
                key={categoryId}
                onClick={() => onCategoryChange(categoryId)}
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
                    {modifiedCount > 0 && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-500/30 text-blue-300 rounded-full">
                        {modifiedCount}
                      </span>
                    )}
                  </div>
                  {isActive && config.description && (
                    <p className="text-xs text-white/50 mt-0.5 truncate">{config.description}</p>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer : Bouton Sauvegarder + liste des modifications */}
        {onSave && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex gap-2">
              {hasChanges && onCancel && (
                <button
                  onClick={onCancel}
                  className="flex-1 px-3 py-2 bg-white/10 text-white/80 border border-white/20 rounded-lg hover:bg-white/20 transition text-sm"
                >
                  Annuler
                </button>
              )}
              <button
                onClick={onSave}
                disabled={!hasChanges || saving}
                className={`flex-1 px-3 py-2 rounded-lg transition text-sm font-medium ${
                  hasChanges && !saving
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/50 hover:bg-emerald-500/40'
                    : 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed'
                }`}
              >
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>

            {/* Liste des modifications */}
            {modifiedSettingsList.length > 0 && (
              <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10 max-h-48 overflow-y-auto">
                <p className="text-xs text-white/50 mb-2">Modifications :</p>
                <ul className="space-y-1">
                  {modifiedSettingsList.map((item, index) => (
                    <li key={index} className="text-xs text-white/70 flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span className="flex-1">{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Sur mobile : accordéon
  return (
    <div className="space-y-2">
      {categories.map((categoryId) => {
        const config = CATEGORY_CONFIG[categoryId] || {
          icon: Settings,
          label: categoryId,
          color: 'blue',
        };
        const colors = COLOR_CLASSES[config.color];
        const Icon = config.icon;
        const isExpanded = expandedCategory === categoryId;
        const modifiedCount = modifiedCounts[categoryId] || 0;

        return (
          <div key={categoryId} className="rounded-lg border border-white/10 overflow-hidden">
            {/* Header accordéon */}
            <button
              onClick={() => onToggleExpand?.(categoryId)}
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
                  {modifiedCount > 0 && (
                    <span className="text-xs px-1.5 py-0.5 bg-blue-500/30 text-blue-300 rounded-full">
                      {modifiedCount}
                    </span>
                  )}
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
                {typeof children === 'function' ? children(categoryId) : null}
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

export { CATEGORY_CONFIG, COLOR_CLASSES };
