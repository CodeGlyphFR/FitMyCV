"use client";
import React from 'react';
import Modal from '@/components/ui/Modal';
import SectionCard from './ExportPdfModal/SectionCard';
import { useCreditCost } from "@/hooks/useCreditCost";
import CreditCostDisplay from "@/components/ui/CreditCostDisplay";

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
  toggleSectionOption,
  toggleItem,
  toggleItemOption,
  selectAll,
  deselectAll,
  exportPdf,
  counters,
  subCounters,
  cvData,
  isExporting,
  isPreview,
  previewHtml,
  isLoadingPreview,
  loadPreview,
  closePreview,
  t
}) {

  // Récupérer les coûts en crédits
  const { showCosts, getCost } = useCreditCost();
  const exportCost = getCost("export_cv");

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
      onClose={isPreview ? closePreview : onClose}
      title={isPreview ? t('exportModal.previewTitle') : t('exportModal.title')}
      size="large"
    >
      {isPreview ? (
        // Mode prévisualisation HTML
        <div className="space-y-4">
          {/* Iframe de prévisualisation */}
          <div className="bg-white rounded-lg overflow-hidden" style={{ height: '60vh' }}>
            <iframe
              srcDoc={previewHtml}
              title="Prévisualisation PDF"
              className="w-full h-full border-0"
              style={{ backgroundColor: 'white' }}
            />
          </div>

          {/* Footer buttons en mode prévisualisation */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={closePreview}
              className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('exportModal.backToOptions')}
            </button>
            <button
              type="button"
              onClick={exportPdf}
              disabled={isExporting || !filename.trim()}
              className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
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
      ) : (
        // Mode normal (sélection des options)
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
              className="w-full px-4 py-2 rounded-lg border border-white/20 bg-white/5 text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden"
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
              className="flex-1 px-4 py-2 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/30 transition-colors text-sm font-medium"
            >
              {t('exportModal.selectAll')}
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="flex-1 px-4 py-2 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/30 transition-colors text-sm font-medium"
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
                    sectionOptions={sectionData?.options}
                    items={sectionData?.items}
                    itemsData={cvData?.[key]}
                    itemsOptions={sectionData?.itemsOptions}
                    onToggle={() => toggleSection(key)}
                    onToggleSubsection={toggleSubsection}
                    onToggleSectionOption={toggleSectionOption}
                    onToggleItem={toggleItem}
                    onToggleItemOption={toggleItemOption}
                    isHeaderSection={isHeader}
                    t={t}
                  />
                );
              })}
            </div>
          </div>

          {/* Affichage du coût en crédits (mode crédits-only uniquement, si coût > 0) */}
          {exportCost > 0 && <CreditCostDisplay cost={exportCost} show={showCosts} />}

          {/* Footer buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting || isLoadingPreview}
              className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('exportModal.cancel')}
            </button>
            <button
              type="button"
              onClick={loadPreview}
              disabled={isExporting || isLoadingPreview || !filename.trim()}
              className="px-4 py-2.5 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/30 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoadingPreview && (
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
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>{t('exportModal.preview')}</span>
            </button>
            <button
              type="button"
              onClick={exportPdf}
              disabled={isExporting || isLoadingPreview || !filename.trim()}
              className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
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
      )}
    </Modal>
  );
}
