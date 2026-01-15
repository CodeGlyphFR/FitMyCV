"use client";

import React from 'react';
import { Coins } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * Affiche le coût en crédits d'une opération dans un modal
 *
 * @param {Object} props
 * @param {number} props.cost - Coût en crédits
 * @param {boolean} props.show - Si true, affiche le composant
 * @param {string} props.variant - 'default' | 'compact' | 'inline'
 * @param {string} props.className - Classes CSS additionnelles
 * @param {string} props.detail - Détail optionnel (ex: "3 x 2")
 */
export default function CreditCostDisplay({
  cost,
  show = true,
  variant = 'default',
  className = '',
  detail = null,
}) {
  const { t } = useLanguage();

  if (!show || cost === 0) return null;

  const creditLabel = cost === 1 ? t('credits.unit') : t('credits.unitPlural');

  // Variant inline (texte simple)
  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-1 text-amber-400 text-sm ${className}`}>
        <Coins className="w-4 h-4" />
        <span>
          {cost} {creditLabel}
        </span>
      </span>
    );
  }

  // Variant compact (petit badge)
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-1.5 text-amber-300 text-xs ${className}`}>
        <Coins className="w-3.5 h-3.5" />
        <span>{cost}</span>
      </div>
    );
  }

  // Default variant (encadré complet)
  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-2
        bg-amber-500/10 border border-amber-500/30 rounded-lg
        text-amber-300 text-sm
        ${className}
      `}
    >
      <Coins className="w-4 h-4 flex-shrink-0" />
      <span>
        {t('credits.costLabel')}:{' '}
        <strong>
          {cost} {creditLabel}
        </strong>
        {detail && <span className="text-amber-400/70 ml-1">({detail})</span>}
      </span>
    </div>
  );
}
