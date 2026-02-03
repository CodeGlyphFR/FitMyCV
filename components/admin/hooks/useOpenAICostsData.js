import { useState, useEffect, useMemo } from 'react';
import { getFeatureConfig } from '@/lib/analytics/featureConfig';

/**
 * Hook pour gérer toutes les données OpenAI Costs
 * Consolide: data, pricings, alerts, balance, generation costs, improvement costs
 */
export function useOpenAICostsData({ period, userId, refreshKey }) {
  // Main data state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pricing state
  const [pricings, setPricings] = useState([]);
  const [isPriorityMode, setIsPriorityMode] = useState(false);

  // Balance state
  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  // CV Generation costs state
  const [lastGenerationCost, setLastGenerationCost] = useState(null);
  const [cvGenerationTotals, setCvGenerationTotals] = useState(null);

  // CV Improvement costs state
  const [lastImprovementCost, setLastImprovementCost] = useState(null);
  const [cvImprovementTotals, setCvImprovementTotals] = useState(null);

  // Alerts state
  const [alerts, setAlerts] = useState([]);

  // Stable top feature state (prevents flickering)
  const [stableTopFeature, setStableTopFeature] = useState({ feature: 'N/A', name: 'N/A', cost: 0 });

  // Fetch all data on mount and when dependencies change
  useEffect(() => {
    fetchData();
    fetchPricings();
    fetchBalance();
    fetchAlerts();
    fetchLastGenerationCost();
    fetchLastImprovementCost();
  }, [period, userId, refreshKey]);

  const fetchData = async () => {
    try {
      if (!data) setLoading(true);
      const url = new URL('/api/analytics/openai-usage', window.location.origin);
      url.searchParams.set('period', period);
      if (userId) url.searchParams.set('userId', userId);

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      console.error('Error fetching OpenAI usage data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPricings = async () => {
    try {
      const response = await fetch('/api/admin/openai-pricing');
      if (!response.ok) throw new Error('Failed to fetch pricings');
      const result = await response.json();
      setPricings(result.pricings || []);
      setIsPriorityMode(result.isPriorityMode || false);
    } catch (err) {
      console.error('Error fetching pricings:', err);
    }
  };

  const fetchBalance = async () => {
    try {
      setBalanceLoading(true);
      const response = await fetch('/api/admin/openai-balance');
      if (!response.ok) throw new Error('Failed to fetch balance');
      const result = await response.json();
      setBalance(result.balance);
    } catch (err) {
      console.error('Error fetching balance:', err);
      setBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/admin/openai-alerts');
      if (!response.ok) throw new Error('Failed to fetch alerts');
      const result = await response.json();
      setAlerts(result.alerts || []);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  const fetchLastGenerationCost = async () => {
    try {
      const url = new URL('/api/analytics/cv-generation-costs', window.location.origin);
      url.searchParams.set('period', period);
      url.searchParams.set('limit', '100');

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch last generation cost');

      const result = await response.json();

      if (result.totals) {
        setCvGenerationTotals({
          totalCost: result.totals.totalCost,
          totalCalls: result.totals.totalSubtasks,
          totalTokens: result.totals.totalPromptTokens + result.totals.totalCompletionTokens,
          generationCount: result.totals.generationCount,
        });
      } else {
        setCvGenerationTotals(null);
      }

      if (result.generations && result.generations.length > 0) {
        const lastGen = result.generations[0];
        setLastGenerationCost({
          cost: lastGen.totals.estimatedCost,
          promptTokens: lastGen.totals.promptTokens,
          cachedTokens: lastGen.totals.cachedTokens,
          completionTokens: lastGen.totals.completionTokens,
          totalTokens: lastGen.totals.totalTokens,
          durationMs: lastGen.totals.durationMs,
          createdAt: lastGen.createdAt,
          subtaskCount: lastGen.totals.subtaskCount,
        });
      } else {
        setLastGenerationCost(null);
      }
    } catch (err) {
      console.error('Error fetching last generation cost:', err);
      setLastGenerationCost(null);
      setCvGenerationTotals(null);
    }
  };

  const fetchLastImprovementCost = async () => {
    try {
      const url = new URL('/api/analytics/cv-improvement-costs', window.location.origin);
      url.searchParams.set('period', period);
      url.searchParams.set('limit', '100');

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch last improvement cost');

      const result = await response.json();

      if (result.totals) {
        setCvImprovementTotals({
          totalCost: result.totals.totalCost,
          totalCalls: result.totals.totalCalls,
          totalTokens: result.totals.totalPromptTokens + result.totals.totalCompletionTokens,
          sessionCount: result.totals.sessionCount,
        });
      } else {
        setCvImprovementTotals(null);
      }

      if (result.sessions && result.sessions.length > 0) {
        const lastSession = result.sessions[0];
        setLastImprovementCost({
          cost: lastSession.totals.estimatedCost,
          promptTokens: lastSession.totals.promptTokens,
          cachedTokens: lastSession.totals.cachedTokens,
          completionTokens: lastSession.totals.completionTokens,
          totalTokens: lastSession.totals.totalTokens,
          durationMs: lastSession.totals.durationMs,
          createdAt: lastSession.startedAt,
          subtaskCount: lastSession.totals.callCount,
        });
      } else {
        setLastImprovementCost(null);
      }
    } catch (err) {
      console.error('Error fetching last improvement cost:', err);
      setLastImprovementCost(null);
      setCvImprovementTotals(null);
    }
  };

  // Computed: grouped chart data for "Comparaison des derniers coûts"
  const groupedChartData = useMemo(() => {
    if (!data?.byFeature) return [];

    const adaptationFeatures = data.byFeature.filter(f => f.feature.startsWith('cv_adaptation_'));
    const improvementFeatures = data.byFeature.filter(f =>
      f.feature.startsWith('cv_improvement_') ||
      f.feature === 'cv_improvement' ||
      f.feature === 'optimize_cv'
    );
    // Groupe extraction d'offres (URL + PDF + détection de langue)
    const extractionFeatures = data.byFeature.filter(f =>
      f.feature === 'extract_job_offer_url' ||
      f.feature === 'extract_job_offer_pdf' ||
      f.feature === 'detect_language'
    );
    const otherFeatures = data.byFeature.filter(f =>
      !f.feature.startsWith('cv_adaptation_') &&
      !f.feature.startsWith('cv_improvement_') &&
      f.feature !== 'cv_improvement' &&
      f.feature !== 'optimize_cv' &&
      f.feature !== 'extract_job_offer_url' &&
      f.feature !== 'extract_job_offer_pdf' &&
      f.feature !== 'detect_language'
    );

    const chartData = [];

    if (adaptationFeatures.length > 0) {
      const useRealData = lastGenerationCost !== null;
      chartData.push({
        name: 'Génération de CV',
        lastCost: useRealData ? lastGenerationCost.cost : adaptationFeatures.reduce((sum, f) => sum + (f.lastCost || 0), 0),
        lastModel: 'Multiple',
        lastPromptTokens: useRealData ? lastGenerationCost.promptTokens : adaptationFeatures.reduce((sum, f) => sum + (f.lastPromptTokens || 0), 0),
        lastCachedTokens: useRealData ? lastGenerationCost.cachedTokens : adaptationFeatures.reduce((sum, f) => sum + (f.lastCachedTokens || 0), 0),
        lastCompletionTokens: useRealData ? lastGenerationCost.completionTokens : adaptationFeatures.reduce((sum, f) => sum + (f.lastCompletionTokens || 0), 0),
        lastTokens: useRealData ? lastGenerationCost.totalTokens : adaptationFeatures.reduce((sum, f) => sum + (f.lastTokens || 0), 0),
        lastCallDate: useRealData ? lastGenerationCost.createdAt : adaptationFeatures.reduce((latest, f) => {
          if (!f.lastCallDate) return latest;
          if (!latest) return f.lastCallDate;
          return new Date(f.lastCallDate) > new Date(latest) ? f.lastCallDate : latest;
        }, null),
        lastDuration: useRealData ? lastGenerationCost.durationMs : adaptationFeatures.reduce((sum, f) => sum + (f.lastDuration || 0), 0),
        fill: '#10B981',
        isGrouped: true,
        subtaskCount: useRealData ? lastGenerationCost.subtaskCount : adaptationFeatures.length,
      });
    }

    if (improvementFeatures.length > 0) {
      const useRealData = lastImprovementCost !== null;
      chartData.push({
        name: 'Amélioration de CV',
        lastCost: useRealData ? lastImprovementCost.cost : improvementFeatures.reduce((sum, f) => sum + (f.lastCost || 0), 0),
        lastModel: 'Multiple',
        lastPromptTokens: useRealData ? lastImprovementCost.promptTokens : improvementFeatures.reduce((sum, f) => sum + (f.lastPromptTokens || 0), 0),
        lastCachedTokens: useRealData ? lastImprovementCost.cachedTokens : improvementFeatures.reduce((sum, f) => sum + (f.lastCachedTokens || 0), 0),
        lastCompletionTokens: useRealData ? lastImprovementCost.completionTokens : improvementFeatures.reduce((sum, f) => sum + (f.lastCompletionTokens || 0), 0),
        lastTokens: useRealData ? lastImprovementCost.totalTokens : improvementFeatures.reduce((sum, f) => sum + (f.lastTokens || 0), 0),
        lastCallDate: useRealData ? lastImprovementCost.createdAt : improvementFeatures.reduce((latest, f) => {
          if (!f.lastCallDate) return latest;
          if (!latest) return f.lastCallDate;
          return new Date(f.lastCallDate) > new Date(latest) ? f.lastCallDate : latest;
        }, null),
        lastDuration: useRealData ? lastImprovementCost.durationMs : improvementFeatures.reduce((sum, f) => sum + (f.lastDuration || 0), 0),
        fill: '#06B6D4',
        isGrouped: true,
        subtaskCount: useRealData ? lastImprovementCost.subtaskCount : improvementFeatures.length,
      });
    }

    // Groupe Extraction d'offres (extraction + détection de langue)
    // detect_language est maintenant tracké séparément, donc le nombre d'extractions
    // = nombre d'appels extract_job_offer_* (pas divisé par 2)
    if (extractionFeatures.length > 0) {
      const extractionOnlyFeatures = extractionFeatures.filter(f =>
        f.feature === 'extract_job_offer_url' || f.feature === 'extract_job_offer_pdf'
      );
      const totalCost = extractionFeatures.reduce((sum, f) => sum + (f.cost || 0), 0);
      const totalTokens = extractionFeatures.reduce((sum, f) => sum + (f.tokens || 0), 0);
      // Le nombre d'extractions = nombre d'appels d'extraction (detect_language est compté séparément)
      const extractionCount = extractionOnlyFeatures.reduce((sum, f) => sum + (f.calls || 0), 0);
      const avgCostPerExtraction = extractionCount > 0 ? totalCost / extractionCount : 0;
      const avgTokensPerExtraction = extractionCount > 0 ? totalTokens / extractionCount : 0;

      // Calculer les tokens moyens par extraction
      const totalPromptTokens = extractionFeatures.reduce((sum, f) => sum + ((f.lastPromptTokens || 0) * (f.calls || 0)), 0);
      const totalCachedTokens = extractionFeatures.reduce((sum, f) => sum + ((f.lastCachedTokens || 0) * (f.calls || 0)), 0);
      const totalCompletionTokens = extractionFeatures.reduce((sum, f) => sum + ((f.lastCompletionTokens || 0) * (f.calls || 0)), 0);

      chartData.push({
        name: 'Extraction d\'offres',
        lastCost: avgCostPerExtraction,
        lastModel: 'Multiple',
        lastPromptTokens: extractionCount > 0 ? Math.round(totalPromptTokens / extractionCount) : 0,
        lastCachedTokens: extractionCount > 0 ? Math.round(totalCachedTokens / extractionCount) : 0,
        lastCompletionTokens: extractionCount > 0 ? Math.round(totalCompletionTokens / extractionCount) : 0,
        lastTokens: Math.round(avgTokensPerExtraction),
        lastCallDate: extractionFeatures.reduce((latest, f) => {
          if (!f.lastCallDate) return latest;
          if (!latest) return f.lastCallDate;
          return new Date(f.lastCallDate) > new Date(latest) ? f.lastCallDate : latest;
        }, null),
        lastDuration: extractionFeatures.reduce((sum, f) => sum + (f.lastDuration || 0), 0),
        fill: '#14B8A6', // teal-500
        isGrouped: true,
        subtaskCount: extractionCount,
      });
    }

    otherFeatures.forEach((feature) => {
      const featureConfig = getFeatureConfig(feature.feature);
      chartData.push({
        name: featureConfig.name || 'Feature non configurée',
        lastCost: feature.lastCost || 0,
        lastModel: feature.lastModel || 'N/A',
        lastPromptTokens: feature.lastPromptTokens || 0,
        lastCachedTokens: feature.lastCachedTokens || 0,
        lastCompletionTokens: feature.lastCompletionTokens || 0,
        lastTokens: feature.lastTokens || 0,
        lastCallDate: feature.lastCallDate || null,
        lastDuration: feature.lastDuration || null,
        fill: featureConfig.colors?.solid || '#6B7280',
        isGrouped: false,
      });
    });

    return chartData.sort((a, b) => (b.lastCost || 0) - (a.lastCost || 0));
  }, [data?.byFeature, lastGenerationCost, lastImprovementCost]);

  // Computed: grouped feature data for table and pie chart
  const groupedFeatureData = useMemo(() => {
    if (!data?.byFeature) return [];

    // Groupe extraction d'offres (URL + PDF + détection de langue)
    const extractionFeatures = data.byFeature.filter(f =>
      f.feature === 'extract_job_offer_url' ||
      f.feature === 'extract_job_offer_pdf' ||
      f.feature === 'detect_language'
    );

    const otherFeatures = data.byFeature.filter(f =>
      !f.feature.startsWith('cv_adaptation_') &&
      !f.feature.startsWith('cv_improvement_') &&
      f.feature !== 'cv_improvement' &&
      f.feature !== 'optimize_cv' &&
      f.feature !== 'extract_job_offer_url' &&
      f.feature !== 'extract_job_offer_pdf' &&
      f.feature !== 'detect_language'
    );

    const result = [];

    if (cvGenerationTotals && cvGenerationTotals.totalCost > 0) {
      result.push({
        feature: 'cv_generation_grouped',
        name: 'Génération de CV',
        calls: cvGenerationTotals.generationCount,
        tokens: cvGenerationTotals.totalTokens,
        cost: cvGenerationTotals.totalCost,
        color: '#10B981',
        isGrouped: true,
      });
    }

    if (cvImprovementTotals && cvImprovementTotals.totalCost > 0) {
      result.push({
        feature: 'cv_improvement_grouped',
        name: 'Amélioration de CV',
        calls: cvImprovementTotals.sessionCount,
        tokens: cvImprovementTotals.totalTokens,
        cost: cvImprovementTotals.totalCost,
        color: '#06B6D4',
        isGrouped: true,
      });
    }

    // Groupe Extraction d'offres (inclut detect_language)
    if (extractionFeatures.length > 0) {
      const extractionOnlyFeatures = extractionFeatures.filter(f =>
        f.feature === 'extract_job_offer_url' || f.feature === 'extract_job_offer_pdf'
      );
      const totalCost = extractionFeatures.reduce((sum, f) => sum + (f.cost || 0), 0);
      const totalTokens = extractionFeatures.reduce((sum, f) => sum + (f.tokens || 0), 0);
      // Le nombre d'extractions = nombre d'appels d'extraction (detect_language est compté séparément)
      const extractionCount = extractionOnlyFeatures.reduce((sum, f) => sum + (f.calls || 0), 0);

      if (totalCost > 0) {
        result.push({
          feature: 'extraction_grouped',
          name: 'Extraction d\'offres',
          calls: extractionCount, // Nombre d'extractions, pas d'appels OpenAI
          tokens: totalTokens,
          cost: totalCost,
          color: '#14B8A6', // teal-500
          isGrouped: true,
        });
      }
    }

    otherFeatures.forEach((feature) => {
      const featureConfig = getFeatureConfig(feature.feature);
      result.push({
        feature: feature.feature,
        name: featureConfig.name || 'Feature non configurée',
        calls: feature.calls || 0,
        tokens: feature.tokens || 0,
        cost: feature.cost || 0,
        color: featureConfig.colors?.solid || '#6B7280',
        isGrouped: false,
        levelBreakdown: feature.levelBreakdown,
      });
    });

    return result.sort((a, b) => (b.cost || 0) - (a.cost || 0));
  }, [data?.byFeature, cvGenerationTotals, cvImprovementTotals]);

  // Computed: corrected total cost
  const correctedTotalCost = useMemo(() => {
    if (!data?.byFeature) return 0;

    // Extraction features (groupées séparément, inclut detect_language)
    const extractionCost = data.byFeature
      .filter(f =>
        f.feature === 'extract_job_offer_url' ||
        f.feature === 'extract_job_offer_pdf' ||
        f.feature === 'detect_language'
      )
      .reduce((sum, f) => sum + (f.cost || 0), 0);

    const otherFeaturesCost = data.byFeature
      .filter(f =>
        !f.feature.startsWith('cv_adaptation_') &&
        !f.feature.startsWith('cv_improvement_') &&
        f.feature !== 'cv_improvement' &&
        f.feature !== 'optimize_cv' &&
        f.feature !== 'extract_job_offer_url' &&
        f.feature !== 'extract_job_offer_pdf' &&
        f.feature !== 'detect_language'
      )
      .reduce((sum, f) => sum + (f.cost || 0), 0);

    const cvGenerationCost = cvGenerationTotals?.totalCost || 0;
    const cvImprovementCost = cvImprovementTotals?.totalCost || 0;

    return otherFeaturesCost + cvGenerationCost + cvImprovementCost + extractionCost;
  }, [data?.byFeature, cvGenerationTotals, cvImprovementTotals]);

  // Computed: corrected total calls
  const correctedTotalCalls = useMemo(() => {
    if (!data?.byFeature) return 0;

    // Extraction features: compter les extractions (inclut detect_language)
    // detect_language est tracké séparément, donc on compte le nombre d'extractions
    // comme le nombre d'appels extract_job_offer_* (1 extraction = 1 appel extraction + 1 appel detect_language)
    const extractionOnlyCalls = data.byFeature
      .filter(f =>
        f.feature === 'extract_job_offer_url' ||
        f.feature === 'extract_job_offer_pdf'
      )
      .reduce((sum, f) => sum + (f.calls || 0), 0);
    // Le nombre d'extractions = nombre d'appels d'extraction (pas divisé par 2 car detect_language est maintenant séparé)
    const extractionCount = extractionOnlyCalls;

    const otherFeaturesCalls = data.byFeature
      .filter(f =>
        !f.feature.startsWith('cv_adaptation_') &&
        !f.feature.startsWith('cv_improvement_') &&
        f.feature !== 'cv_improvement' &&
        f.feature !== 'optimize_cv' &&
        f.feature !== 'extract_job_offer_url' &&
        f.feature !== 'extract_job_offer_pdf' &&
        f.feature !== 'detect_language'
      )
      .reduce((sum, f) => sum + (f.calls || 0), 0);

    const cvGenerationCalls = cvGenerationTotals?.totalCalls || 0;
    const cvImprovementCalls = cvImprovementTotals?.totalCalls || 0;

    return otherFeaturesCalls + cvGenerationCalls + cvImprovementCalls + extractionCount;
  }, [data?.byFeature, cvGenerationTotals, cvImprovementTotals]);

  // Stabilize top feature
  useEffect(() => {
    if (groupedFeatureData && groupedFeatureData.length > 0) {
      const newTopFeature = groupedFeatureData[0];
      setStableTopFeature(prev => {
        if (newTopFeature.feature !== prev.feature ||
            Math.abs(newTopFeature.cost - prev.cost) > 0.01) {
          return {
            feature: newTopFeature.feature,
            name: newTopFeature.name,
            cost: newTopFeature.cost,
          };
        }
        return prev;
      });
    }
  }, [groupedFeatureData]);

  return {
    // Main data
    data,
    loading,
    error,

    // Pricings
    pricings,
    setPricings,
    isPriorityMode,
    setIsPriorityMode,
    fetchPricings,

    // Balance
    balance,
    balanceLoading,

    // Alerts
    alerts,
    setAlerts,
    fetchAlerts,

    // Computed data
    groupedChartData,
    groupedFeatureData,
    correctedTotalCost,
    correctedTotalCalls,
    stableTopFeature,
  };
}
