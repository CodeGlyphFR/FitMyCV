"use client";
import React from 'react';
import Modal from '@/components/ui/Modal';
import SectionCard from './ExportPdfModal/SectionCard';

/**
 * Modal d'export PDF avec sélection granulaire des sections
 */
export default function ExportPdfModal({
  isOpen,
  onClose,
  filename,
  setFilename,
  selections,
  toggleSection,
  toggleSubsection,
  toggleItem,
  toggleItemOption,
  selectAll,
  deselectAll,
  exportPdf,
  counters,
  subCounters,
  cvData,
  isExporting,
  t
}) {

  // Sections à afficher
  const sectionsConfig = [
    { key: 'header', name: t('exportModal.sections.header'), isHeader: true },
    { key: 'summary', name: t('exportModal.sections.summary') },
    { key: 'skills', name: t('exportModal.sections.skills') },
    { key: 'experience', name: t('exportModal.sections.experience') },
    { key: 'education', name: t('exportModal.sections.education') },
    { key: 'languages', name: t('exportModal.sections.languages') },
    { key: 'projects', name: t('exportModal.sections.projects') },
    { key: 'extras', name: t('exportModal.sections.extras') }
  ];

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={t('exportModal.title')}
      size="large"
    >
      <div className="space-y-4">
        {/* Nom du fichier */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            {t('exportModal.filename')}
          </label>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            placeholder="Mon_CV"
          />
          <p className="mt-1 text-xs text-white/60">
            {t('exportModal.filenameHint')}
          </p>
        </div>

        {/* Boutons de sélection rapide */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={selectAll}
            className="flex-1 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-sm font-medium"
          >
            {t('exportModal.selectAll')}
          </button>
          <button
            type="button"
            onClick={deselectAll}
            className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/30 text-white hover:bg-white/20 transition-colors text-sm font-medium"
          >
            {t('exportModal.deselectAll')}
          </button>
        </div>

        {/* Grille de sections */}
        <div>
          <h3 className="text-sm font-medium text-white mb-3">
            {t('exportModal.sectionsTitle')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sectionsConfig.map(({ key, name, isHeader }) => {
              const sectionData = selections.sections[key];
              return (
                <SectionCard
                  key={key}
                  sectionKey={key}
                  sectionName={name}
                  count={counters[key] || 0}
                  subCounts={subCounters[key]}
                  enabled={sectionData?.enabled || false}
                  subsections={sectionData?.subsections}
                  items={sectionData?.items}
                  itemsData={cvData?.[key]}
                  itemsOptions={sectionData?.itemsOptions}
                  onToggle={() => toggleSection(key)}
                  onToggleSubsection={toggleSubsection}
                  onToggleItem={toggleItem}
                  onToggleItemOption={toggleItemOption}
                  isHeaderSection={isHeader}
                  t={t}
                />
              );
            })}
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-white/20">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 rounded-lg bg-white/10 border border-white/30 text-white hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('exportModal.cancel')}
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={isExporting || !filename.trim()}
            className="px-6 py-2 rounded-lg bg-emerald-500 border border-emerald-400 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExporting && (
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            <span>
              {isExporting ? t('exportModal.exporting') : t('exportModal.export')}
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
