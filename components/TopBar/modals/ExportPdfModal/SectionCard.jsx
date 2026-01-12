"use client";
import React, { useState } from 'react';
import { capitalizeSkillName } from "@/lib/utils/textFormatting";

/**
 * Icônes pour chaque section
 */
const SECTION_ICONS = {
  header: '📄',
  summary: '📝',
  skills: '💡',
  experience: '💼',
  education: '🎓',
  languages: '🌐',
  projects: '🚀',
  extras: '✨'
};

/**
 * Formatte le titre d'un élément de liste (pour experience, education, etc.)
 */
function formatItemTitle(item, sectionKey) {
  switch (sectionKey) {
    case 'experience':
      return `${item.title || 'Sans titre'} - ${item.company || 'Entreprise inconnue'}`;
    case 'education':
      return `${item.degree || item.field_of_study || 'Formation'} - ${item.institution || 'Établissement inconnu'}`;
    case 'languages':
      return `${item.name || 'Langue'} (${capitalizeSkillName(item.level) || 'Niveau inconnu'})`;
    case 'projects':
      return item.name || 'Projet sans nom';
    case 'extras':
      return item.name || 'Information supplémentaire';
    default:
      return 'Élément';
  }
}

/**
 * Card de section pour le modal d'export PDF
 */
export default function SectionCard({
  sectionKey,
  sectionName,
  count,
  subCounts,
  enabled,
  subsections,
  items,
  itemsData,
  itemsOptions,
  onToggle,
  onToggleSubsection,
  onToggleItem,
  onToggleItemOption,
  isHeaderSection,
  t
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasSubsections = subsections && Object.keys(subsections).length > 0;
  const hasItems = items !== undefined && itemsData && itemsData.length > 0;
  const icon = SECTION_ICONS[sectionKey] || '📋';

  // Pour la section header, on affiche "Toujours inclus" au lieu du compteur
  const displayCount = isHeaderSection
    ? t('exportModal.counters.always')
    : count === 0
    ? t('exportModal.counters.empty')
    : `${count} ${count > 1 ? t('exportModal.counters.items') : t('exportModal.counters.item')}`;

  // Compteur d'éléments sélectionnés
  const selectedItemsCount = hasItems ? items.length : null;
  const totalItemsCount = hasItems ? itemsData.length : null;

  return (
    <div
      className={`relative rounded-lg border backdrop-blur-sm transition-all duration-300 ${
        enabled
          ? 'border-emerald-400 bg-emerald-500/20 shadow-lg'
          : 'border-white/30 bg-white/10 opacity-60'
      }`}
    >
      {/* Card principale */}
      <button
        type="button"
        onClick={() => !isHeaderSection && onToggle()}
        disabled={isHeaderSection}
        className={`w-full p-4 pb-2 text-left flex items-start gap-3 ${
          isHeaderSection ? 'cursor-default' : 'cursor-pointer hover:bg-white/10'
        } transition-colors duration-200 rounded-t-lg`}
      >
        {/* Icône */}
        <span className="text-3xl flex-shrink-0">{icon}</span>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-white text-sm mb-1">
                {sectionName}
              </h3>
              <p className="text-xs text-white/70">
                {hasItems && selectedItemsCount !== null
                  ? `${selectedItemsCount}/${totalItemsCount} ${t('exportModal.counters.selected')}`
                  : displayCount}
              </p>
            </div>

            {/* Checkbox visuel */}
            <div
              className={`flex-shrink-0 w-5 h-5 rounded-sm border-2 flex items-center justify-center transition-all duration-200 ${
                enabled
                  ? 'bg-emerald-400 border-emerald-400'
                  : 'bg-transparent border-white/40'
              }`}
            >
              {enabled && (
                <svg
                  className="w-3 h-3 text-gray-900"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Bouton expand (en dehors du bouton principal pour être toujours cliquable) */}
      {(hasSubsections || hasItems) && enabled && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 pb-2 text-xs text-emerald-300 hover:text-emerald-200 flex items-center gap-1 transition-colors text-left"
        >
          <span className="ml-14">{isExpanded ? '▾' : '▸'}</span>
          <span>
            {isExpanded
              ? t('exportModal.hideOptions')
              : t('exportModal.showOptions')}
          </span>
        </button>
      )}

      {/* Sous-sections (pour skills et header) */}
      {hasSubsections && enabled && isExpanded && (
        <div className="border-t border-white/20 px-4 pb-3 pt-2 space-y-2">
          {Object.entries(subsections).map(([subKey, subEnabled]) => {
            const subCount = subCounts?.[subKey] || 0;
            const subName = t(`exportModal.subsections.${sectionKey}.${subKey}`);

            return (
              <button
                key={subKey}
                type="button"
                onClick={() => onToggleSubsection(sectionKey, subKey)}
                className="w-full flex items-center gap-2 cursor-pointer hover:bg-white/10 p-2 rounded-sm transition-colors"
              >
                {/* Checkbox custom glassmorphism */}
                <div
                  className={`w-4 h-4 flex-shrink-0 rounded-sm border-2 flex items-center justify-center transition-all duration-200 ${
                    subEnabled
                      ? 'bg-emerald-400 border-emerald-400'
                      : 'bg-white/10 border-white/40'
                  }`}
                >
                  {subEnabled && (
                    <svg
                      className="w-3 h-3 text-gray-900"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-white flex-1 text-left">
                  {subName}
                </span>
                {subCount > 0 && (
                  <span className="text-xs text-white/60">
                    ({subCount})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Liste d'éléments (pour experience, education, etc.) */}
      {hasItems && enabled && isExpanded && (
        <div className="border-t border-white/20 px-4 pb-3 pt-2 max-h-64 overflow-y-auto [overscroll-behavior:contain] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sectionKey === 'experience' ? (
            // Tableau pour les expériences avec colonne deliverables
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left py-2 px-2 text-white/80 font-medium">
                    {t('exportModal.experienceColumn')}
                  </th>
                  <th className="text-center py-2 px-2 text-white/80 font-medium w-32">
                    {t('exportModal.includeDeliverables')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {itemsData.map((item, index) => {
                  const isSelected = items.includes(index);
                  const itemTitle = formatItemTitle(item, sectionKey);
                  const hasDeliverables = item.deliverables && item.deliverables.length > 0;
                  const includeDeliverables = itemsOptions?.[index]?.includeDeliverables ?? true;

                  return (
                    <tr key={index} className="border-b border-white/10 last:border-0">
                      {/* Colonne Expérience */}
                      <td className="py-2 px-2">
                        <button
                          type="button"
                          onClick={() => onToggleItem(sectionKey, index)}
                          className="w-full flex items-start gap-2 cursor-pointer hover:bg-white/10 p-1 rounded-sm transition-colors text-left"
                        >
                          <div
                            className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded-sm border-2 flex items-center justify-center transition-all duration-200 ${
                              isSelected
                                ? 'bg-emerald-400 border-emerald-400'
                                : 'bg-white/10 border-white/40'
                            }`}
                          >
                            {isSelected && (
                              <svg
                                className="w-3 h-3 text-gray-900"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="3"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-white flex-1 leading-tight">{itemTitle}</span>
                        </button>
                      </td>

                      {/* Colonne Inclure livrables */}
                      <td className="py-2 px-2 text-center">
                        {hasDeliverables && isSelected ? (
                          <button
                            type="button"
                            onClick={() => onToggleItemOption(sectionKey, index, 'includeDeliverables')}
                            className="inline-flex items-center justify-center cursor-pointer hover:bg-white/10 p-1 rounded-sm transition-colors"
                          >
                            <div
                              className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-all duration-200 ${
                                includeDeliverables
                                  ? 'bg-emerald-400 border-emerald-400'
                                  : 'bg-white/10 border-white/40'
                              }`}
                            >
                              {includeDeliverables && (
                                <svg
                                  className="w-3 h-3 text-gray-900"
                                  fill="none"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="3"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </button>
                        ) : (
                          <span className="text-white/30 text-xs">
                            {!hasDeliverables ? '—' : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            // Liste simple pour les autres sections
            <div className="space-y-2">
              {itemsData.map((item, index) => {
                const isSelected = items.includes(index);
                const itemTitle = formatItemTitle(item, sectionKey);

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => onToggleItem(sectionKey, index)}
                    className="w-full flex items-start gap-2 cursor-pointer hover:bg-white/10 p-2 rounded-sm transition-colors text-left"
                  >
                    {/* Checkbox custom glassmorphism */}
                    <div
                      className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded-sm border-2 flex items-center justify-center transition-all duration-200 ${
                        isSelected
                          ? 'bg-emerald-400 border-emerald-400'
                          : 'bg-white/10 border-white/40'
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3 text-gray-900"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="3"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-white flex-1 leading-tight">
                      {itemTitle}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
