"use client";

import { useState, useCallback } from "react";

/**
 * Hook for managing source info state and fetching
 */
export function useSourceInfo({ fetchMatchScore, setCurrentCvFile, setIsLoadingMatchScore, setMatchScore, setScoreBefore, setMatchScoreStatus, setOptimiseStatus, setHasJobOffer, setHasScoreBreakdown }) {
  const [sourceInfo, setSourceInfo] = useState({
    sourceType: null,
    sourceValue: null,
    jobOfferInfo: null,
    sourceCvInfo: null
  });
  const [isTransitioning, setIsTransitioning] = useState(false);

  const fetchSourceInfo = useCallback(() => {
    // Récupérer le CV actuel depuis le cookie pour détecter les changements
    const cookies = document.cookie.split(';');
    const cvFileCookie = cookies.find(c => c.trim().startsWith('cvFile='));
    const newCvFile = cvFileCookie ? decodeURIComponent(cvFileCookie.split('=')[1]) : null;

    // Activer l'état de transition pour éviter le flash visuel
    setIsTransitioning(true);

    // Mettre à jour seulement le CV actuel et le loading, garder les autres états temporairement
    setCurrentCvFile(newCvFile);
    setIsLoadingMatchScore(true);

    fetch("/api/cv/source", { cache: "no-store" })
      .then(res => {
        if (!res.ok) {
          return { sourceType: null, sourceValue: null, hasJobOffer: false };
        }
        return res.json();
      })
      .then(data => {
        // Mettre à jour les infos de source
        setSourceInfo({
          sourceType: data.sourceType,
          sourceValue: data.sourceValue,
          jobOfferInfo: data.jobOfferInfo,
          sourceCvInfo: data.sourceCvInfo,
        });

        // Ne récupérer le score que si le CV a une offre d'emploi associée
        if (data.hasJobOffer) {
          fetchMatchScore();
        } else {
          // Réinitialiser les états du score seulement si pas d'offre
          setMatchScore(null);
          setScoreBefore(null);
          setMatchScoreStatus('idle');
          setOptimiseStatus('idle');
          setHasJobOffer(false);
          setHasScoreBreakdown(false);
          setIsLoadingMatchScore(false);
        }

        // Fin de la transition après un court délai pour la fluidité
        setTimeout(() => setIsTransitioning(false), 100);
      })
      .catch(err => {
        setIsLoadingMatchScore(false);
        setIsTransitioning(false);
      });
  }, [fetchMatchScore, setCurrentCvFile, setIsLoadingMatchScore, setMatchScore, setScoreBefore, setMatchScoreStatus, setOptimiseStatus, setHasJobOffer, setHasScoreBreakdown]);

  return {
    sourceInfo,
    isTransitioning,
    fetchSourceInfo,
  };
}
