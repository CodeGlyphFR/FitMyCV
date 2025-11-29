import React from "react";

/**
 * Hook pour gérer l'état des filtres de la liste de CVs
 */
export function useFilterState() {
  // État des filtres
  const [filters, setFilters] = React.useState({
    types: [],      // ['generate-cv', 'import-pdf', ...] - multi-sélection
    language: null, // 'fr' | 'en' | null (tout) - choix unique
    dateRange: null // '24h' | '7d' | '30d' | null (tout) - choix unique
  });

  // État du menu filtre
  const [filterMenuOpen, setFilterMenuOpen] = React.useState(false);
  const [filterMenuRect, setFilterMenuRect] = React.useState(null);

  // Calcul du nombre de filtres actifs
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    count += filters.types.length;
    if (filters.language !== null) count += 1;
    if (filters.dateRange !== null) count += 1;
    return count;
  }, [filters]);

  const hasActiveFilters = activeFilterCount > 0;

  // Actions de filtre
  const toggleType = React.useCallback((type) => {
    setFilters(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type]
    }));
  }, []);

  const setLanguage = React.useCallback((lang) => {
    setFilters(prev => ({
      ...prev,
      language: lang
    }));
  }, []);

  const setDateRange = React.useCallback((range) => {
    setFilters(prev => ({
      ...prev,
      dateRange: range
    }));
  }, []);

  const clearAllFilters = React.useCallback(() => {
    setFilters({
      types: [],
      language: null,
      dateRange: null
    });
  }, []);

  return {
    // État
    filters,
    filterMenuOpen,
    setFilterMenuOpen,
    filterMenuRect,
    setFilterMenuRect,

    // Computed
    hasActiveFilters,
    activeFilterCount,

    // Actions
    toggleType,
    setLanguage,
    setDateRange,
    clearAllFilters,
  };
}
