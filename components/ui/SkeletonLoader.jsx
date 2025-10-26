"use client";

import React from "react";

/**
 * Composant Skeleton Loader pour afficher un état de chargement élégant
 * @param {Object} props
 * @param {string} props.variant - Type de skeleton: 'card' | 'text' | 'circle' | 'rect' (défaut: 'rect')
 * @param {string} props.width - Largeur personnalisée (ex: '200px', '50%')
 * @param {string} props.height - Hauteur personnalisée (ex: '24px', '100px')
 * @param {number} props.count - Nombre de lignes à afficher (pour variant='text')
 * @param {string} props.className - Classes CSS supplémentaires
 */
export default function SkeletonLoader({
  variant = "rect",
  width,
  height,
  count = 1,
  className = "",
}) {
  const baseClasses = "animate-pulse bg-gradient-to-r from-white/10 via-white/20 to-white/10 rounded";

  // Dimensions par défaut selon le variant
  const defaultDimensions = {
    card: "w-full h-64",
    text: "w-full h-4",
    circle: "w-12 h-12 rounded-full",
    rect: "w-full h-20",
  };

  const dimensions = defaultDimensions[variant] || defaultDimensions.rect;
  const sizeStyles = {
    width: width || undefined,
    height: height || undefined,
  };

  if (variant === "card") {
    return (
      <div className={`${dimensions} ${baseClasses} ${className}`} style={sizeStyles}>
        <div className="p-6 space-y-4">
          <div className="h-6 bg-white/10 rounded w-3/4 mx-auto"></div>
          <div className="h-4 bg-white/10 rounded w-1/2 mx-auto"></div>
          <div className="space-y-2 pt-4">
            <div className="h-3 bg-white/10 rounded"></div>
            <div className="h-3 bg-white/10 rounded"></div>
            <div className="h-3 bg-white/10 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "text" && count > 1) {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className={`${dimensions} ${baseClasses}`}
            style={{
              ...sizeStyles,
              width: index === count - 1 ? "80%" : sizeStyles.width || "100%",
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${dimensions} ${baseClasses} ${className}`}
      style={sizeStyles}
    />
  );
}

/**
 * Skeleton pour une carte de plan d'abonnement
 */
export function SkeletonPlanCard() {
  return (
    <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 shadow-lg">
      <div className="text-center mb-6">
        <div className="w-12 h-12 mx-auto mb-3 bg-white/20 rounded-full animate-pulse"></div>
        <div className="h-8 bg-white/20 rounded w-32 mx-auto mb-2 animate-pulse"></div>
        <div className="h-4 bg-white/20 rounded w-24 mx-auto animate-pulse"></div>
      </div>

      <div className="text-center mb-6">
        <div className="h-12 bg-white/20 rounded w-24 mx-auto mb-1 animate-pulse"></div>
        <div className="h-4 bg-white/20 rounded w-16 mx-auto animate-pulse"></div>
      </div>

      <div className="space-y-3 mb-6">
        <SkeletonLoader variant="text" count={4} />
      </div>

      <div className="h-12 bg-white/20 rounded animate-pulse"></div>
    </div>
  );
}

/**
 * Skeleton pour la carte de compteurs de features
 */
export function SkeletonFeatureCounters() {
  return (
    <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 bg-white/20 rounded animate-pulse"></div>
        <div className="h-6 bg-white/20 rounded w-48 animate-pulse"></div>
      </div>

      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index}>
            <div className="flex items-center justify-between mb-1">
              <div className="h-4 bg-white/20 rounded w-32 animate-pulse"></div>
              <div className="h-3 bg-white/20 rounded w-16 animate-pulse"></div>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-white/20 rounded-full w-2/3 animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton pour la carte du plan actuel
 */
export function SkeletonCurrentPlanCard() {
  return (
    <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 shadow-lg">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-full animate-pulse"></div>
          <div>
            <div className="h-6 bg-white/20 rounded w-32 mb-2 animate-pulse"></div>
            <div className="h-4 bg-white/20 rounded w-40 animate-pulse"></div>
          </div>
        </div>
        <div className="text-right">
          <div className="h-8 bg-white/20 rounded w-20 mb-1 animate-pulse"></div>
          <div className="h-3 bg-white/20 rounded w-12 animate-pulse"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="space-y-1">
          <div className="h-3 bg-white/20 rounded w-24 mb-2 animate-pulse"></div>
          <div className="h-4 bg-white/20 rounded w-full animate-pulse"></div>
          <div className="h-4 bg-white/20 rounded w-full animate-pulse"></div>
        </div>
        <div className="space-y-1">
          <div className="h-3 bg-white/20 rounded w-24 mb-2 animate-pulse"></div>
          <div className="h-4 bg-white/20 rounded w-32 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}
