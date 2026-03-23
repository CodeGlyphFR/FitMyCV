'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';

const HEARTBEAT_INTERVAL = 30_000; // 30 secondes
const AWAY_TIMEOUT = 2 * 60 * 1000; // 2 minutes avant de considérer la session terminée

export default function SessionTracker() {
  const { data: session, status } = useSession();
  const sessionIdRef = useRef(null);
  const intervalRef = useRef(null);
  const awayTimerRef = useRef(null);

  const startTracking = useCallback(async () => {
    if (sessionIdRef.current) return;
    try {
      const res = await fetch('/api/session/start', { method: 'POST' });
      const data = await res.json();
      if (data.sessionId) {
        sessionIdRef.current = data.sessionId;
      }
    } catch {}
  }, []);

  const sendHeartbeat = useCallback(async () => {
    if (!sessionIdRef.current) return;
    try {
      await fetch('/api/session/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      });
    } catch {}
  }, []);

  const endTracking = useCallback(() => {
    if (!sessionIdRef.current) return;
    const body = JSON.stringify({ sessionId: sessionIdRef.current });
    // Beacon API pour fiabilité au déchargement
    const sent = navigator.sendBeacon('/api/session/end', new Blob([body], { type: 'application/json' }));
    if (!sent) {
      fetch('/api/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
    sessionIdRef.current = null;
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;

    startTracking();

    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Fermeture définitive de l'onglet/navigateur → fin immédiate
    const handleBeforeUnload = () => {
      clearTimeout(awayTimerRef.current);
      endTracking();
    };

    // Changement de visibilité → délai avant fin de session
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // L'utilisateur quitte l'onglet → lancer un timer
        // Si il revient avant 2 min, on annule
        clearInterval(intervalRef.current);
        awayTimerRef.current = setTimeout(() => {
          endTracking();
        }, AWAY_TIMEOUT);
      } else if (document.visibilityState === 'visible') {
        // L'utilisateur revient → annuler le timer
        clearTimeout(awayTimerRef.current);
        // Relancer le heartbeat
        intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
        // Si la session a été terminée (timeout expiré), en démarrer une nouvelle
        if (!sessionIdRef.current) {
          startTracking();
        } else {
          // Envoyer un heartbeat immédiat pour signaler le retour
          sendHeartbeat();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(awayTimerRef.current);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      endTracking();
    };
  }, [status, startTracking, sendHeartbeat, endTracking]);

  return null;
}
