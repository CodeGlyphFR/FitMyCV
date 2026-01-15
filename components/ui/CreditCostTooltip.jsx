"use client";

import React from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Tooltip from './Tooltip';

/**
 * Wrapper tooltip qui affiche le coût en crédits au survol
 *
 * @param {Object} props
 * @param {number} props.cost - Coût en crédits
 * @param {boolean} props.show - Si true, affiche le tooltip (sinon affiche juste children)
 * @param {React.ReactNode} props.children - Élément à wrapper
 * @param {string} props.position - Position du tooltip ('top', 'bottom', 'left', 'right')
 * @param {string} props.className - Classes CSS additionnelles
 */
export default function CreditCostTooltip({
  cost,
  show = true,
  children,
  position = 'top',
  className = '',
}) {
  const { t } = useLanguage();

  // Si on ne doit pas afficher ou coût = 0, retourner les enfants directement
  if (!show || cost === 0) {
    return <>{children}</>;
  }

  const creditLabel = cost === 1 ? t('credits.unit') : t('credits.unitPlural');
  const tooltipContent = `${cost} ${creditLabel}`;

  return (
    <Tooltip content={tooltipContent} position={position} className={className}>
      {children}
    </Tooltip>
  );
}
