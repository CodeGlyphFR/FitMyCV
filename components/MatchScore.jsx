"use client";
import React from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useSettings } from "@/lib/settings/SettingsContext";
import { RefreshCw } from "lucide-react";

export default function MatchScore({
  sourceType,
  sourceValue,
  score,
  status,
  isLoading = false,
  onRefresh,
  currentCvFile,
  hasExtractedJobOffer = false,
  isOptimizeButtonReady = false,
  optimiseStatus = "idle"
}) {
  const { t } = useLanguage();
  const { settings } = useSettings();
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
      setIsHovered(false);
      // Activer l'animation prolongée
      setIsDelayedLoading(true);
    }

    // Si le status passe à idle mais qu'on est en delayed loading
    if (wasLoading && isNowIdle && !isLoading && !isRefreshing) {
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
      setIsDelayedLoading(false);
    }

    prevOptimizeButtonReadyRef.current = isOptimizeButtonReady;
  }, [isOptimizeButtonReady, isDelayedLoading]);

  // WORKAROUND iOS: Forcer le re-render si on détecte un score valide alors qu'on est en loading
  React.useEffect(() => {
    if (score !== null && score !== prevScoreRef.current && (status === 'loading' || isLoading)) {

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
      setShowSuccessEffect(true);
      const timer = setTimeout(() => setShowSuccessEffect(false), 1000);

      // Déclencher un événement pour notifier que le score a été mis à jour
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


  // Afficher le composant uniquement si le CV a une analyse d'offre d'emploi en base ET si la feature est activée
  if (!hasExtractedJobOffer || !sourceValue || !settings.feature_match_score) {
    return null;
  }

  const handleRefresh = async () => {
    // Bloquer si chargement en cours ou optimisation en cours
    if (status === "loading" || isRefreshing || isRefreshingRef.current || optimiseStatus === "inprogress") {
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

  const getBorderColor = () => {
    if (status === "error") return "border-red-600";
    if (score === null) return "border-white/30";

    // Score exceptionnel > 90 : or
    if (score > 90) return "border-yellow-600";

    // 80-90 : vert
    if (score >= 80) return "border-green-600";

    // 50-80 : orange
    if (score >= 50) return "border-orange-500";

    // 10-50 : dégradé rouge -> orange
    if (score >= 40) return "border-orange-600";
    if (score >= 30) return "border-red-500";
    if (score >= 20) return "border-red-600";

    // 0-10 : rouge foncé
    return "border-red-700";
  };

  const isDisabled = shouldShowLoading;

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
      return `Score: ${score}`;
    }
    if (status === "error") {
      return t("matchScore.failed");
    }
    return t("matchScore.notCalculated");
  };

  return (
    <div className="no-print relative -ml-3">
      {/* Bulle principale */}
      <div
        data-onboarding="match-score"
        className={`
          relative w-12 h-12 rounded-full flex items-center justify-center
          bg-white/20 backdrop-blur-xl border-4 ${getBorderColor()} shadow-2xl
          ${!isDisabled && !isLoading ? "cursor-pointer" : "cursor-not-allowed"}
          transition-all duration-300
          ${showSuccessEffect ? "ring-4 ring-emerald-300" : ""}
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
                className={`text-base font-bold drop-shadow-lg ${
                  score > 90 && status !== "loading"
                    ? "bg-gold-gradient bg-[length:200%_100%] animate-gold-shimmer text-transparent bg-clip-text"
                    : getScoreColor() + " text-white"
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
              className="w-5 h-5 text-white opacity-80 drop-shadow"
              strokeWidth={2.5}
            />
          </div>
        )}

        {/* Icône de refresh en rotation pendant le chargement */}
        {shouldShowLoading && (
          <div className={`absolute inset-0 flex items-center justify-center animate-spin-slow shimmer`}>
            <RefreshCw
              className="w-5 h-5 text-white opacity-80 drop-shadow"
              strokeWidth={2.5}
            />
          </div>
        )}

        {/* Icône de refresh statique quand score non calculé */}
        {score === null && !shouldShowLoading && status !== "error" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw
              className="w-5 h-5 text-white opacity-80 drop-shadow"
              strokeWidth={2.5}
            />
          </div>
        )}
      </div>
    </div>
  );
}
