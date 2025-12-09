import React from "react";
import GptLogo from "@/components/ui/GptLogo";
import DefaultCvIcon from "@/components/ui/DefaultCvIcon";
import { toTitleCase } from "@/lib/utils/textFormatting";

/**
 * Formate une date au format DD/MM/YYYY (FR) ou MM/DD/YYYY (EN)
 */
export function formatDateLabel(value, language = 'fr') {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  // Format selon la langue : FR = DD/MM/YYYY, EN = MM/DD/YYYY
  if (language === 'en') {
    return `${month}/${day}/${year}`;
  }
  return `${day}/${month}/${year}`;
}

/**
 * Normalise une valeur en booléen
 */
export function normalizeBoolean(value) {
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
  }
  return Boolean(value);
}

/**
 * Retourne l'icône appropriée selon le type de création du CV
 */
export function getCvIcon(createdBy, originalCreatedBy, className) {
  // createdBy = 'translate-cv' => Translate icon (traduit)
  // createdBy = 'generate-cv' => GPT icon (généré par IA)
  // createdBy = 'create-template' => GPT icon (CV modèle créé par IA)
  // createdBy = 'generate-cv-job-title' => Search icon (CV généré depuis titre de poste)
  // createdBy = 'improve-cv' => Rocket icon (CV amélioré par IA)
  // createdBy = 'import-pdf' => Import icon (importé depuis PDF)
  // createdBy = null => Add icon (créé manuellement)
  if (createdBy === 'translate-cv') {
    return <img src="/icons/translate.png" alt="Translate" className={className} loading="eager" />;
  }
  if (createdBy === 'improve-cv') {
    return <span className={className}>🚀</span>; // Icône fusée pour CV amélioré
  }
  if (createdBy === 'generate-cv-job-title') {
    return <img src="/icons/search.png" alt="Search" className={className} loading="eager" />;
  }
  if (createdBy === 'generate-cv' || createdBy === 'create-template') {
    return <GptLogo className={className} />;
  }
  if (createdBy === 'import-pdf') {
    return <img src="/icons/import.png" alt="Import" className={className} loading="eager" />;
  }
  // CVs manuels (créés from scratch)
  return <img src="/icons/add.png" alt="Add" className={className} loading="eager" />;
}

/**
 * Enrichit un item CV avec des métadonnées calculées
 */
export function enhanceItem(item, titleCache = null, fallbackTitle = "CV") {
  const trimmedTitle = typeof item?.title === "string" ? item.title.trim() : "";
  const fileId = typeof item?.file === "string" ? item.file : null;

  let effectiveTitle = trimmedTitle;

  if (!effectiveTitle && titleCache && fileId) {
    const cachedTitle = titleCache.get(fileId);
    if (cachedTitle) {
      effectiveTitle = cachedTitle;
    }
  }

  const isGpt = normalizeBoolean(item?.isGpt);
  const hasTitle = effectiveTitle.length > 0;
  const displayTitle = hasTitle ? toTitleCase(effectiveTitle) : fallbackTitle;
  if (titleCache && hasTitle && fileId) {
    titleCache.set(fileId, effectiveTitle);
  }

  // Don't calculate displayDate here - let useMemo handle it for reactivity
  return {
    ...item,
    isGpt,
    isManual: !isGpt,
    hasTitle,
    title: effectiveTitle,
    displayTitle,
  };
}
