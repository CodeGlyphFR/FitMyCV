import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { translatePlanName } from '@/lib/subscription/planTranslations';
import { getPlanIcon } from '@/lib/subscription/planUtils';

/**
 * Hook custom pour récupérer les données d'abonnement et de crédits
 * Utilisé dans le TopBar pour afficher le plan actuel et la balance de crédits
 *
 * Features:
 * - Écoute l'événement 'credits-updated' pour mise à jour immédiate
 * - Fonction refetch() pour forcer une mise à jour
 */
export function useSubscriptionData() {
  const { language } = useLanguage();
  const [data, setData] = useState({
    planName: null,
    planIcon: null,
    creditBalance: 0,
    creditsOnlyMode: false,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async (isMounted = true) => {
    try {
      // Headers pour éviter le cache navigateur
      const fetchOptions = {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      };

      const [subResponse, creditsResponse] = await Promise.all([
        fetch('/api/subscription/current', fetchOptions),
        fetch('/api/credits/balance', fetchOptions),
      ]);

      if (!isMounted) return;

      if (!subResponse.ok || !creditsResponse.ok) {
        throw new Error('Erreur lors de la récupération des données');
      }

      const subData = await subResponse.json();
      const creditsData = await creditsResponse.json();

      const plan = subData?.subscription?.plan;
      const translatedName = plan ? translatePlanName(plan.name, language) : null;
      const icon = plan ? getPlanIcon(plan) : null;
      const creditsOnlyMode = subData?.creditsOnlyMode || false;

      if (isMounted) {
        const newBalance = creditsData?.balance || 0;
        setData({
          planName: translatedName,
          planIcon: icon,
          creditBalance: newBalance,
          creditsOnlyMode,
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      console.error('[useSubscriptionData] Erreur:', error);
      if (isMounted) {
        setData((prev) => ({
          ...prev,
          loading: false,
          error: error.message,
        }));
      }
    }
  }, [language]);

  useEffect(() => {
    let isMounted = true;

    // Fetch initial
    fetchData(isMounted);

    // Écouter l'événement custom 'credits-updated' pour mise à jour immédiate
    const handleCreditsUpdated = () => {
      if (isMounted) {
        fetchData(isMounted);
      }
    };
    window.addEventListener('credits-updated', handleCreditsUpdated);

    return () => {
      isMounted = false;
      window.removeEventListener('credits-updated', handleCreditsUpdated);
    };
  }, [fetchData]);

  // Fonction pour forcer un refresh manuel
  const refetch = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  return { ...data, refetch };
}
