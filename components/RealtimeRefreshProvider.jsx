"use client";

import { createContext, useContext, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

const RealtimeRefreshContext = createContext(null);

export function useRealtimeRefresh() {
  const context = useContext(RealtimeRefreshContext);
  if (!context) {
    throw new Error("useRealtimeRefresh must be used within RealtimeRefreshProvider");
  }
  return context;
}

/**
 * Provider global qui écoute les changements Prisma en temps réel
 * et rafraîchit automatiquement tous les composants concernés
 */
export default function RealtimeRefreshProvider({ children }) {
  const router = useRouter();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  // Callback quand une tâche est mise à jour
  const handleTaskUpdate = useCallback((data) => {

    // Déclencher un événement pour BackgroundTasksProvider
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('realtime:task:updated', { detail: data }));
    }
  }, []);

  // Callback quand un CV est mis à jour
  const handleCvUpdate = useCallback((data) => {

    // 1. Rafraîchir la page Next.js (Server Component - affichage du CV)
    router.refresh();

    // 2. Petit délai pour laisser le temps à la DB de se synchroniser
    setTimeout(() => {
      // 3. Déclencher des événements pour les composants clients
      if (typeof window !== 'undefined') {

        // Événement pour Header (match score)
        window.dispatchEvent(new CustomEvent('realtime:cv:updated', { detail: data }));

        // Événement pour CVImprovementPanel
        window.dispatchEvent(new CustomEvent('realtime:cv:metadata:updated', { detail: data }));

        // Événement pour TopBar (liste des CVs)
        window.dispatchEvent(new CustomEvent('realtime:cv:list:changed', { detail: data }));

      }
    }, 100); // Délai de 100ms pour laisser router.refresh() faire son travail
  }, [router]);

  // Callback pour tout changement DB
  const handleDbChange = useCallback((data) => {

    // Déclencher un événement générique
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('realtime:db:changed', { detail: data }));
    }
  }, []);

  // Hook de synchronisation temps réel
  const { connected, error } = useRealtimeSync({
    enabled: isAuthenticated,
    onTaskUpdate: handleTaskUpdate,
    onCvUpdate: handleCvUpdate,
    onDbChange: handleDbChange,
  });

  // Log de l'état de connexion et monitoring
  useEffect(() => {
    if (connected) {
    } else if (error) {
    } else {
    }
  }, [connected, error]);

  // Monitoring périodique de l'état de connexion
  useEffect(() => {
    if (!isAuthenticated) return;

    const monitoringInterval = setInterval(() => {
      if (!connected && isAuthenticated) {
      }
    }, 30000); // Vérifier toutes les 30s

    return () => clearInterval(monitoringInterval);
  }, [connected, isAuthenticated]);

  const value = {
    connected,
    error,
  };

  return (
    <RealtimeRefreshContext.Provider value={value}>
      {children}
    </RealtimeRefreshContext.Provider>
  );
}
