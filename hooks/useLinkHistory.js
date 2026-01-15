import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export function useLinkHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';

  // Load history from API on mount
  const loadHistory = useCallback(async () => {
    if (!isAuthenticated) {
      setHistory([]);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/link-history');
      if (!response.ok) {
        // Don't throw on 401, just silently fail (user not authenticated)
        if (response.status === 401) {
          setHistory([]);
          return;
        }
        throw new Error('Failed to load history');
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.links)) {
        // Les liens sont maintenant des objets {url, title, domain}
        setHistory(data.links);
      }
    } catch (error) {
      console.warn('Failed to load link history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (status === 'loading') {
      setLoading(true);
      return;
    }

    loadHistory();
  }, [loadHistory, status]);

  // Add multiple links at once
  const addLinksToHistory = useCallback(async (links) => {
    if (!isAuthenticated || !Array.isArray(links)) return;

    const validLinks = links
      .map(link => typeof link === 'string' ? link.trim() : '')
      .filter(link => link.length > 0);

    if (validLinks.length === 0) return;

    try {
      const response = await fetch('/api/link-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ links: validLinks }),
      });

      if (!response.ok) throw new Error('Failed to save history');

      // Reload history after saving
      await loadHistory();
    } catch (error) {
      console.warn('Failed to save link history:', error);
    }
  }, [isAuthenticated, loadHistory]);

  // Delete a link by ID
  const deleteLink = useCallback(async (linkId) => {
    if (!isAuthenticated || !linkId) return false;

    try {
      const response = await fetch(`/api/link-history?id=${linkId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete link');

      // Mettre à jour l'état local immédiatement
      setHistory(prev => prev.filter(link => link.id !== linkId));
      return true;
    } catch (error) {
      console.warn('Failed to delete link:', error);
      return false;
    }
  }, [isAuthenticated]);

  return {
    history,
    loading,
    addLinksToHistory,
    deleteLink,
    refreshHistory: loadHistory,
  };
}
