'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Check, X, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * ModificationCard - Affiche une modification avec avant/après/raison et boutons accept/reject
 *
 * @param {Object} props
 * @param {Object} props.modification - { field, action, before, after, reason }
 * @param {boolean} props.expanded - État d'expansion initial
 * @param {function} props.onToggle - Callback pour toggle expansion
 * @param {string} props.decision - 'accepted' | 'rejected' | null
 * @param {function} props.onAccept - Callback pour accepter
 * @param {function} props.onReject - Callback pour refuser
 * @param {boolean} props.showActions - Afficher les boutons accept/reject (défaut: true)
 */
export default function ModificationCard({
  modification,
  expanded = false,
  onToggle,
  decision = null,
  onAccept,
  onReject,
  showActions = true,
}) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(expanded);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    onToggle?.(!isExpanded);
  };

  const { field, action, before, after, reason } = modification;

  // Couleur selon l'action
  const actionColors = {
    added: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      label: t('cvReview.actions.added') || 'Ajouté',
    },
    removed: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-400',
      label: t('cvReview.actions.removed') || 'Supprimé',
    },
    modified: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      label: t('cvReview.actions.modified') || 'Modifié',
    },
    adjusted: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      label: t('cvReview.actions.adjusted') || 'Ajusté',
    },
    reordered: {
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/30',
      text: 'text-purple-400',
      label: t('cvReview.actions.reordered') || 'Réordonné',
    },
    highlighted: {
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/30',
      text: 'text-cyan-400',
      label: t('cvReview.actions.highlighted') || 'Mis en valeur',
    },
    generated: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      label: t('cvReview.actions.generated') || 'Généré',
    },
  };

  const colors = actionColors[action] || actionColors.modified;

  // Style selon la décision
  const getDecisionStyles = () => {
    if (decision === 'accepted') {
      return 'ring-2 ring-emerald-500/50 border-emerald-500/50';
    }
    if (decision === 'rejected') {
      return 'ring-2 ring-red-500/50 border-red-500/50 opacity-60';
    }
    return '';
  };

  return (
    <div
      className={`rounded-lg border ${colors.border} ${colors.bg} overflow-hidden transition-all duration-200 ${getDecisionStyles()}`}
    >
      {/* Header - toujours visible */}
      <div className="flex items-center">
        <button
          onClick={handleToggle}
          className="flex-1 flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Indicateur de décision */}
            {decision === 'accepted' && (
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-emerald-400" />
              </div>
            )}
            {decision === 'rejected' && (
              <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <X className="w-3 h-3 text-red-400" />
              </div>
            )}
            {/* Badge action */}
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${colors.text} bg-white/5`}
            >
              {colors.label}
            </span>
            {/* Champ modifié */}
            <span className="text-white/80 text-sm truncate">{field}</span>
          </div>
          {/* Chevron */}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-white/50 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/50 flex-shrink-0" />
          )}
        </button>

        {/* Boutons Accept/Reject */}
        {showActions && (
          <div className="flex items-center gap-1 pr-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAccept?.();
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                decision === 'accepted'
                  ? 'bg-emerald-500/30 text-emerald-400'
                  : 'hover:bg-emerald-500/20 text-white/50 hover:text-emerald-400'
              }`}
              title={t('cv.review.accept') || 'Accepter'}
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReject?.();
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                decision === 'rejected'
                  ? 'bg-red-500/30 text-red-400'
                  : 'hover:bg-red-500/20 text-white/50 hover:text-red-400'
              }`}
              title={t('cv.review.reject') || 'Refuser'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Contenu expandé */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Avant/Après */}
          <div className="flex flex-col gap-2">
            {/* Avant - affiché si existe */}
            {before && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-white/40 w-12 flex-shrink-0 pt-0.5">
                  {t('cvReview.before') || 'Avant'}
                </span>
                <div className="flex-1 p-2 rounded bg-red-500/10 border border-red-500/20">
                  <p className={`text-sm text-red-300 ${decision === 'rejected' ? '' : 'line-through'}`}>
                    {before}
                  </p>
                </div>
              </div>
            )}

            {/* Flèche de transition */}
            {before && after && (
              <div className="flex justify-center">
                <ArrowRight className="w-4 h-4 text-white/30 rotate-90" />
              </div>
            )}

            {/* Après - affiché si existe */}
            {after && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-white/40 w-12 flex-shrink-0 pt-0.5">
                  {t('cvReview.after') || 'Après'}
                </span>
                <div className={`flex-1 p-2 rounded border ${
                  decision === 'rejected'
                    ? 'bg-white/5 border-white/10'
                    : 'bg-emerald-500/10 border-emerald-500/20'
                }`}>
                  <p className={`text-sm ${
                    decision === 'rejected' ? 'text-white/50 line-through' : 'text-emerald-300'
                  }`}>
                    {after}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Raison IA */}
          {reason && (
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-start gap-2">
                <span className="text-xs text-white/40 w-12 flex-shrink-0 pt-0.5">
                  {t('cvReview.reason') || 'Raison'}
                </span>
                <p className="text-sm text-white/70 italic">{reason}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
