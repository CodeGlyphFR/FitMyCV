"use client";

import React from 'react';

/**
 * DonutProgress - Composant de progression circulaire (donut)
 *
 * Affiche une barre de progression circulaire style glassmorphism
 * avec le pourcentage au centre.
 *
 * @param {number} progress - Progression de 0 à 100
 * @param {number} size - Taille en pixels (défaut: 28)
 * @param {number} strokeWidth - Épaisseur du trait (défaut: 3)
 * @param {boolean} showPercent - Afficher le % au centre (défaut: true)
 * @param {string} className - Classes CSS additionnelles
 */
export default function DonutProgress({
  progress = 0,
  size = 28,
  strokeWidth = 3,
  showPercent = true,
  className = '',
}) {
  // Calculs SVG
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(100, Math.max(0, progress)) / 100);

  // Taille du texte adaptée à la taille du donut
  const fontSize = size <= 24 ? 7 : size <= 32 ? 9 : 11;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Définition du gradient */}
        <defs>
          <linearGradient id="donutGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34D399" /> {/* emerald-400 */}
            <stop offset="100%" stopColor="#10B981" /> {/* emerald-500 */}
          </linearGradient>
        </defs>

        {/* Cercle de fond (track) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth={strokeWidth}
        />

        {/* Cercle de progression */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#donutGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-[stroke-dashoffset] duration-300 ease-out"
          style={{
            filter: 'drop-shadow(0 0 2px rgba(52, 211, 153, 0.5))',
          }}
        />
      </svg>

      {/* Pourcentage au centre */}
      {showPercent && (
        <span
          className="absolute text-white font-semibold drop-shadow"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: 1,
          }}
        >
          {Math.round(progress)}
        </span>
      )}
    </div>
  );
}
