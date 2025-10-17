"use client";
import React from "react";

/**
 * Composant qui affiche un badge avec le nombre de tokens restants
 * @param {number} refreshCount - Nombre de tokens restants (0-5)
 * @param {boolean} isLoading - Si true, le badge n'est pas affiché
 */
export default function TokenCounter({ refreshCount, isLoading = false }) {
  // Ne pas afficher pendant le chargement
  if (isLoading) {
    return null;
  }

  // Déterminer la couleur du badge selon les tokens restants
  const getBadgeColor = () => {
    if (refreshCount === 0) return "bg-gray-400";
    if (refreshCount === 1) return "bg-red-500";
    if (refreshCount === 2) return "bg-orange-500";
    if (refreshCount === 3) return "bg-yellow-500";
    if (refreshCount === 4) return "bg-lime-500";
    return "bg-green-500";
  };

  return (
    <div
      className={`
        w-5 h-5 rounded-full
        ${getBadgeColor()}
        flex items-center justify-center
        text-white text-[10px] font-bold
        shadow-md border-2 border-white
        transition-all duration-300
      `}
      title={`${refreshCount} token${refreshCount > 1 ? 's' : ''} restant${refreshCount > 1 ? 's' : ''}`}
    >
      {refreshCount}
    </div>
  );
}
