"use client";
import React from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

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
  onRefresh
}) {
  const { t } = useLanguage();
  const [loadingDots, setLoadingDots] = React.useState(".");

  // Animation des points pendant le chargement
  React.useEffect(() => {
    if (status === "loading") {
      const interval = setInterval(() => {
        setLoadingDots(prev => {
          if (prev === ".") return "..";
          if (prev === "..") return "...";
          return ".";
        });
      }, 500);
      return () => clearInterval(interval);
    }
  }, [status]);

  // Afficher le composant uniquement si le CV a été généré depuis un lien
  if (sourceType !== "link" || !sourceValue) {
    return null;
  }

  const handleRefresh = async () => {
    if (!canRefresh || status === "loading") {
      return; // Déjà bloqué par le parent ou en cours de calcul
    }

    try {
      await onRefresh();
    } catch (error) {
      console.error("Erreur lors du rafraîchissement du score:", error);
    }
  };

  const getDisplayText = () => {
    if (status === "loading") {
      return loadingDots;
    }
    if (status === "error") {
      return t("matchScore.failed");
    }
    if (score === null) {
      return "Calcule moi !";
    }
    return `${score}/100`;
  };

  const getScoreTooltip = () => {
    if (status === "loading") {
      return t("matchScore.calculating");
    }
    if (status === "error") {
      return t("matchScore.failed");
    }
    if (score === null) {
      return t("matchScore.notCalculated");
    }
    return `${score}/100`;
  };

  const isDisabled = status === "loading" || !canRefresh;

  const getButtonTitle = () => {
    if (!canRefresh) {
      return t("matchScore.resetIn", { hours: hoursUntilReset, minutes: minutesUntilReset });
    }
    return t("matchScore.refresh");
  };

  // Calculer le nombre de refresh restants
  const refreshesLeft = 5 - refreshCount;

  // Déterminer la couleur de la bulle selon les refresh restants
  const getBubbleColor = () => {
    if (refreshesLeft === 0) return "bg-red-500 text-white";
    if (refreshesLeft <= 2) return "bg-orange-500 text-white";
    return "bg-blue-500 text-white";
  };

  return (
    <div className={`no-print flex items-center gap-2 text-sm transition-opacity duration-200 ${isLoading ? "opacity-40 blur-sm" : "opacity-100"}`}>
      <span
        className={`font-medium ${status === "error" ? "text-red-600" : "text-gray-700"} cursor-help`}
        title={getScoreTooltip()}
      >
        {getDisplayText()}
      </span>
      <div className="relative">
        <button
          onClick={handleRefresh}
          disabled={isDisabled || isLoading}
          className={`inline-flex items-center justify-center w-6 h-6 rounded-full border bg-white transition-all duration-200 ${
            isDisabled || isLoading
              ? "cursor-not-allowed opacity-40"
              : "cursor-pointer hover:bg-gray-50 hover:shadow hover:scale-110"
          } ${status === "loading" ? "animate-spin" : ""}`}
          type="button"
          title={getButtonTitle()}
        >
          🔄
        </button>
        {/* Bulle avec le décompte des refresh restants */}
        {refreshCount >= 0 && !isLoading && (
          <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full ${getBubbleColor()} flex items-center justify-center text-[10px] font-bold shadow-sm`}>
            {refreshesLeft}
          </div>
        )}
      </div>
    </div>
  );
}
