"use client";
import React from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function MatchScore({
  sourceType,
  sourceValue,
  score,
  status,
  canRefresh,
  refreshCount,
  minutesUntilReset,
  onRefresh
}) {
  const { t } = useLanguage();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Afficher le composant uniquement si le CV a été généré depuis un lien
  if (sourceType !== "link" || !sourceValue) {
    return null;
  }

  const handleRefresh = async () => {
    if (!canRefresh) {
      return; // Déjà bloqué par le parent
    }

    setIsRefreshing(true);

    try {
      await onRefresh();
    } catch (error) {
      console.error("Erreur lors du rafraîchissement du score:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getDisplayText = () => {
    if (status === "loading") {
      return t("matchScore.calculating");
    }
    if (status === "error") {
      return t("matchScore.failed");
    }
    if (score === null) {
      return t("matchScore.notCalculated");
    }
    return t("matchScore.score", { score });
  };

  const isDisabled = isRefreshing || !canRefresh;

  const getButtonTitle = () => {
    if (!canRefresh) {
      return t("matchScore.rateLimitReached", { minutes: minutesUntilReset });
    }
    if (refreshCount > 0) {
      return t("matchScore.refreshWithCount", { count: refreshCount, limit: 5 });
    }
    return t("matchScore.refresh");
  };

  return (
    <div className="no-print flex items-center gap-2 text-sm">
      <span className={`font-medium ${status === "error" ? "text-red-600" : "text-gray-700"}`}>
        {getDisplayText()}
      </span>
      <button
        onClick={handleRefresh}
        disabled={isDisabled}
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full border bg-white transition-all duration-200 ${
          isDisabled
            ? "cursor-not-allowed opacity-40"
            : "cursor-pointer hover:bg-gray-50 hover:shadow hover:scale-110"
        } ${isRefreshing ? "animate-spin" : ""}`}
        type="button"
        title={getButtonTitle()}
      >
        🔄
      </button>
      {refreshCount > 0 && canRefresh && (
        <span className="text-xs text-gray-500">({refreshCount}/5)</span>
      )}
    </div>
  );
}
