"use client";
import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import SectionCard from './ExportPdfModal/SectionCard';
import { useCreditCost } from "@/hooks/useCreditCost";
import CreditCostDisplay from "@/components/ui/CreditCostDisplay";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';

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
  exportWord,
  isExportingWord,
  counters,
  subCounters,
  cvData,
  isExporting,
  isPreview,
  previewHtml,
  isLoadingPreview,
  loadPreview,
  closePreview,
  // Templates
  templates = [],
  isLoadingTemplates,
  isSavingTemplate,
  saveAsTemplate,
  applyTemplate,
  deleteTemplate,
  // Ordre des sections
  sectionsOrder = ['summary', 'skills', 'experience', 'education', 'languages', 'projects', 'extras'],
  setSectionsOrder,
  resetSectionsOrder,
  t
}) {
  // État local pour la création de template
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [templateError, setTemplateError] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);

  // Récupérer les coûts en crédits
  const { showCosts, getCost } = useCreditCost();
  const exportCost = getCost("export_cv");

  // Mapping des noms de sections
  const sectionNames = {
    header: t('exportModal.sections.header'),
    summary: t('exportModal.sections.summary'),
    skills: t('exportModal.sections.skills'),
    experience: t('exportModal.sections.experience'),
    education: t('exportModal.sections.education'),
    languages: t('exportModal.sections.languages'),
    projects: t('exportModal.sections.projects'),
    extras: t('exportModal.sections.extras')
  };

  // Vérifie si une section est vide (pas de contenu)
  const isSectionEmpty = (key) => {
    if (!counters) return false;
    if (key === 'header') return false; // header jamais vide
    return counters[key] === 0;
  };

  // Configuration des sensors pour le drag & drop (desktop + mobile/touch)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    })
  );

  // Gestionnaire de fin de drag
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    // Ne pas permettre de déplacer header
    if (active.id === 'header' || over.id === 'header') return;

    const oldIndex = sectionsOrder.indexOf(active.id);
    const newIndex = sectionsOrder.indexOf(over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(sectionsOrder, oldIndex, newIndex);
      setSectionsOrder(newOrder);
    }
  };

  // IDs pour le sortable context (header + sectionsOrder)
  const allSectionIds = ['header', ...sectionsOrder];

  return (
    <Modal
      open={isOpen}
      onClose={isPreview ? closePreview : onClose}
      title={isPreview ? t('exportModal.previewTitle') : t('exportModal.title')}
      size={isPreview ? "large" : "medium"}
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
          {/* Ligne 1: Nom du fichier */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              {t('exportModal.filename')}
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-white/20 bg-white/5 text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden"
              placeholder={t("exportModal.placeholders.filename")}
            />
          </div>

          {/* Ligne 2: Templates */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              {t('exportModal.templates.label')}
            </label>

            {showSaveInput ? (
              // Mode saisie du nom du template
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => {
                    setNewTemplateName(e.target.value);
                    setTemplateError('');
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && newTemplateName.trim()) {
                      const result = await saveAsTemplate(newTemplateName);
                      if (result.ok) {
                        setShowSaveInput(false);
                        setNewTemplateName('');
                        setTemplateError('');
                        // Sélectionner automatiquement le nouveau template
                        if (result.template?.id) {
                          setSelectedTemplateId(result.template.id);
                        }
                      } else {
                        setTemplateError(result.error);
                      }
                    } else if (e.key === 'Escape') {
                      setShowSaveInput(false);
                      setNewTemplateName('');
                      setTemplateError('');
                    }
                  }}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/20 bg-white/5 text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden"
                  placeholder={t('exportModal.templates.namePlaceholder')}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (newTemplateName.trim()) {
                      const result = await saveAsTemplate(newTemplateName);
                      if (result.ok) {
                        setShowSaveInput(false);
                        setNewTemplateName('');
                        setTemplateError('');
                        // Sélectionner automatiquement le nouveau template
                        if (result.template?.id) {
                          setSelectedTemplateId(result.template.id);
                        }
                      } else {
                        setTemplateError(result.error);
                      }
                    }
                  }}
                  disabled={!newTemplateName.trim() || isSavingTemplate}
                  className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingTemplate ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSaveInput(false);
                    setNewTemplateName('');
                    setTemplateError('');
                  }}
                  className="px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 text-sm transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              // Mode normal: dropdown + boutons
              <div className="flex gap-2">
                {/* Dropdown custom avec menu déroulant */}
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                    disabled={isLoadingTemplates || templates.length === 0}
                    className="w-full px-4 py-2 rounded-lg border border-white/20 bg-white/5 text-white transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                  >
                    <span className={selectedTemplateId ? 'text-white' : 'text-white/50'}>
                      {isLoadingTemplates
                        ? t('exportModal.templates.loading')
                        : selectedTemplateId
                          ? templates.find(t => t.id === selectedTemplateId)?.name || t('exportModal.templates.placeholder')
                          : templates.length === 0
                            ? t('exportModal.templates.noTemplates')
                            : t('exportModal.templates.placeholder')
                      }
                    </span>
                    <svg className={`w-4 h-4 text-white/50 transition-transform ${showTemplateDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showTemplateDropdown && templates.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-white/20 rounded-lg shadow-xl z-50 overflow-hidden">
                      <div className="py-1 max-h-48 overflow-y-auto custom-scrollbar">
                        {templates.map(template => (
                          <button
                            key={template.id}
                            onClick={() => {
                              setSelectedTemplateId(template.id);
                              applyTemplate(template);
                              setShowTemplateDropdown(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center justify-between ${
                              selectedTemplateId === template.id
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'text-white hover:bg-white/10'
                            }`}
                          >
                            <span>{template.name}</span>
                            {selectedTemplateId === template.id && (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bouton Réinitialiser (réapplique le template sélectionné) */}
                {selectedTemplateId && (
                  <button
                    type="button"
                    onClick={() => {
                      const template = templates.find(t => t.id === selectedTemplateId);
                      if (template) {
                        applyTemplate(template);
                      }
                    }}
                    className="px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/30 text-sm transition-colors flex items-center justify-center"
                    title={t('exportModal.order.reset')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}

                {/* Bouton Sauvegarder (avec dropdown si template sélectionné) */}
                <div className="relative flex">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedTemplateId) {
                        // Template sélectionné : afficher le dropdown
                        setShowSaveDropdown(!showSaveDropdown);
                        setShowTemplateDropdown(false);
                      } else {
                        // Pas de template sélectionné : créer nouveau directement
                        setShowSaveInput(true);
                      }
                    }}
                    className="px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/30 text-sm transition-colors flex items-center justify-center"
                    title={t('exportModal.templates.save')}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4zm-5 16a3 3 0 110-6 3 3 0 010 6zm3-10H7V5h8v4z" />
                    </svg>
                  </button>
                  {showSaveDropdown && selectedTemplateId && (
                    <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-white/20 rounded-lg shadow-xl z-50 overflow-hidden min-w-[180px]">
                      {/* Mettre à jour le template existant */}
                      <button
                        onClick={async () => {
                          const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
                          // Supprimer puis recréer pour écraser
                          await deleteTemplate(selectedTemplateId);
                          const newResult = await saveAsTemplate(selectedTemplate.name);
                          if (newResult.ok && newResult.template?.id) {
                            setSelectedTemplateId(newResult.template.id);
                          }
                          setShowSaveDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>{t('exportModal.templates.update')}</span>
                      </button>
                      {/* Créer un nouveau template */}
                      <button
                        onClick={() => {
                          setShowSaveDropdown(false);
                          setShowSaveInput(true);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>{t('exportModal.templates.createNew')}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Bouton Supprimer (supprime le template sélectionné) */}
                {selectedTemplateId && (
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteTemplate(selectedTemplateId);
                      setSelectedTemplateId('');
                    }}
                    className="px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-red-500/20 hover:border-red-400/50 text-sm transition-colors flex items-center justify-center"
                    title={t('exportModal.templates.delete')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1.1.2.00-1-1h-4a1.1.2.00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {templateError && (
              <p className="mt-1 text-xs text-red-400">{templateError}</p>
            )}
          </div>

          {/* Boutons de sélection rapide */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="flex-1 px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/30 transition-colors text-sm"
            >
              {t('exportModal.selectAll')}
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="flex-1 px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/30 transition-colors text-sm"
            >
              {t('exportModal.deselectAll')}
            </button>
          </div>

          {/* Liste des sections avec drag & drop */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white">
                {t('exportModal.sectionsTitle')}
              </h3>
              <p className="text-xs text-white/50">
                {t('exportModal.order.hint')}
              </p>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            >
              <SortableContext
                items={allSectionIds}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {/* Header en premier (non déplaçable) */}
                  <SectionCard
                    key="header"
                    sectionKey="header"
                    sectionName={sectionNames.header}
                    count={counters.header || 0}
                    subCounts={subCounters.header}
                    enabled={selections.sections.header?.enabled || false}
                    subsections={selections.sections.header?.subsections}
                    sectionOptions={selections.sections.header?.options}
                    items={selections.sections.header?.items}
                    itemsData={cvData?.header}
                    itemsOptions={selections.sections.header?.itemsOptions}
                    onToggle={() => toggleSection('header')}
                    onToggleSubsection={toggleSubsection}
                    onToggleSectionOption={toggleSectionOption}
                    onToggleItem={toggleItem}
                    onToggleItemOption={toggleItemOption}
                    isHeaderSection={true}
                    isDraggable={true}
                    t={t}
                  />

                  {/* Sections triables */}
                  {sectionsOrder.map((key) => {
                    const sectionData = selections.sections[key];
                    return (
                      <SectionCard
                        key={key}
                        sectionKey={key}
                        sectionName={sectionNames[key]}
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
                        isHeaderSection={false}
                        isDraggable={true}
                        isEmpty={isSectionEmpty(key)}
                        t={t}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Affichage du coût en crédits */}
          {exportCost > 0 && <CreditCostDisplay cost={exportCost} show={showCosts} />}

          {/* Footer buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            {/* Bouton Annuler masqué sur mobile (la croix suffit) */}
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting || isLoadingPreview}
              className="hidden sm:block px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            {/* Bouton Export Word */}
            <button
              type="button"
              onClick={exportWord}
              disabled={isExporting || isExportingWord || isLoadingPreview || !filename.trim()}
              className="px-4 py-2.5 rounded-lg border border-blue-400/50 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:border-blue-400 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isExportingWord && (
                <svg
                  className="animate-spin h-4 w-4"
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
  <span>Word</span>
            </button>
            {/* Bouton Export PDF */}
            <button
              type="button"
              onClick={exportPdf}
              disabled={isExporting || isExportingWord || isLoadingPreview || !filename.trim()}
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
                {isExporting ? t('exportModal.exporting') : 'PDF'}
              </span>
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
