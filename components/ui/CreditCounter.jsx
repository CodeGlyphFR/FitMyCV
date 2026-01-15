"use client";

import React, { useState, useEffect, useRef } from "react";
import { AnimatedCounter } from "react-animated-counter";

/**
 * Interpole entre deux couleurs hex
 */
function interpolateColor(color1, color2, factor) {
  const hex = (c) => parseInt(c, 16);
  const r1 = hex(color1.slice(1, 3));
  const g1 = hex(color1.slice(3, 5));
  const b1 = hex(color1.slice(5, 7));
  const r2 = hex(color2.slice(1, 3));
  const g2 = hex(color2.slice(3, 5));
  const b2 = hex(color2.slice(5, 7));

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * CreditCounter - Compteur de crédits animé avec barre de progression
 *
 * - Nombre animé style Robinhood
 * - Vert quand crédits ajoutés, rouge quand débités
 * - Barre de progression fine en dessous
 *
 * @param {Object} props
 * @param {number} props.balance - Nombre de crédits actuels
 * @param {number} props.ratio - Ratio 0-1 pour la barre de progression
 * @param {function} props.onClick - Callback au clic
 * @param {string} props.title - Titre pour l'accessibilité
 */
export default function CreditCounter({
  balance = 0,
  ratio = 1,
  onClick,
  title = "Crédits",
}) {
  const [color, setColor] = useState("#ffffff");
  const prevBalanceRef = useRef(balance);
  const animationRef = useRef(null);

  // Anime la couleur progressivement de startColor vers endColor
  const animateColor = (startColor, endColor, duration) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing ease-out pour un fade plus naturel
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      const newColor = interpolateColor(startColor, endColor, easedProgress);
      setColor(newColor);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  // Détecter les changements de balance et animer la couleur
  useEffect(() => {
    const prevBalance = prevBalanceRef.current;

    if (balance !== prevBalance) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      const targetColor = balance > prevBalance ? "#4ade80" : "#f87171";

      // Fade in rapide vers la couleur (300ms)
      animateColor("#ffffff", targetColor, 300);

      // Après un délai, fade out lent vers blanc (1500ms)
      setTimeout(() => {
        animateColor(targetColor, "#ffffff", 1500);
      }, 500);

      prevBalanceRef.current = balance;
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [balance]);

  // Couleur de la barre selon le ratio
  const getBarColor = () => {
    if (ratio > 0.5) return "bg-emerald-400";
    if (ratio > 0.25) return "bg-amber-400";
    return "bg-red-400";
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-1 px-2 py-1 transition-all duration-200 hover:opacity-80"
      title={title}
    >
      {/* Nombre animé */}
      <div
        style={{
          fontFamily: "var(--font-oswald), 'Oswald', sans-serif",
          fontWeight: 600,
          transition: "filter 0.5s ease-in-out",
        }}
        className={color === "#4ade80" ? "credit-glow-green" : color === "#f87171" ? "credit-glow-red" : ""}
      >
        <AnimatedCounter
          value={balance}
          color={color}
          fontSize="20px"
          includeDecimals={false}
          incrementColor="#4ade80"
          decrementColor="#f87171"
        />
      </div>

      {/* Barre de progression */}
      <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
        <div
          className={`h-full ${getBarColor()} transition-all duration-500 ease-out rounded-full`}
          style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }}
        />
      </div>
    </button>
  );
}
