"use client";
import React from "react";

/**
 * Composant pour pré-charger les icônes critiques utilisées dans le dropdown de sélection de CV.
 * Ces icônes seront en cache avant même que l'utilisateur n'ouvre le dropdown,
 * éliminant le délai de chargement sur iOS et autres appareils mobiles.
 */
export default function IconPreloader() {
  return (
    <>
      {/* Pré-charger toutes les icônes critiques de la TopBar */}
      <link rel="preload" href="/icons/add.svg" as="image" />
      <link rel="preload" href="/icons/import.svg" as="image" />
      <link rel="preload" href="/icons/search.svg" as="image" />
      <link rel="preload" href="/icons/translate.png" as="image" />
      <link rel="preload" href="/icons/openai-symbol.svg" as="image" />
      <link rel="preload" href="/icons/delete.svg" as="image" />
      <link rel="preload" href="/icons/export.svg" as="image" />
      <link rel="preload" href="/icons/task.svg" as="image" />
      <link rel="preload" href="/icons/user.svg" as="image" />
    </>
  );
}
