"use client";

import React from "react";

/**
 * CreditToken - Bouton de crédits style "Energy Token" premium
 *
 * Design inspiré gaming/fintech avec :
 * - Cercle intérieur gradient amber
 * - Arc de progression emerald animé
 * - Glow pulsant
 * - Effet 3D au hover
 *
 * @param {Object} props
 * @param {number} props.balance - Nombre de crédits actuels
 * @param {number} props.ratio - Ratio 0-1 pour l'arc de progression (1 = 100%)
 * @param {function} props.onClick - Callback au clic
 * @param {string} props.title - Titre pour l'accessibilité
 */
export default function CreditToken({
  balance = 0,
  ratio = 1,
  onClick,
  title = "Crédits",
}) {
  // Dimensions du SVG
  const size = 40;
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Arc de progression (commence en haut, sens horaire)
  const progressOffset = circumference * (1 - Math.min(1, Math.max(0, ratio)));

  // Couleur de l'arc selon le ratio
  const getArcColor = () => {
    if (ratio > 0.5) return "stroke-emerald-400";
    if (ratio > 0.25) return "stroke-amber-400";
    return "stroke-red-400";
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="credit-token group relative inline-flex items-center justify-center transition-all duration-300 hover:scale-105"
      title={title}
      style={{ width: size, height: size }}
    >
      {/* Glow effect (background) */}
      <div
        className="absolute inset-0 rounded-full bg-amber-500/30 blur-md animate-credit-pulse"
        style={{ width: size + 4, height: size + 4, left: -2, top: -2 }}
      />

      {/* SVG Container */}
      <svg
        width={size}
        height={size}
        className="relative z-10 transform transition-transform duration-300 group-hover:rotate-12"
        style={{ filter: "drop-shadow(0 0 4px rgba(251, 191, 36, 0.5))" }}
      >
        {/* Background circle (track) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth={strokeWidth}
        />

        {/* Inner filled circle (token body) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius - strokeWidth / 2 - 1}
          fill="url(#tokenGradient)"
          className="transition-all duration-300"
        />

        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progressOffset}
          className={`${getArcColor()} transition-all duration-500 ease-out`}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "center",
          }}
        />

        {/* Gradient definition */}
        <defs>
          <linearGradient id="tokenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
      </svg>

      {/* Credit number (centered) */}
      <span
        className="absolute inset-0 flex items-center justify-center z-20 text-white font-bold drop-shadow-md transition-transform duration-300 group-hover:scale-110"
        style={{
          textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
          fontSize: balance >= 100 ? "10px" : balance >= 10 ? "12px" : "14px",
        }}
      >
        {balance}
      </span>
    </button>
  );
}
