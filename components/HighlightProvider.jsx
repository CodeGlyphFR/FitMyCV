"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

const HighlightContext = createContext({
  changesMade: [],
  isImprovedCv: false,
});

export function HighlightProvider({ children, cv }) {
  const [changesMade, setChangesMade] = useState([]);

  // Extraire les changements depuis les métadonnées du CV
  useEffect(() => {
    if (cv?.meta?.changes_made) {
      setChangesMade(cv.meta.changes_made);
    } else {
      setChangesMade([]);
    }
  }, [cv]);

  const value = {
    changesMade,
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