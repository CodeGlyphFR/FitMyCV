import { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { translatePlanName } from '@/lib/subscription/planTranslations';
import { getPlanIcon } from '@/lib/subscription/planUtils';

/**
 * Hook custom pour récupérer les données d'abonnement et de crédits
 * Utilisé dans le TopBar pour afficher le plan actuel et la balance de crédits
 */
export function useSubscriptionData() {
  const { language } = useLanguage();
  const [data, setData] = useState({
    planName: null,
    planIcon: null,
    creditBalance: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        const [subResponse, creditsResponse] = await Promise.all([
          fetch('/api/subscription/current'),
          fetch('/api/credits/balance'),
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

        if (isMounted) {
          setData({
            planName: translatedName,
            planIcon: icon,
            creditBalance: creditsData?.balance || 0,
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
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [language]);

  return data;
}
