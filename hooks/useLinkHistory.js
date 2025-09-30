import { useState, useEffect, useCallback } from 'react';

export function useLinkHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load history from API on mount
  const loadHistory = useCallback(async () => {
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
        setHistory(data.links);
      }
    } catch (error) {
      console.warn('Failed to load link history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Add multiple links at once
  const addLinksToHistory = useCallback(async (links) => {
    if (!Array.isArray(links)) return;

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
  }, [loadHistory]);

  return {
    history,
    loading,
    addLinksToHistory,
    refreshHistory: loadHistory,
  };
}