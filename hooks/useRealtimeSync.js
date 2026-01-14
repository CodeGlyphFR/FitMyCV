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


    try {
      const eventSource = new EventSource('/api/events/stream');
      eventSourceRef.current = eventSource;

      // Événement de connexion réussie
      eventSource.addEventListener('connected', (event) => {
        const data = JSON.parse(event.data);
        setConnected(true);
        setError(null);
      });

      // Mise à jour de tâche
      eventSource.addEventListener('task:updated', (event) => {
        const data = JSON.parse(event.data);
        if (onTaskUpdate) {
          onTaskUpdate(data);
        } else {
        }
      });

      // Mise à jour de CV
      eventSource.addEventListener('cv:updated', (event) => {
        const data = JSON.parse(event.data);
        if (onCvUpdate) {
          onCvUpdate(data);
        } else {
        }
      });

      // Changement DB générique
      eventSource.addEventListener('db:change', (event) => {
        const data = JSON.parse(event.data);
        if (onDbChange) {
          onDbChange(data);
        }
      });

      // Mise à jour des crédits - dispatcher directement l'événement client
      eventSource.addEventListener('credits:updated', (event) => {
        const data = JSON.parse(event.data);
        // Dispatcher l'événement pour que tous les composants se mettent à jour
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('credits-updated', { detail: data }));
        }
      });

      // Mise à jour des settings (broadcast) - dispatcher l'événement client
      eventSource.addEventListener('settings:updated', (event) => {
        const data = JSON.parse(event.data);
        // Dispatcher l'événement pour que SettingsContext se mette à jour
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('settings:updated', { detail: data }));
        }
      });

      // Gestion des erreurs
      eventSource.onerror = (err) => {
        setConnected(false);
        setError('Connexion perdue');

        // Fermer la connexion actuelle
        eventSource.close();
        eventSourceRef.current = null;

        // Tentative de reconnexion après 5 secondes
        if (enabled && isAuthenticated) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        } else {
        }
      };
    } catch (err) {
      setError(err.message);
    }
  }, [enabled, isAuthenticated, onTaskUpdate, onCvUpdate, onDbChange]);

  // Fonction pour se déconnecter
  const disconnect = useCallback(() => {

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
