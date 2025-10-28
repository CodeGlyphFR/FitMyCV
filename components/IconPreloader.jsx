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
      {/* Pré-charger les icônes critiques du dropdown CV */}
      <link rel="preload" href="/icons/add.png" as="image" />
      <link rel="preload" href="/icons/import.png" as="image" />
      <link rel="preload" href="/icons/search.png" as="image" />
      <link rel="preload" href="/icons/translate.png" as="image" />
      <link rel="preload" href="/icons/openai-symbol.png" as="image" />

      {/* Images invisibles pour forcer le cache navigateur (fallback) */}
      <div style={{ display: 'none', position: 'absolute', pointerEvents: 'none' }}>
        <img src="/icons/add.png" alt="" />
        <img src="/icons/import.png" alt="" />
        <img src="/icons/search.png" alt="" />
        <img src="/icons/translate.png" alt="" />
        <img src="/icons/openai-symbol.png" alt="" />
      </div>
    </>
  );
}
