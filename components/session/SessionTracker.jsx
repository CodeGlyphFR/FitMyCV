'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';

const HEARTBEAT_INTERVAL = 30_000; // 30 secondes

export default function SessionTracker() {
  const { status } = useSession();
  const sessionIdRef = useRef(null);
  const intervalRef = useRef(null);

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

  useEffect(() => {
    if (status !== 'authenticated') return;

    startTracking();
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Quand l'onglet est masqué : on arrête le heartbeat (le serveur détectera l'absence)
    // Quand l'onglet revient : on reprend le heartbeat
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearInterval(intervalRef.current);
      } else if (document.visibilityState === 'visible') {
        if (!sessionIdRef.current) {
          startTracking();
        } else {
          sendHeartbeat();
        }
        intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [status, startTracking, sendHeartbeat]);

  return null;
}
