import { useState, useCallback } from "react";

/**
 * Hook pour récupérer les détails complets d'une offre d'emploi
 * Utilisé par le modal JobOfferDetailModal
 */
export function useJobOfferDetails() {
  const [jobOfferDetails, setJobOfferDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchJobOfferDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cv/source?full=true");
      if (!res.ok) {
        throw new Error("Erreur lors du chargement des détails de l'offre");
      }
      const data = await res.json();
      setJobOfferDetails(data.jobOfferInfo);
      return data.jobOfferInfo;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetJobOfferDetails = useCallback(() => {
    setJobOfferDetails(null);
    setError(null);
  }, []);

  return {
    jobOfferDetails,
    isLoading,
    error,
    fetchJobOfferDetails,
    resetJobOfferDetails,
  };
}
