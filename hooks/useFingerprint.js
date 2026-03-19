"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook React pour obtenir un fingerprint navigateur via FingerprintJS open-source.
 * Pose aussi un cookie `fitmycv_fp` pour le transport OAuth.
 */
export function useFingerprint() {
  const [isLoading, setIsLoading] = useState(true);
  const resultRef = useRef(null);
  const [visitorId, setVisitorId] = useState(null);
  const [confidence, setConfidence] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFingerprint() {
      try {
        const FingerprintJS = (await import('@fingerprintjs/fingerprintjs')).default;
        const agent = await FingerprintJS.load();
        const result = await agent.get();

        if (cancelled) return;

        resultRef.current = result;
        setVisitorId(result.visitorId);
        setConfidence(result.confidence?.score ?? null);

        // Poser un cookie pour le flux OAuth (survit au redirect)
        document.cookie = `fitmycv_fp=${result.visitorId}; max-age=300; path=/; SameSite=Lax`;
      } catch (error) {
        console.warn('[useFingerprint] Erreur FingerprintJS:', error);
        // Fail-open : pas de fingerprint, crédits accordés
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadFingerprint();

    return () => { cancelled = true; };
  }, []);

  return { visitorId, confidence, isLoading };
}
