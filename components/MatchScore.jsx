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
  currentCvFile
}) {
  const { t } = useLanguage();
  const [isHovered, setIsHovered] = React.useState(false);
  const [showSuccessEffect, setShowSuccessEffect] = React.useState(false);
  const prevStatusRef = React.useRef(status);
  const prevCvFileRef = React.useRef(currentCvFile);

  // Réinitialiser les états visuels lors d'un changement de CV
  React.useEffect(() => {
    if (prevCvFileRef.current !== currentCvFile) {
      setIsHovered(false);
      setShowSuccessEffect(false);
      prevCvFileRef.current = currentCvFile;
    }
  }, [currentCvFile]);

  // Effet de succès quand le score est calculé (détection de transition loading -> idle avec score)
  React.useEffect(() => {
    if (prevStatusRef.current === "loading" && status === "idle" && score !== null) {
      setShowSuccessEffect(true);
      const timer = setTimeout(() => setShowSuccessEffect(false), 1000);
      return () => clearTimeout(timer);
    }
    prevStatusRef.current = status;
  }, [status, score]);

  // Afficher le composant uniquement si le CV a été généré depuis un lien
  if (sourceType !== "link" || !sourceValue) {
    return null;
  }

  const handleRefresh = async () => {
    if (!canRefresh || status === "loading") {
      return;
    }

    try {
      await onRefresh();
    } catch (error) {
      console.error("Erreur lors du rafraîchissement du score:", error);
    }
  };

  const getDisplayText = () => {
    if (status === "loading") {
      return "";
    }
    if (status === "error") {
      return "Échec";
    }
    if (score === null) {
      return "?";
    }
    return `${score}`;
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
    if (!canRefresh) {
      return t("matchScore.resetIn", { hours: hoursUntilReset, minutes: minutesUntilReset });
    }
    return `${score}/100`;
  };

  const isDisabled = status === "loading" || !canRefresh;

  // Calculer le nombre de refresh restants
  const refreshesLeft = 5 - refreshCount;

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
    <div className="no-print relative -ml-5">
      {/* Bulle principale */}
      <div
        className={`
          relative w-16 h-16 rounded-full flex items-center justify-center
          bg-white shadow-[0_0_15px_rgba(0,0,0,0.2)]
          ${!isDisabled && !isLoading ? "cursor-pointer" : "cursor-not-allowed"}
          transition-all duration-300
          ${showSuccessEffect ? "ring-4 ring-green-300" : ""}
        `}
        onClick={handleRefresh}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Contenu de la bulle (score) */}
        <div
          className={`
            absolute inset-0 flex flex-col items-center justify-center rounded-full
            transition-all duration-300
            ${(isHovered || status === "loading" || (score === null && status !== "error")) && !isDisabled ? "blur-sm" : "blur-0"}
          `}
        >
          {score !== null && (
            <>
              <div className="relative flex items-center justify-center">
                <span
                  className={`text-xl font-bold ${
                    score > 90 && status !== "loading"
                      ? "bg-gold-gradient bg-[length:200%_100%] animate-gold-shimmer text-transparent bg-clip-text"
                      : getScoreColor()
                  }`}
                >
                  {getDisplayText()}
                </span>
              </div>
              {status !== "error" && status !== "loading" && (
                <span className="text-[10px] text-gray-500">/100</span>
              )}
            </>
          )}
        </div>

        {/* Icône de refresh au survol (seulement si score existe et pas en loading) */}
        {isHovered && !isDisabled && status !== "loading" && score !== null && (
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw
              className="w-6 h-6 text-gray-600 opacity-60"
              strokeWidth={2.5}
            />
          </div>
        )}

        {/* Icône de refresh en rotation pendant le chargement */}
        {status === "loading" && (
          <div className={`absolute inset-0 flex items-center justify-center animate-spin-slow shimmer`}>
            <RefreshCw
              className="w-6 h-6 text-gray-600 opacity-60"
              strokeWidth={2.5}
            />
          </div>
        )}

        {/* Icône de refresh statique quand score non calculé */}
        {score === null && status !== "loading" && status !== "error" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw
              className="w-6 h-6 text-gray-600 opacity-60"
              strokeWidth={2.5}
            />
          </div>
        )}
      </div>

      {/* Petite bulle avec le nombre de refresh restants */}
      {refreshCount >= 0 && !isLoading && (
        <div
          className={`
            absolute -top-1 -right-1 w-6 h-6 rounded-full
            ${getBadgeColor()}
            flex items-center justify-center
            text-white text-xs font-bold
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
