"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/**
 * Composant d'indication de force du mot de passe en temps réel
 * Affiche les règles de validation et une barre de progression
 */
export default function PasswordStrengthIndicator({ password }) {
  const { t } = useLanguage();

  // Validation des règles individuelles
  const hasMinLength = password.length >= 12;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\';/~`]/.test(password);

  // Calcul de la force
  const validRules = [
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumbers,
    hasSpecialChars,
  ].filter(Boolean).length;

  let strength = "weak";
  let strengthColor = "bg-red-500";
  let strengthWidth = "20%";

  if (validRules === 5) {
    if (password.length >= 16) {
      strength = "very_strong";
      strengthColor = "bg-emerald-600";
      strengthWidth = "100%";
    } else if (password.length >= 14) {
      strength = "strong";
      strengthColor = "bg-green-500";
      strengthWidth = "80%";
    } else {
      strength = "medium";
      strengthColor = "bg-yellow-500";
      strengthWidth = "60%";
    }
  } else if (validRules >= 3) {
    strength = "medium";
    strengthColor = "bg-yellow-500";
    strengthWidth = "40%";
  }

  // Ne rien afficher si le champ est vide
  if (!password) return null;

  return (
    <div className="mt-3 space-y-3">
      {/* Barre de progression */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-600">{t("auth.passwordStrength.label")}</span>
          <span className={`font-medium ${strengthColor.replace("bg-", "text-")}`}>
            {t(`auth.passwordStrength.${strength}`)}
          </span>
        </div>
        <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${strengthColor} transition-all duration-300`}
            style={{ width: strengthWidth }}
          />
        </div>
      </div>

      {/* Liste des règles */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-neutral-700">{t("auth.passwordRules.title")}</p>

        <Rule
          valid={hasMinLength}
          text={t("auth.passwordRules.minLength")}
        />
        <Rule
          valid={hasUppercase}
          text={t("auth.passwordRules.uppercase")}
        />
        <Rule
          valid={hasLowercase}
          text={t("auth.passwordRules.lowercase")}
        />
        <Rule
          valid={hasNumbers}
          text={t("auth.passwordRules.numbers")}
        />
        <Rule
          valid={hasSpecialChars}
          text={t("auth.passwordRules.specialChars")}
        />
      </div>
    </div>
  );
}

function Rule({ valid, text }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {valid ? (
        <span className="text-emerald-600 font-bold">✓</span>
      ) : (
        <span className="text-neutral-400">○</span>
      )}
      <span className={valid ? "text-emerald-700" : "text-neutral-600"}>
        {text}
      </span>
    </div>
  );
}
