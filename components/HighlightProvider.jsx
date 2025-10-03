"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

const HighlightContext = createContext({
  isHighlightEnabled: false,
  toggleHighlight: () => {},
  changesMade: [],
  modifiedSections: [],
  isModified: (section, field) => false,
  getChangeInfo: (section, field) => null,
});

export function HighlightProvider({ children, cv }) {
  const [isHighlightEnabled, setIsHighlightEnabled] = useState(false);
  const [changesMade, setChangesMade] = useState([]);
  const [modifiedSections, setModifiedSections] = useState([]);

  // Extraire les changements depuis les métadonnées du CV
  useEffect(() => {
    if (cv?.meta?.changes_made) {
      setChangesMade(cv.meta.changes_made);
      setModifiedSections(cv.meta.modified_sections || []);

      // Auto-activer le highlighting si c'est un CV amélioré
      if (cv.meta.improved_from) {
        setIsHighlightEnabled(true);
      }
    } else {
      setChangesMade([]);
      setModifiedSections([]);
      setIsHighlightEnabled(false);
    }
  }, [cv]);

  const toggleHighlight = () => {
    setIsHighlightEnabled(prev => !prev);
  };

  const isModified = (section, field = null) => {
    if (!isHighlightEnabled) return false;

    // Vérifier si la section entière est modifiée
    if (modifiedSections.includes(section)) {
      // Si pas de field spécifique, la section est modifiée
      if (!field) return true;

      // Sinon, vérifier le field spécifique
      return changesMade.some(change =>
        change.section === section &&
        (!field || change.field === field)
      );
    }

    return false;
  };

  const getChangeInfo = (section, field = null) => {
    const changes = changesMade.filter(change =>
      change.section === section &&
      (!field || change.field === field)
    );

    return changes.length > 0 ? changes[0] : null;
  };

  const value = {
    isHighlightEnabled,
    toggleHighlight,
    changesMade,
    modifiedSections,
    isModified,
    getChangeInfo,
    isImprovedCv: !!cv?.meta?.improved_from
  };

  return (
    <HighlightContext.Provider value={value}>
      {children}
    </HighlightContext.Provider>
  );
}

export function useHighlight() {
  const context = useContext(HighlightContext);
  if (!context) {
    throw new Error("useHighlight must be used within HighlightProvider");
  }
  return context;
}