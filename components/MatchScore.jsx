"use client";
import React from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function MatchScore({ sourceType, sourceValue, score, status, onRefresh }) {
  const { t } = useLanguage();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Afficher le composant uniquement si le CV a été généré depuis un lien
  if (sourceType !== "link" || !sourceValue) {
    return null;
  }

  const handleRefresh = async () => {
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

  return (
    <div className="no-print flex items-center gap-2 text-sm">
      <span className={`font-medium ${status === "error" ? "text-red-600" : "text-gray-700"}`}>
        {getDisplayText()}
      </span>
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full border bg-white hover:bg-gray-50 hover:shadow transition-all duration-200 ${
          isRefreshing ? "animate-spin cursor-not-allowed opacity-50" : "cursor-pointer hover:scale-110"
        }`}
        type="button"
        title={t("matchScore.refresh")}
      >
        🔄
      </button>
    </div>
  );
}
