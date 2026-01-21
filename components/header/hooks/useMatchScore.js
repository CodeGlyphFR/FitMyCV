"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { useBackgroundTasks } from "@/components/BackgroundTasksProvider";
import { parseApiError } from "@/lib/utils/errorHandler";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/**
 * Hook for managing match score state and fetching
 */
export function useMatchScore({ currentVersion }) {
  const { t } = useLanguage();
  const { localDeviceId } = useBackgroundTasks();
  const { addNotification } = useNotifications();

  const [matchScore, setMatchScore] = useState(null);
  const [scoreBefore, setScoreBefore] = useState(null);
  const [matchScoreStatus, setMatchScoreStatus] = useState("idle");
  const [optimiseStatus, setOptimiseStatus] = useState("idle");
  const [isLoadingMatchScore, setIsLoadingMatchScore] = useState(false);
  const [currentCvFile, setCurrentCvFile] = useState(null);
  const [hasJobOffer, setHasJobOffer] = useState(false);
  const [hasScoreBreakdown, setHasScoreBreakdown] = useState(false);

  // Ref pour tracker la version en cours de fetch (éviter race conditions)
  const fetchVersionRef = useRef(currentVersion);
  const abortControllerRef = useRef(null);

  const fetchMatchScore = useCallback(async () => {
    // Annuler la requête précédente si elle existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Créer un nouveau AbortController pour cette requête
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Capturer la version au moment de l'appel
    const versionAtFetchStart = currentVersion;
    fetchVersionRef.current = versionAtFetchStart;

    setIsLoadingMatchScore(true);
    try {
      // Récupérer le fichier CV actuel depuis le cookie
      const cookies = document.cookie.split(';');
      const cvFileCookie = cookies.find(c => c.trim().startsWith('cvFile='));
      if (!cvFileCookie) {
        setIsLoadingMatchScore(false);
        return;
      }

      const currentFile = decodeURIComponent(cvFileCookie.split('=')[1]);
      setCurrentCvFile(currentFile);

      // Cache-busting pour iOS - ajouter un timestamp
      const cacheBuster = Date.now();
      // Ajouter le paramètre version si on consulte une version historique
      const versionParam = versionAtFetchStart !== 'latest' ? `&version=${versionAtFetchStart}` : '';
      const response = await fetch(`/api/cv/match-score?file=${encodeURIComponent(currentFile)}${versionParam}&_=${cacheBuster}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        signal: abortController.signal
      });

      if (!response.ok) {
        setIsLoadingMatchScore(false);
        return;
      }

      const data = await response.json();

      // Vérifier que le CV ET la version n'ont pas changé entre temps
      const updatedCookies = document.cookie.split(';');
      const updatedCvFileCookie = updatedCookies.find(c => c.trim().startsWith('cvFile='));
      const updatedFile = updatedCvFileCookie ? decodeURIComponent(updatedCvFileCookie.split('=')[1]) : null;

      // Ignorer la réponse si la version a changé pendant le fetch
      if (fetchVersionRef.current !== versionAtFetchStart) {
        return;
      }

      if (updatedFile === currentFile) {
        const finalStatus = data.status || (data.score !== null ? 'idle' : 'idle');
        const finalOptimiseStatus = data.optimiseStatus || 'idle';

        setMatchScore(data.score);
        setScoreBefore(data.scoreBefore || null);
        setMatchScoreStatus(finalStatus);
        setOptimiseStatus(finalOptimiseStatus);
        setHasJobOffer(data.hasJobOffer || false);
        setHasScoreBreakdown(data.hasScoreBreakdown || false);

        // Force un re-render en utilisant un timeout (workaround iOS)
        setTimeout(() => {
          setIsLoadingMatchScore(false);
        }, 0);
      } else {
        setIsLoadingMatchScore(false);
      }
    } catch (error) {
      // Ignorer les erreurs d'abort (changement de version rapide)
      if (error.name === 'AbortError') {
        return;
      }
      setIsLoadingMatchScore(false);
    }
  }, [currentVersion]);

  const handleRefreshMatchScore = useCallback(async () => {
    // Mise à jour optimiste : passer immédiatement le status en loading
    setMatchScoreStatus('inprogress');
    setIsLoadingMatchScore(true);

    try {
      // Récupérer le fichier CV actuel depuis le cookie
      const cookies = document.cookie.split(';');
      const cvFileCookie = cookies.find(c => c.trim().startsWith('cvFile='));
      if (!cvFileCookie) {
        throw new Error("No CV file selected");
      }

      const currentFile = decodeURIComponent(cvFileCookie.split('=')[1]);

      // Envoyer la requête pour lancer le calcul
      const response = await fetch("/api/background-tasks/calculate-match-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cvFile: currentFile,
          isAutomatic: false,
          deviceId: localDeviceId,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const apiError = parseApiError(response, data);
        const errorObj = new Error(apiError.message);
        if (apiError.actionRequired && apiError.redirectUrl) {
          errorObj.actionRequired = true;
          errorObj.redirectUrl = apiError.redirectUrl;
        }
        throw errorObj;
      }
    } catch (error) {
      // En cas d'erreur, réinitialiser le status
      setMatchScoreStatus('idle');
      setIsLoadingMatchScore(false);

      const notification = {
        type: "error",
        message: error.message,
        duration: 10000,
      };

      if (error?.actionRequired && error?.redirectUrl) {
        notification.redirectUrl = error.redirectUrl;
        notification.linkText = 'Voir les options';
      }

      addNotification(notification);
    }
  }, [t, addNotification, localDeviceId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    matchScore,
    scoreBefore,
    matchScoreStatus,
    optimiseStatus,
    isLoadingMatchScore,
    currentCvFile,
    setCurrentCvFile,
    hasJobOffer,
    setHasJobOffer,
    hasScoreBreakdown,
    setHasScoreBreakdown,
    setMatchScore,
    setScoreBefore,
    setMatchScoreStatus,
    setOptimiseStatus,
    setIsLoadingMatchScore,
    fetchMatchScore,
    handleRefreshMatchScore,
  };
}
