'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Minus, Check } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import ModificationCard from './ModificationCard';

/**
 * Icônes par section
 */
const SECTION_ICONS = {
  summary: '📝',
  experiences: '💼',
  projects: '🚀',
  skills: '🎯',
  extras: '✨',
  languages: '🌍',
};

/**
 * SectionDiff - Groupe les modifications d'une section du CV
 *
 * @param {Object} props
 * @param {string} props.sectionName - Nom de la section (summary, experiences, etc.)
 * @param {Array} props.modifications - Liste des modifications de cette section
 * @param {boolean} props.defaultExpanded - État d'expansion par défaut
 * @param {function} props.getDecision - Fonction pour récupérer la décision d'une modification
 * @param {function} props.onAccept - Callback pour accepter une modification (index, field)
 * @param {function} props.onReject - Callback pour refuser une modification (index, field)
 * @param {function} props.onAcceptAllInSection - Callback pour accepter toutes les modifications de la section
 * @param {boolean} props.showActions - Afficher les boutons accept/reject (défaut: true)
 */
export default function SectionDiff({
  sectionName,
  modifications = [],
  defaultExpanded = true,
  getDecision,
  onAccept,
  onReject,
  onAcceptAllInSection,
  showActions = true,
}) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Pas de modifications pour cette section
  if (!modifications || modifications.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 opacity-60">
        <div className="flex items-center gap-3">
          <span className="text-xl">{SECTION_ICONS[sectionName] || '📄'}</span>
          <span className="text-white/70 font-medium">
            {t(`cvReview.sections.${sectionName}`) || sectionName}
          </span>
          <span className="ml-auto text-xs text-white/40 flex items-center gap-1">
            <Minus className="w-3 h-3" />
            {t('cvReview.noModifications') || 'Aucune modification'}
          </span>
        </div>
      </div>
    );
  }

  // Compteurs
  const addedCount = modifications.filter((m) => m.action === 'added' || m.action === 'generated').length;
  const removedCount = modifications.filter((m) => m.action === 'removed').length;
  const modifiedCount = modifications.filter(
    (m) => !['added', 'removed', 'generated'].includes(m.action)
  ).length;

  // Compteur de décisions pour la section
  // On utilise mod.modIndex (index original) au lieu de l'index d'affichage
  const reviewedInSection = modifications.filter((mod) => {
    const index = mod.modIndex ?? 0;
    const decision = getDecision?.(sectionName, index, mod.field);
    return decision === 'accepted' || decision === 'rejected';
  }).length;

  const allReviewedInSection = reviewedInSection === modifications.length;

  return (
    <div className="rounded-xl border border-white/20 bg-white/5 overflow-hidden">
      {/* Header de section */}
      <div className="flex items-center">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{SECTION_ICONS[sectionName] || '📄'}</span>
            <span className="text-white font-medium">
              {t(`cvReview.sections.${sectionName}`) || sectionName}
            </span>
            {/* Badge nombre de modifications */}
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              allReviewedInSection
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-white/10 text-white/70'
            }`}>
              {reviewedInSection}/{modifications.length} {t('cvReview.reviewed') || 'revues'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Mini résumé des actions */}
            <div className="flex items-center gap-2 text-xs">
              {addedCount > 0 && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  {addedCount}
                </span>
              )}
              {removedCount > 0 && (
                <span className="flex items-center gap-1 text-red-400">
                  <XCircle className="w-3 h-3" />
                  {removedCount}
                </span>
              )}
              {modifiedCount > 0 && (
                <span className="flex items-center gap-1 text-blue-400">
                  ~{modifiedCount}
                </span>
              )}
            </div>
            {/* Chevron */}
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-white/50" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white/50" />
            )}
          </div>
        </button>

        {/* Bouton Accept All Section */}
        {showActions && !allReviewedInSection && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAcceptAllInSection?.(sectionName, modifications);
            }}
            className="px-3 py-1.5 mr-4 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-1.5 transition-colors"
            title={t('cvReview.acceptAllSection') || 'Accepter tout'}
          >
            <Check className="w-3 h-3" />
            {t('cvReview.acceptAllSection') || 'Accepter tout'}
          </button>
        )}
      </div>

      {/* Liste des modifications */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-2">
          {modifications.map((mod, displayIndex) => {
            // On utilise mod.modIndex (index original) au lieu de displayIndex pour la clé de décision
            const index = mod.modIndex ?? displayIndex;
            const decision = getDecision?.(sectionName, index, mod.field);
            return (
              <ModificationCard
                key={`${mod.field}-${displayIndex}`}
                modification={mod}
                expanded={false}
                decision={decision}
                onAccept={() => onAccept?.(sectionName, index, mod.field)}
                onReject={() => onReject?.(sectionName, index, mod.field)}
                showActions={showActions}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
