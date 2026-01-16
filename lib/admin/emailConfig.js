/**
 * Configuration pour l'affichage de l'onglet Email dans le dashboard admin
 */

import { BarChart3, FileEdit, History, Settings } from 'lucide-react';

// Ordre des sections affiché
export const EMAIL_SECTION_ORDER = ['dashboard', 'templates', 'history', 'config'];

// Configuration des sections avec leurs icônes et couleurs
export const EMAIL_SECTION_CONFIG = {
  dashboard: {
    id: 'dashboard',
    icon: BarChart3,
    label: 'Dashboard',
    color: 'blue',
    description: 'KPIs et statistiques SMTP',
  },
  templates: {
    id: 'templates',
    icon: FileEdit,
    label: 'Templates',
    color: 'emerald',
    description: 'Gestion des templates email',
  },
  history: {
    id: 'history',
    icon: History,
    label: 'Historique',
    color: 'violet',
    description: 'Logs des emails envoyés',
  },
  config: {
    id: 'config',
    icon: Settings,
    label: 'Configuration',
    color: 'orange',
    description: 'Paramètres email',
  },
};

// Mapping des couleurs Tailwind (identique à SettingsNav)
export const EMAIL_COLOR_CLASSES = {
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
  violet: {
    active: 'bg-violet-500/20 border-violet-500/50 text-violet-300',
    hover: 'hover:bg-violet-500/10',
    icon: 'text-violet-400',
    indicator: 'bg-violet-400',
  },
  orange: {
    active: 'bg-orange-500/20 border-orange-500/50 text-orange-300',
    hover: 'hover:bg-orange-500/10',
    icon: 'text-orange-400',
    indicator: 'bg-orange-400',
  },
};

/**
 * Obtenir la configuration d'une section
 */
export function getEmailSectionConfig(sectionId) {
  return EMAIL_SECTION_CONFIG[sectionId] || null;
}

/**
 * Obtenir les classes de couleur pour une section
 */
export function getEmailColorClasses(color) {
  return EMAIL_COLOR_CLASSES[color] || EMAIL_COLOR_CLASSES.blue;
}
