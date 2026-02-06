"use client";
import React, { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const MONTHS_FR = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"
];

/**
 * MonthPicker - Sélecteur de mois/année avec calendrier popup
 *
 * @param {string} value - Valeur actuelle au format YYYY-MM ou YYYY
 * @param {function} onChange - Callback appelé avec la nouvelle valeur (format YYYY-MM)
 * @param {string} placeholder - Placeholder du champ
 * @param {boolean} disabled - Désactiver le composant
 * @param {string} className - Classes CSS additionnelles pour le conteneur
 * @param {string} locale - Locale pour les noms de mois ('fr' ou 'en')
 * @param {string} todayLabel - Label du bouton "Aujourd'hui"
 * @param {boolean} presentMode - Si true, "Aujourd'hui" renvoie "present" au lieu de la date
 * @param {string} presentLabel - Label à afficher quand la valeur est "present" (ex: "En cours")
 */
export default function MonthPicker({
  value,
  onChange,
  placeholder = "YYYY-MM",
  disabled = false,
  className,
  locale = "fr",
  todayLabel = "Aujourd'hui",
  presentMode = false,
  presentLabel = "En cours"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayYear, setDisplayYear] = useState(() => {
    if (value) {
      const match = value.match(/^(\d{4})/);
      if (match) return parseInt(match[1], 10);
    }
    return new Date().getFullYear();
  });

  const containerRef = useRef(null);
  const months = locale === "fr" ? MONTHS_FR : MONTHS;

  // Fermer le popup au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Extraire année et mois de la valeur
  const parseValue = (val) => {
    if (!val) return { year: null, month: null };
    const match = val.match(/^(\d{4})(?:-(\d{2}))?$/);
    if (match) {
      return {
        year: parseInt(match[1], 10),
        month: match[2] ? parseInt(match[2], 10) : null
      };
    }
    return { year: null, month: null };
  };

  const { year: selectedYear, month: selectedMonth } = parseValue(value);

  // Sélectionner un mois
  const selectMonth = (monthIndex) => {
    const newValue = `${displayYear}-${String(monthIndex + 1).padStart(2, "0")}`;
    onChange(newValue);
    setIsOpen(false);
  };

  // Sélectionner aujourd'hui (ou "present" en mode presentMode)
  const selectToday = () => {
    if (presentMode) {
      onChange("present");
    } else {
      const now = new Date();
      const newValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      onChange(newValue);
      setDisplayYear(now.getFullYear());
    }
    setIsOpen(false);
  };

  // Toggle le picker (ouvrir/fermer)
  const togglePicker = () => {
    if (disabled) return;
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    // Si une valeur existe, afficher cette année, sinon l'année actuelle
    if (value) {
      const { year } = parseValue(value);
      if (year) setDisplayYear(year);
    } else {
      setDisplayYear(new Date().getFullYear());
    }
    setIsOpen(true);
  };

  // Valeur affichée: "present" -> presentLabel
  const displayValue = value?.toLowerCase() === "present" ? presentLabel : (value || "");

  // Gestion du changement: si on tape presentLabel, stocker "present"
  const handleInputChange = (e) => {
    const newVal = e.target.value;
    if (presentMode && newVal.toLowerCase() === presentLabel.toLowerCase()) {
      onChange("present");
    } else {
      onChange(newVal);
    }
  };

  return (
    <div ref={containerRef} className={clsx("relative", className)}>
      {/* Champ de saisie + bouton calendrier */}
      <div className="flex gap-1">
        <input
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className={clsx(
            "flex-1 rounded-md border border-white/20 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-white/40",
            "transition-all duration-200 hover:bg-white/10 hover:border-white/30",
            "focus:bg-white/10 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
        <button
          type="button"
          onClick={togglePicker}
          disabled={disabled}
          className={clsx(
            "px-2 rounded-md border bg-white/5 text-white/60",
            "transition-all duration-200 hover:bg-white/10 hover:border-white/30 hover:text-white",
            "focus:outline-none",
            isOpen
              ? "border-emerald-400 ring-1 ring-emerald-400/30 text-white"
              : "border-white/20",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          title="Ouvrir le calendrier"
        >
          <Calendar className="w-4 h-4" />
        </button>
      </div>

      {/* Popup calendrier */}
      {isOpen && (
        <div className="absolute z-50 mt-1 p-3 rounded-lg border border-white/20 bg-slate-900/95 backdrop-blur-sm shadow-xl min-w-[220px]">
          {/* Header avec navigation année */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setDisplayYear(y => y - 1)}
              className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-white">{displayYear}</span>
            <button
              type="button"
              onClick={() => setDisplayYear(y => y + 1)}
              className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Grille des mois */}
          <div className="grid grid-cols-4 gap-1">
            {months.map((monthName, idx) => {
              const isSelected = selectedYear === displayYear && selectedMonth === idx + 1;
              const isCurrentMonth = new Date().getFullYear() === displayYear && new Date().getMonth() === idx;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectMonth(idx)}
                  className={clsx(
                    "px-2 py-1.5 text-xs rounded transition-all duration-150",
                    isSelected
                      ? "bg-emerald-500 text-white font-medium"
                      : isCurrentMonth
                        ? "bg-white/10 text-emerald-400 border border-emerald-400/30"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {monthName}
                </button>
              );
            })}
          </div>

          {/* Bouton "Aujourd'hui" */}
          <button
            type="button"
            onClick={selectToday}
            className="mt-2 w-full py-1.5 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-white/5 rounded transition-colors"
          >
            {todayLabel}
          </button>
        </div>
      )}
    </div>
  );
}
