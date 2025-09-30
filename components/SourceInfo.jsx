"use client";
import React from "react";

export default function SourceInfo({ sourceType, sourceValue }) {
  if (!sourceType) return null;

  const getTooltipText = () => {
    if (sourceType === "link") {
      return `Créé depuis le lien :\n${sourceValue}`;
    }
    if (sourceType === "pdf") {
      return `Créé depuis le fichier PDF :\n${sourceValue}`;
    }
    return "";
  };

  const handleClick = () => {
    if (sourceType === "link" && sourceValue) {
      window.open(sourceValue, "_blank", "noopener,noreferrer");
    }
  };

  const isClickable = sourceType === "link";

  return (
    <button
      onClick={handleClick}
      className={`no-print inline-flex items-center justify-center w-6 h-6 rounded-full border bg-blue-50 text-blue-600 text-xs font-bold ${
        isClickable ? "cursor-pointer hover:bg-blue-100 hover:shadow" : "cursor-default"
      }`}
      title={getTooltipText()}
      type="button"
    >
      i
    </button>
  );
}
