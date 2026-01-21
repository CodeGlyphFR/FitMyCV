'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for managing subscription mode state
 */
export function useSubscriptionModeState({ refreshKey, setToast }) {
  const [subscriptionMode, setSubscriptionMode] = useState({
    enabled: true,
    paidSubscribersCount: 0,
    loading: true,
  });

  // Fetch subscription mode
  const fetchSubscriptionMode = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/subscription-mode');
      const data = await res.json();
      setSubscriptionMode({
        enabled: data.subscriptionModeEnabled,
        paidSubscribersCount: data.paidSubscribersCount || 0,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching subscription mode:', error);
      setSubscriptionMode((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchSubscriptionMode();
  }, [refreshKey, fetchSubscriptionMode]);

  // Toggle subscription mode
  const handleSubscriptionModeToggle = useCallback(async (enabled) => {
    try {
      const res = await fetch('/api/admin/subscription-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error('Failed to update subscription mode');
      setSubscriptionMode((prev) => ({ ...prev, enabled }));
      setToast({
        type: 'success',
        message: enabled ? 'Mode abonnement activé' : 'Mode crédits uniquement activé',
      });
      fetchSubscriptionMode();
    } catch (error) {
      console.error('Error toggling subscription mode:', error);
      setToast({ type: 'error', message: 'Erreur lors du changement de mode' });
    }
  }, [fetchSubscriptionMode, setToast]);

  // Cancel all subscriptions
  const handleCancelAllSubscriptions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cancel-all-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationCode: 'CANCEL_ALL_SUBSCRIPTIONS' }),
      });
      if (!res.ok) throw new Error('Failed to cancel subscriptions');
      const data = await res.json();
      setToast({
        type: 'success',
        message: data.message || 'Abonnements annulés avec succès',
      });
      fetchSubscriptionMode();
    } catch (error) {
      console.error('Error cancelling subscriptions:', error);
      setToast({ type: 'error', message: "Erreur lors de l'annulation des abonnements" });
    }
  }, [fetchSubscriptionMode, setToast]);

  return {
    subscriptionMode,
    handleSubscriptionModeToggle,
    handleCancelAllSubscriptions,
  };
}
