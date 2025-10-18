/**
 * Shared feature configuration for analytics dashboard
 * Ensures consistent colors, labels, and icons across all tabs
 */

export const FEATURE_CONFIG = {
  generate_cv: {
    name: 'Génération CV',
    icon: '🤖',
    colors: {
      from: '#3B82F6',    // blue-500
      to: '#2563EB',      // blue-600
      light: '#DBEAFE',   // blue-100
      solid: '#3B82F6',   // blue-500
    },
  },
  import_cv: {
    name: 'Import PDF',
    icon: '📄',
    colors: {
      from: '#8B5CF6',    // violet-500
      to: '#7C3AED',      // violet-600
      light: '#EDE9FE',   // violet-100
      solid: '#8B5CF6',   // violet-500
    },
  },
  export_cv: {
    name: 'Export PDF',
    icon: '📥',
    colors: {
      from: '#10B981',    // emerald-500
      to: '#059669',      // emerald-600
      light: '#D1FAE5',   // emerald-100
      solid: '#10B981',   // emerald-500
    },
  },
  translate_cv: {
    name: 'Traduction',
    icon: '🌐',
    colors: {
      from: '#F59E0B',    // amber-500
      to: '#D97706',      // amber-600
      light: '#FEF3C7',   // amber-100
      solid: '#F59E0B',   // amber-500
    },
  },
  match_score: {
    name: 'Match Score',
    icon: '🎯',
    colors: {
      from: '#EC4899',    // pink-500
      to: '#DB2777',      // pink-600
      light: '#FCE7F3',   // pink-100
      solid: '#EC4899',   // pink-500
    },
  },
  optimize_cv: {
    name: 'Optimisation',
    icon: '✨',
    colors: {
      from: '#06B6D4',    // cyan-500
      to: '#0891B2',      // cyan-600
      light: '#CFFAFE',   // cyan-100
      solid: '#06B6D4',   // cyan-500
    },
  },
  edit_cv: {
    name: 'Édition CV',
    icon: '✏️',
    colors: {
      from: '#EF4444',    // red-500
      to: '#DC2626',      // red-600
      light: '#FEE2E2',   // red-100
      solid: '#EF4444',   // red-500
    },
  },
};

/**
 * Get feature configuration by name
 * @param {string} featureName - Feature name key
 * @returns {Object} Feature config or default
 */
export function getFeatureConfig(featureName) {
  return FEATURE_CONFIG[featureName] || {
    name: featureName,
    icon: '📊',
    colors: {
      from: '#6B7280',
      to: '#4B5563',
      light: '#F3F4F6',
      solid: '#6B7280',
    },
  };
}

/**
 * Get all feature names
 * @returns {Array<string>}
 */
export function getAllFeatureNames() {
  return Object.keys(FEATURE_CONFIG);
}
