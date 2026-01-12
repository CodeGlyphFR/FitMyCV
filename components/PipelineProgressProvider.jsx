"use client";

import React, { createContext, useContext } from 'react';
import { usePipelineProgress } from '@/hooks/usePipelineProgress';

const PipelineProgressContext = createContext(null);

/**
 * Hook pour accéder au contexte de progression du pipeline
 */
export function usePipelineProgressContext() {
  const context = useContext(PipelineProgressContext);
  if (!context) {
    // Retourner un objet vide si pas de provider (composant optionnel)
    return {
      getProgress: () => null,
      getOfferProgress: () => null,
      getOffersArray: () => [],
      calculateOfferProgress: () => 0,
      allProgress: {},
    };
  }
  return context;
}

/**
 * Provider pour la progression du pipeline CV v2
 * À placer au niveau de l'application pour partager l'état SSE
 */
export default function PipelineProgressProvider({ children }) {
  const progressData = usePipelineProgress();

  return (
    <PipelineProgressContext.Provider value={progressData}>
      {children}
    </PipelineProgressContext.Provider>
  );
}
