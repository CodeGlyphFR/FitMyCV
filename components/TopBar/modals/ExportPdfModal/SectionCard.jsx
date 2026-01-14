"use client";
import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { capitalizeSkillName } from "@/lib/utils/textFormatting";

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
 * Composant Checkbox réutilisable
 */
function Checkbox({ checked, small = false, disabled = false }) {
  const size = small ? 'w-4 h-4' : 'w-5 h-5';
  const iconSize = small ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <div
      className={`${size} flex-shrink-0 rounded border-2 flex items-center justify-center transition-all duration-200 ${
        disabled
          ? 'bg-white/5 border-white/20 opacity-40'
          : checked
            ? 'bg-emerald-400 border-emerald-400'
            : 'bg-white/10 border-white/40'
      }`}
    >
      {checked && !disabled && (
        <svg
          className={`${iconSize} text-gray-900`}
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
  );
}

/**
 * Card de section pour le modal d'export PDF avec support drag & drop
 */
export default function SectionCard({
  sectionKey,
  sectionName,
  count,
  subCounts,
  enabled,
  subsections,
  sectionOptions,
  items,
  itemsData,
  itemsOptions,
  onToggle,
  onToggleSubsection,
  onToggleSectionOption,
  onToggleItem,
  onToggleItemOption,
  isHeaderSection,
  isDraggable = true,
  isEmpty = false,
  t
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Configuration du drag & drop
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sectionKey,
    disabled: isHeaderSection || !isDraggable
  });

  const style = {
    transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
    // Aucune transition pour un réarrangement instantané sans lag
    transition: 'none',
  };

  const hasSubsections = subsections && Object.keys(subsections).length > 0;
  const hasItems = items !== undefined && itemsData && itemsData.length > 0;
  const canExpand = (hasSubsections || hasItems || sectionOptions) && enabled;

  // Compteur d'éléments sélectionnés
  const selectedItemsCount = hasItems ? items.length : null;
  const totalItemsCount = hasItems ? itemsData.length : null;

  // Texte du compteur
  const getCountText = () => {
    if (isHeaderSection) return t('exportModal.counters.always');
    if (hasItems && selectedItemsCount !== null) {
      return `${selectedItemsCount}/${totalItemsCount}`;
    }
    if (count === 0) return t('exportModal.counters.empty');
    return `${count} ${count > 1 ? t('exportModal.counters.items') : t('exportModal.counters.item')}`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-lg border transition-all duration-200 ${
        isEmpty
          ? isDragging
            ? 'border-white/30 bg-white/10 shadow-lg scale-[1.02] z-50 opacity-50'
            : 'border-white/10 bg-white/[0.02] opacity-50'
          : isDragging
          ? 'bg-emerald-500/30 border-emerald-400 shadow-lg scale-[1.02] z-50'
          : enabled
          ? 'border-emerald-400/50 bg-emerald-500/10'
          : 'border-white/20 bg-white/5 opacity-60'
      }`}
    >
      {/* Ligne principale */}
      <div className="flex items-center gap-2 p-3">
        {/* Handle de drag (masqué pour l'en-tête qui est fixe) */}
        {isDraggable && !isHeaderSection && (
          <div
            {...attributes}
            {...listeners}
            className="flex-shrink-0 p-1 rounded cursor-grab active:cursor-grabbing text-white/40 hover:text-white/70 hover:bg-white/10"
            style={{ touchAction: 'none' }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6" r="1.5" />
              <circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" />
              <circle cx="15" cy="18" r="1.5" />
            </svg>
          </div>
        )}

        {/* Checkbox + Titre */}
        <button
          type="button"
          onClick={() => !isHeaderSection && !isEmpty && onToggle()}
          disabled={isHeaderSection || isEmpty}
          className={`flex items-center gap-3 flex-1 min-w-0 text-left ${
            isHeaderSection || isEmpty ? 'cursor-default' : 'cursor-pointer'
          }`}
        >
          {!isHeaderSection && <Checkbox checked={enabled} disabled={isEmpty} />}
          <span className={`font-medium text-sm truncate ${isEmpty ? 'text-white/50' : 'text-white'}`}>
            {sectionName}
          </span>
        </button>

        {/* Compteur */}
        <span className="text-xs text-white/50 flex-shrink-0">
          {getCountText()}
        </span>

        {/* Bouton expand */}
        {canExpand && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-shrink-0 p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Contenu déplié */}
      {canExpand && isExpanded && (
        <div className="border-t border-white/10">
          {/* Options de section pour skills (en premier, avant les catégories) */}
          {sectionOptions && sectionKey === 'skills' && (
            <div className="px-3 py-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onToggleSectionOption(sectionKey, 'hideProficiency')}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                    sectionOptions.hideProficiency
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                      : 'bg-white/5 text-white/60 border border-white/10 hover:border-white/30'
                  }`}
                >
                  {t('exportModal.options.hideProficiency')}
                </button>
              </div>
            </div>
          )}

          {/* Sous-sections sous forme de pills cliquables */}
          {hasSubsections && (
            <div className={`px-3 py-3 ${sectionKey === 'skills' && sectionOptions ? 'border-t border-white/5' : ''}`}>
              <div className="flex flex-wrap gap-2">
                {Object.entries(subsections).map(([subKey, subEnabled]) => {
                  const subCount = subCounts?.[subKey] || 0;
                  const subName = t(`exportModal.subsections.${sectionKey}.${subKey}`);

                  return (
                    <button
                      key={subKey}
                      type="button"
                      onClick={() => onToggleSubsection(sectionKey, subKey)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        subEnabled
                          ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/50'
                          : 'bg-white/5 text-white/50 border border-white/10 hover:border-white/30'
                      }`}
                    >
                      {subName}
                      {subCount > 0 && <span className="ml-1 opacity-60">({subCount})</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Options de section pour experience (après les items) */}
          {sectionOptions && sectionKey === 'experience' && (
            <div className={`px-3 py-3 ${hasSubsections ? 'border-t border-white/5' : ''}`}>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onToggleSectionOption(sectionKey, 'hideDescription')}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                    sectionOptions.hideDescription
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                      : 'bg-white/5 text-white/60 border border-white/10 hover:border-white/30'
                  }`}
                >
                  {t('exportModal.options.hideDescription')}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleSectionOption(sectionKey, 'hideTechnologies')}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                    sectionOptions.hideTechnologies
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                      : 'bg-white/5 text-white/60 border border-white/10 hover:border-white/30'
                  }`}
                >
                  {t('exportModal.options.hideTechnologies')}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleSectionOption(sectionKey, 'hideDeliverables')}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                    sectionOptions.hideDeliverables
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                      : 'bg-white/5 text-white/60 border border-white/10 hover:border-white/30'
                  }`}
                >
                  {t('exportModal.options.hideDeliverables')}
                </button>
              </div>
            </div>
          )}

          {/* Liste d'éléments sous forme de cartes compactes */}
          {hasItems && (
            <div className={`px-3 py-3 ${(hasSubsections || sectionOptions) ? 'border-t border-white/5' : ''}`}>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 custom-scrollbar-light">
                {itemsData.map((item, index) => {
                  const isSelected = items.includes(index);
                  const itemTitle = formatItemTitle(item, sectionKey);

                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => onToggleItem(sectionKey, index)}
                      className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left transition-all ${
                        isSelected
                          ? 'bg-emerald-500/10 border border-emerald-400/30'
                          : 'bg-white/[0.02] border border-transparent hover:bg-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition-all ${
                        isSelected ? 'bg-emerald-500 text-white' : 'bg-white/10 border border-white/20'
                      }`}>
                        {isSelected && (
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-sm truncate ${isSelected ? 'text-white' : 'text-white/70'}`}>
                        {itemTitle}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
