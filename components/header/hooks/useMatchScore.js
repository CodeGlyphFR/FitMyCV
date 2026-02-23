"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { useBackgroundTasks } from "@/components/providers/BackgroundTasksProvider";
import { parseApiError } from "@/lib/utils/errorHandler";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useRecaptcha } from "@/hooks/useRecaptcha";

/**
 * Hook for managing match score state and fetching
 */
export function useMatchScore({ currentVersion }) {
  const { t } = useLanguage();
  const { localDeviceId } = useBackgroundTasks();
  const { addNotification } = useNotifications();
  const { executeRecaptcha } = useRecaptcha();

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
  // Fetch-id counter : laisse toutes les requêtes compléter mais n'applique
  // que le résultat de la plus récente (élimine les problèmes d'AbortController sur mobile)
  const fetchIdRef = useRef(0);

  const fetchMatchScore = useCallback(async () => {
    // Incrémenter le counter — seul le résultat du fetch le plus récent sera appliqué
    const thisFetchId = ++fetchIdRef.current;

    // Capturer la version au moment de l'appel
    const versionAtFetchStart = currentVersion;
    fetchVersionRef.current = versionAtFetchStart;

    setIsLoadingMatchScore(true);
    try {
      // Récupérer le fichier CV actuel depuis le cookie
      const cookies = document.cookie.split(';');
      const cvFileCookie = cookies.find(c => c.trim().startsWith('cvFile='));
      if (!cvFileCookie) {
        if (fetchIdRef.current === thisFetchId) setIsLoadingMatchScore(false);
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
      });

      // Ignorer si un fetch plus récent a été lancé entre-temps
      if (fetchIdRef.current !== thisFetchId) return;

      if (!response.ok) {
        setIsLoadingMatchScore(false);
        return;
      }

      const data = await response.json();

      // Re-vérifier après le parsing JSON (un autre fetch a pu être lancé pendant le parse)
      if (fetchIdRef.current !== thisFetchId) return;

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

        // Ne pas arrêter le loading si le calcul est encore en cours
        // (le SSE cv:updated du beforeRun arrive avant la fin du calcul)
        if (finalStatus !== 'inprogress') {
          setTimeout(() => {
            setIsLoadingMatchScore(false);
          }, 0);
        }
      } else {
        setIsLoadingMatchScore(false);
      }
    } catch (error) {
      // Ignorer les erreurs si un fetch plus récent est en cours
      if (fetchIdRef.current !== thisFetchId) return;
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

      // Obtenir le token reCAPTCHA
      const recaptchaToken = await executeRecaptcha('calculate_match_score');

      // Envoyer la requête pour lancer le calcul
      const response = await fetch("/api/background-tasks/calculate-match-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cvFile: currentFile,
          isAutomatic: false,
          deviceId: localDeviceId,
          recaptchaToken,
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
  }, [t, addNotification, localDeviceId, executeRecaptcha]);

  // Cleanup on unmount : invalider le fetch-id pour que les requêtes en vol soient ignorées
  useEffect(() => {
    return () => {
      fetchIdRef.current++;
    };
  }, []);

  // Polling autonome : quand le calcul est en cours, interroger l'API
  // directement toutes les 3s avec son propre fetch (bypass fetchIdRef).
  // Sur mobile, le SSE tombe silencieusement et les 9 autres callers de
  // fetchMatchScore() se cannibalisent via le fetchIdRef counter.
  useEffect(() => {
    if (matchScoreStatus !== 'inprogress') return;

    let active = true;

    const poll = async () => {
      try {
        const cookies = document.cookie.split(';');
        const cvFileCookie = cookies.find(c => c.trim().startsWith('cvFile='));
        if (!cvFileCookie || !active) return;

        const file = decodeURIComponent(cvFileCookie.split('=')[1]);
        const res = await fetch(
          `/api/cv/match-score?file=${encodeURIComponent(file)}&_=${Date.now()}`,
          { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }
        );

        if (!active || !res.ok) return;
        const data = await res.json();
        if (!active) return;

        const status = data.status || 'idle';
        // Appliquer uniquement quand le score est prêt (pas pendant inprogress)
        if (status !== 'inprogress' && data.score != null) {
          // Invalider les fetchMatchScore() en vol pour éviter qu'ils n'écrasent
          fetchIdRef.current++;
          setMatchScore(data.score);
          setScoreBefore(data.scoreBefore || null);
          setMatchScoreStatus(status);
          setOptimiseStatus(data.optimiseStatus || 'idle');
          setHasJobOffer(data.hasJobOffer || false);
          setHasScoreBreakdown(data.hasScoreBreakdown || false);
          setIsLoadingMatchScore(false);
        }
      } catch {
        // Silencieux — le prochain tick réessaiera
      }
    };

    const pollInterval = setInterval(poll, 3000);

    return () => {
      active = false;
      clearInterval(pollInterval);
    };
  }, [matchScoreStatus]);

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
