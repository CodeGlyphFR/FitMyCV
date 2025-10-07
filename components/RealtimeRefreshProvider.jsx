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
    console.log('[RealtimeRefresh] 📋 Tâche mise à jour en temps réel:', data);

    // Déclencher un événement pour BackgroundTasksProvider
    if (typeof window !== 'undefined') {
      console.log('[RealtimeRefresh] 📢 Déclenchement événement realtime:task:updated...');
      window.dispatchEvent(new CustomEvent('realtime:task:updated', { detail: data }));
    }
  }, []);

  // Callback quand un CV est mis à jour
  const handleCvUpdate = useCallback((data) => {
    console.log('[RealtimeRefresh] 🔄 CV mis à jour en temps réel:', data);

    // 1. Rafraîchir la page Next.js (Server Component - affichage du CV)
    console.log('[RealtimeRefresh] 🔄 Appel de router.refresh()...');
    router.refresh();

    // 2. Petit délai pour laisser le temps à la DB de se synchroniser
    setTimeout(() => {
      // 3. Déclencher des événements pour les composants clients
      if (typeof window !== 'undefined') {
        console.log('[RealtimeRefresh] 📢 Déclenchement des événements clients...');

        // Événement pour Header (match score)
        window.dispatchEvent(new CustomEvent('realtime:cv:updated', { detail: data }));

        // Événement pour CVImprovementPanel
        window.dispatchEvent(new CustomEvent('realtime:cv:metadata:updated', { detail: data }));

        // Événement pour TopBar (liste des CVs)
        window.dispatchEvent(new CustomEvent('realtime:cv:list:changed', { detail: data }));

        console.log('[RealtimeRefresh] ✅ Tous les événements déclenchés');
      }
    }, 100); // Délai de 100ms pour laisser router.refresh() faire son travail
  }, [router]);

  // Callback pour tout changement DB
  const handleDbChange = useCallback((data) => {
    console.log('[RealtimeRefresh] Changement DB:', data);

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
      console.log('[RealtimeRefresh] ✅ Connecté au système temps réel');
    } else if (error) {
      console.error('[RealtimeRefresh] ❌ Erreur connexion SSE:', error);
      console.warn('[RealtimeRefresh] ⚠️ Le système de backup par polling prendra le relais');
    } else {
      console.log('[RealtimeRefresh] 🔄 Connexion en cours...');
    }
  }, [connected, error]);

  // Monitoring périodique de l'état de connexion
  useEffect(() => {
    if (!isAuthenticated) return;

    const monitoringInterval = setInterval(() => {
      if (!connected && isAuthenticated) {
        console.warn('[RealtimeRefresh] ⚠️ SSE déconnecté ! Le polling de backup assure la continuité.');
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
