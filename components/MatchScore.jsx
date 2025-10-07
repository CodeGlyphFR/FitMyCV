"use client";
import React from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { RefreshCw } from "lucide-react";

export default function MatchScore({
  sourceType,
  sourceValue,
  score,
  status,
  isLoading = false,
  canRefresh,
  refreshCount,
  hoursUntilReset,
  minutesUntilReset,
  onRefresh,
  currentCvFile,
  hasExtractedJobOffer = false,
  isOptimizeButtonReady = false,
  optimiseStatus = "idle"
}) {
  const { t } = useLanguage();
  const [isHovered, setIsHovered] = React.useState(false);
  const [showSuccessEffect, setShowSuccessEffect] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isDelayedLoading, setIsDelayedLoading] = React.useState(false);
  const prevStatusRef = React.useRef(status);
  const prevCvFileRef = React.useRef(currentCvFile);
  const isRefreshingRef = React.useRef(false);
  const prevScoreRef = React.useRef(score);
  const prevOptimizeButtonReadyRef = React.useRef(isOptimizeButtonReady);
  const delayTimeoutRef = React.useRef(null);

  // Réinitialiser les états visuels lors d'un changement de CV
  React.useEffect(() => {
    if (prevCvFileRef.current !== currentCvFile) {
      setIsHovered(false);
      setShowSuccessEffect(false);
      setIsDelayedLoading(false);
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
        delayTimeoutRef.current = null;
      }
      prevCvFileRef.current = currentCvFile;
    }
  }, [currentCvFile]);

  // Gérer l'animation qui continue jusqu'à ce que le bouton Optimiser soit disponible
  React.useEffect(() => {
    const wasIdle = prevStatusRef.current === "idle" || prevStatusRef.current === null;
    const isNowLoading = status === "loading" || status === "inprogress";
    const wasLoading = prevStatusRef.current === "loading" || prevStatusRef.current === "inprogress";
    const isNowIdle = status === "idle" || status === null;

    // Si on commence à charger, forcer la sortie du hover (fix iOS)
    if (wasIdle && isNowLoading) {
      console.log('[MatchScore] 🔄 Début du chargement, sortie du hover...');
      setIsHovered(false);
      // Activer l'animation prolongée
      setIsDelayedLoading(true);
    }

    // Si le status passe à idle mais qu'on est en delayed loading
    if (wasLoading && isNowIdle && !isLoading && !isRefreshing) {
      console.log('[MatchScore] 🕐 Status passé à idle, animation continue jusqu\'à l\'apparition du bouton Optimiser...');
      // isDelayedLoading reste à true jusqu'à ce que hasScoreBreakdown devienne true
    }

    // Mettre à jour la ref pour la prochaine fois
    prevStatusRef.current = status;
  }, [status, isLoading, isRefreshing]);

  // Arrêter l'animation quand le bouton Optimiser devient actif (visible ET cliquable)
  React.useEffect(() => {
    const wasNotReady = !prevOptimizeButtonReadyRef.current;
    const isNowReady = isOptimizeButtonReady;

    if (wasNotReady && isNowReady && isDelayedLoading) {
      console.log('[MatchScore] ✅ Bouton Optimiser actif, arrêt de l\'animation...');
      setIsDelayedLoading(false);
    }

    prevOptimizeButtonReadyRef.current = isOptimizeButtonReady;
  }, [isOptimizeButtonReady, isDelayedLoading]);

  // WORKAROUND iOS: Forcer le re-render si on détecte un score valide alors qu'on est en loading
  React.useEffect(() => {
    if (score !== null && score !== prevScoreRef.current && (status === 'loading' || isLoading)) {
      console.log('[MatchScore] 🔄 iOS fix: Score reçu mais status=loading, forçage re-render...');

      // Déclencher un événement pour forcer le parent à se rafraîchir
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('matchscore:force-refresh', {
          detail: { score, cvFile: currentCvFile }
        }));
      }
    }
    prevScoreRef.current = score;
  }, [score, status, isLoading, currentCvFile]);

  // Effet de succès quand le score est calculé (détection de transition score null -> score valide)
  React.useEffect(() => {
    const hasValidScore = score !== null && score !== undefined;
    const scoreChanged = prevScoreRef.current !== score;

    if (hasValidScore && scoreChanged) {
      console.log('[MatchScore] 🎉 Score calculé avec succès:', score);
      setShowSuccessEffect(true);
      const timer = setTimeout(() => setShowSuccessEffect(false), 1000);

      // Déclencher un événement pour notifier que le score a été mis à jour
      console.log('[MatchScore] Déclenchement événement score:updated', { cvFile: currentCvFile, score });
      window.dispatchEvent(new CustomEvent('score:updated', {
        detail: { cvFile: currentCvFile, score, status }
      }));

      return () => clearTimeout(timer);
    }
  }, [status, score, currentCvFile]);

  // Détecter si on est vraiment en train de charger (score ou optimisation)
  const isActuallyLoading = (status === "loading" || isLoading || isRefreshing || optimiseStatus === "inprogress");
  const isStuckLoading = score !== null && !isLoading && status !== "loading" && !isRefreshing && optimiseStatus !== "inprogress";
  const shouldShowLoading = (isActuallyLoading && !isStuckLoading) || isDelayedLoading;

  // Debug logging
  React.useEffect(() => {
    console.log('[MatchScore] État de chargement:', {
      status,
      isLoading,
      isRefreshing,
      isDelayedLoading,
      optimiseStatus,
      score,
      isActuallyLoading,
      isStuckLoading,
      shouldShowLoading
    });
  }, [status, isLoading, isRefreshing, isDelayedLoading, optimiseStatus, score, isActuallyLoading, isStuckLoading, shouldShowLoading]);

  // Afficher le composant uniquement si le CV a une analyse d'offre d'emploi en base
  if (!hasExtractedJobOffer || !sourceValue) {
    return null;
  }

  const handleRefresh = async () => {
    // Vérifier avec le ref pour bloquer immédiatement (avant que l'état ne se mette à jour)
    // Aussi bloquer si une optimisation est en cours
    if (!canRefresh || status === "loading" || isRefreshing || isRefreshingRef.current || optimiseStatus === "inprogress") {
      return;
    }

    // Bloquer immédiatement avec le ref
    isRefreshingRef.current = true;
    setIsRefreshing(true);

    // Force la sortie du hover (fix iOS qui garde le hover après touch)
    setIsHovered(false);

    try {
      await onRefresh();
    } catch (error) {
      console.error("Erreur lors du rafraîchissement du score:", error);
    } finally {
      setIsRefreshing(false);
      isRefreshingRef.current = false;
    }
  };

  const getDisplayText = () => {
    // WORKAROUND iOS: Si on a un score valide, l'afficher même si status=loading
    // (bug iOS où le status reste bloqué à loading)
    if (score !== null && score !== undefined) {
      return `${score}`;
    }
    if (status === "loading") {
      return "";
    }
    if (status === "error") {
      return "Échec";
    }
    return "?";
  };

  const getScoreColor = () => {
    if (status === "error") return "text-red-600";
    if (score === null) return "text-gray-500";

    // Score exceptionnel > 90 : or avec effet scintillant
    if (score > 90) return "text-yellow-600";

    // 80-90 : vert
    if (score >= 80) return "text-green-600";

    // 50-80 : orange
    if (score >= 50) return "text-orange-500";

    // 10-50 : dégradé rouge -> orange
    if (score >= 40) return "text-orange-600";
    if (score >= 30) return "text-red-500";
    if (score >= 20) return "text-red-600";

    // 0-10 : rouge foncé
    return "text-red-700";
  };

  const isDisabled = shouldShowLoading || !canRefresh;

  // refreshCount représente maintenant directement les tokens restants
  const refreshesLeft = refreshCount;

  const getScoreTooltip = () => {
    // Si optimisation en cours
    if (optimiseStatus === "inprogress") {
      return t("cvImprovement.improving") || "Amélioration en cours...";
    }
    // Si on charge actuellement, afficher "Calcul en cours"
    if (shouldShowLoading) {
      return t("matchScore.calculating");
    }
    // WORKAROUND iOS: Si on a un score, montrer le score même si status=loading
    if (score !== null && score !== undefined) {
      if (!canRefresh) {
        // Si plus de tokens disponibles (refreshesLeft === 0)
        if (refreshesLeft === 0) {
          return t("matchScore.noTokensLeft");
        }
        return t("matchScore.resetIn", { hours: hoursUntilReset, minutes: minutesUntilReset });
      }
      return `Score: ${score}`;
    }
    if (status === "error") {
      return t("matchScore.failed");
    }
    return t("matchScore.notCalculated");
  };

  // Déterminer la couleur de la petite bulle selon les refresh restants
  const getBadgeColor = () => {
    if (refreshesLeft === 0) return "bg-gray-400";
    if (refreshesLeft === 1) return "bg-red-500";
    if (refreshesLeft === 2) return "bg-orange-500";
    if (refreshesLeft === 3) return "bg-yellow-500";
    if (refreshesLeft === 4) return "bg-lime-500";
    return "bg-green-500";
  };

  return (
    <div className="no-print relative -ml-3">
      {/* Bulle principale */}
      <div
        className={`
          relative w-12 h-12 rounded-full flex items-center justify-center
          bg-white shadow-[0_0_15px_rgba(0,0,0,0.2)]
          ${!isDisabled && !isLoading ? "cursor-pointer" : "cursor-not-allowed"}
          transition-all duration-300
          ${showSuccessEffect ? "ring-4 ring-green-300" : ""}
        `}
        onClick={handleRefresh}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={getScoreTooltip()}
      >
        {/* Contenu de la bulle (score) */}
        <div
          className={`
            absolute inset-0 flex flex-col items-center justify-center rounded-full
            transition-all duration-300
            ${shouldShowLoading || (isHovered && !isDisabled) || (score === null && status !== "error" && !isDisabled) ? "blur-sm" : "blur-0"}
          `}
        >
          {score !== null && (
            <div className="relative flex items-center justify-center">
              <span
                className={`text-base font-bold ${
                  score > 90 && status !== "loading"
                    ? "bg-gold-gradient bg-[length:200%_100%] animate-gold-shimmer text-transparent bg-clip-text"
                    : getScoreColor()
                }`}
              >
                {getDisplayText()}
              </span>
            </div>
          )}
        </div>

        {/* Icône de refresh au survol (seulement si score existe et pas en loading) */}
        {isHovered && !isDisabled && !shouldShowLoading && score !== null && (
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw
              className="w-5 h-5 text-gray-600 opacity-60"
              strokeWidth={2.5}
            />
          </div>
        )}

        {/* Icône de refresh en rotation pendant le chargement */}
        {shouldShowLoading && (
          <div className={`absolute inset-0 flex items-center justify-center animate-spin-slow shimmer`}>
            <RefreshCw
              className="w-5 h-5 text-gray-600 opacity-60"
              strokeWidth={2.5}
            />
          </div>
        )}

        {/* Icône de refresh statique quand score non calculé */}
        {score === null && !shouldShowLoading && status !== "error" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw
              className="w-5 h-5 text-gray-600 opacity-60"
              strokeWidth={2.5}
            />
          </div>
        )}
      </div>

      {/* Petite bulle avec le nombre de refresh restants */}
      {refreshCount >= 0 && !shouldShowLoading && (
        <div
          className={`
            absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full
            ${getBadgeColor()}
            flex items-center justify-center
            text-white text-[10px] font-bold
            shadow-md border-2 border-white
            transition-all duration-300
          `}
        >
          {refreshesLeft}
        </div>
      )}
    </div>
  );
}
