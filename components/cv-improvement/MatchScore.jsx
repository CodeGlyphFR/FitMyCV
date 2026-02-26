"use client";
import React from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useSettings } from "@/lib/settings/SettingsContext";
import { RefreshCw } from "lucide-react";
import { useCreditCost } from "@/hooks/useCreditCost";

export default function MatchScore({
  sourceType,
  sourceValue,
  score,
  scoreBefore = null,
  status,
  isLoading = false,
  onRefresh,
  currentCvFile,
  hasJobOffer = false,
  isOptimizeButtonReady = false,
  optimiseStatus = "idle",
  isHistoricalVersion = false
}) {
  const { t } = useLanguage();
  const { settings } = useSettings();
  const { showCosts, getCost } = useCreditCost();
  const matchScoreCost = getCost("match_score");
  const [isHovered, setIsHovered] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const prevStatusRef = React.useRef(status);
  const prevCvFileRef = React.useRef(currentCvFile);
  const isRefreshingRef = React.useRef(false);

  // Réinitialiser les états visuels lors d'un changement de CV
  React.useEffect(() => {
    if (prevCvFileRef.current !== currentCvFile) {
      setIsHovered(false);
      prevCvFileRef.current = currentCvFile;
    }
  }, [currentCvFile]);

  // Forcer la sortie du hover quand le chargement commence (fix iOS)
  React.useEffect(() => {
    const wasIdle = prevStatusRef.current === "idle" || prevStatusRef.current === null;
    const isNowLoading = status === "loading" || status === "inprogress";

    if (wasIdle && isNowLoading) {
      setIsHovered(false);
    }

    prevStatusRef.current = status;
  }, [status]);

  // Détecter si on est vraiment en train de charger (score ou optimisation)
  // Note: isLoading (fetchMatchScore en cours) est ignoré quand on a déjà un score,
  // pour éviter que les backup fetches ne flashent le score existant
  const isActuallyLoading = (status === "loading" || isLoading || isRefreshing || optimiseStatus === "inprogress");
  const isStuckLoading = score !== null && status !== "loading" && !isRefreshing && optimiseStatus !== "inprogress";
  const shouldShowLoading = isActuallyLoading && !isStuckLoading;

  // Afficher le composant uniquement si le CV a une offre d'emploi associée ET si la feature est activée
  if (!hasJobOffer || !sourceValue || !settings.feature_match_score) {
    return null;
  }

  const handleRefresh = async () => {
    // Bloquer si chargement en cours, optimisation en cours, ou version historique
    if (status === "loading" || isRefreshing || isRefreshingRef.current || optimiseStatus === "inprogress" || isHistoricalVersion) {
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
    if (score > 90) return "text-yellow-600";
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-orange-500";
    if (score >= 40) return "text-orange-600";
    if (score >= 30) return "text-red-500";
    if (score >= 20) return "text-red-600";
    return "text-red-700";
  };

  const getBorderColor = () => {
    if (status === "error") return "border-red-600";
    if (score === null) return "border-white/30";
    if (score > 90) return "border-yellow-600";
    if (score >= 80) return "border-green-600";
    if (score >= 50) return "border-orange-500";
    if (score >= 40) return "border-orange-600";
    if (score >= 30) return "border-red-500";
    if (score >= 20) return "border-red-600";
    return "border-red-700";
  };

  const isDisabled = shouldShowLoading || isHistoricalVersion;

  const getScoreTooltip = () => {
    if (isHistoricalVersion) {
      return score !== null ? `Score: ${score} (ancien)` : t("matchScore.notCalculated");
    }
    if (optimiseStatus === "inprogress") {
      return t("cvImprovement.improving") || "Amélioration en cours...";
    }
    if (shouldShowLoading) {
      return t("matchScore.calculating");
    }
    if (status === "error") {
      return t("matchScore.failed");
    }
    if (showCosts && matchScoreCost > 0) {
      return t("credits.useCredits", { count: matchScoreCost }) || `Utiliser ${matchScoreCost} Cr.`;
    }
    return t("matchScore.refresh") || "Recalculer";
  };

  return (
    <div className="no-print relative -ml-3">
      {/* Bulle principale — PAS de backdrop-blur-xl (crée un contexte de compositing */}
      {/* GPU sur iOS Safari qui empêche le repaint des éléments enfants) */}
      <div
        data-onboarding="match-score"
        className={`
          relative w-12 h-12 rounded-full flex items-center justify-center
          bg-white/30 border-4 ${isHistoricalVersion ? 'border-white/30' : getBorderColor()} shadow-2xl
          ${!isDisabled && !isLoading ? "cursor-pointer" : "cursor-not-allowed"}
          transition-[border-color] duration-300
          ${isHistoricalVersion ? "opacity-60" : ""}
        `}
        onClick={handleRefresh}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={getScoreTooltip()}
      >
        {/* Conteneur unique toujours visible — jamais basculé hidden/visible */}
        {/* transform-gpu isole la couche de compositing du backdrop-blur-xl du header parent */}
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full">
          {shouldShowLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : score !== null && score !== undefined ? (
            <>
              {scoreBefore !== null && scoreBefore !== score && (
                <span className="text-[9px] text-white/50 line-through leading-none -mb-0.5">
                  {scoreBefore}
                </span>
              )}
              <span
                className={`text-base font-bold drop-shadow-lg ${
                  isHistoricalVersion
                    ? "text-white/70"
                    : score > 90 && status !== "loading"
                      ? "bg-gold-gradient bg-[length:200%_100%] animate-gold-shimmer text-transparent bg-clip-text"
                      : getScoreColor() + " text-white"
                }`}
              >
                {score}
              </span>
            </>
          ) : (
            <RefreshCw
              className="w-5 h-5 text-white opacity-80 drop-shadow"
              strokeWidth={2.5}
            />
          )}
        </div>

        {/* Overlay subtil au survol pour indiquer le clic */}
        {isHovered && !isDisabled && !shouldShowLoading && score !== null && (
          <div className="absolute inset-0 bg-black/20 rounded-full" />
        )}
      </div>
    </div>
  );
}
