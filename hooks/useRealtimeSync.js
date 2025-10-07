import { useEffect, useCallback, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Hook React pour la synchronisation temps réel via SSE
 * S'abonne aux événements DB et déclenche des callbacks
 *
 * @param {Object} options - Options de configuration
 * @param {Function} options.onTaskUpdate - Callback quand une tâche est mise à jour
 * @param {Function} options.onCvUpdate - Callback quand un CV est mis à jour
 * @param {Function} options.onDbChange - Callback pour tout changement DB
 * @param {boolean} options.enabled - Activer/désactiver la sync (défaut: true)
 * @returns {Object} { connected, error, reconnect }
 */
export function useRealtimeSync(options = {}) {
  const {
    onTaskUpdate,
    onCvUpdate,
    onDbChange,
    enabled = true,
  } = options;

  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const eventSourceRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const reconnectTimeoutRef = useRef(null);

  // Fonction pour se connecter au SSE
  const connect = useCallback(() => {
    if (!enabled || !isAuthenticated) {
      return;
    }

    // Ne pas créer de nouvelle connexion si une existe déjà
    if (eventSourceRef.current) {
      return;
    }

    console.log('[useRealtimeSync] 🔌 Tentative de connexion au SSE endpoint /api/events/stream...');

    try {
      const eventSource = new EventSource('/api/events/stream');
      eventSourceRef.current = eventSource;
      console.log('[useRealtimeSync] 📡 EventSource créé, en attente de connexion...');

      // Événement de connexion réussie
      eventSource.addEventListener('connected', (event) => {
        const data = JSON.parse(event.data);
        console.log('[useRealtimeSync] ✅ Connexion SSE établie avec succès pour user:', data.userId);
        console.log('[useRealtimeSync] 📡 En écoute des événements task:updated et cv:updated');
        setConnected(true);
        setError(null);
      });

      // Mise à jour de tâche
      eventSource.addEventListener('task:updated', (event) => {
        const data = JSON.parse(event.data);
        console.log('[useRealtimeSync] 📨 Task updated reçu du SSE:', data);
        if (onTaskUpdate) {
          console.log('[useRealtimeSync] ✅ Appel du callback onTaskUpdate...');
          onTaskUpdate(data);
        } else {
          console.warn('[useRealtimeSync] ⚠️ Pas de callback onTaskUpdate défini');
        }
      });

      // Mise à jour de CV
      eventSource.addEventListener('cv:updated', (event) => {
        const data = JSON.parse(event.data);
        console.log('[useRealtimeSync] 📨 CV updated reçu du SSE:', data);
        if (onCvUpdate) {
          console.log('[useRealtimeSync] ✅ Appel du callback onCvUpdate...');
          onCvUpdate(data);
        } else {
          console.warn('[useRealtimeSync] ⚠️ Pas de callback onCvUpdate défini');
        }
      });

      // Changement DB générique
      eventSource.addEventListener('db:change', (event) => {
        const data = JSON.parse(event.data);
        console.log('[useRealtimeSync] DB change', data);
        if (onDbChange) {
          onDbChange(data);
        }
      });

      // Gestion des erreurs
      eventSource.onerror = (err) => {
        console.error('[useRealtimeSync] ❌ Erreur SSE détectée:', err);
        console.error('[useRealtimeSync] 📊 État EventSource:', eventSource.readyState);
        setConnected(false);
        setError('Connexion perdue');

        // Fermer la connexion actuelle
        console.log('[useRealtimeSync] 🔌 Fermeture de la connexion SSE...');
        eventSource.close();
        eventSourceRef.current = null;

        // Tentative de reconnexion après 5 secondes
        if (enabled && isAuthenticated) {
          console.log('[useRealtimeSync] 🔄 Reconnexion programmée dans 5s...');
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[useRealtimeSync] 🔄 Tentative de reconnexion...');
            connect();
          }, 5000);
        } else {
          console.log('[useRealtimeSync] ⏭️ Pas de reconnexion (enabled:', enabled, 'isAuthenticated:', isAuthenticated, ')');
        }
      };
    } catch (err) {
      console.error('[useRealtimeSync] Erreur création EventSource:', err);
      setError(err.message);
    }
  }, [enabled, isAuthenticated, onTaskUpdate, onCvUpdate, onDbChange]);

  // Fonction pour se déconnecter
  const disconnect = useCallback(() => {
    console.log('[useRealtimeSync] Déconnexion...');

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnected(false);
  }, []);

  // Fonction pour forcer une reconnexion
  const reconnect = useCallback(() => {
    disconnect();
    connect();
  }, [connect, disconnect]);

  // Se connecter au montage et se déconnecter au démontage
  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return {
    connected,
    error,
    reconnect,
  };
}
