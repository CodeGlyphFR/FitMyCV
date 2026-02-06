"use client";

import React from "react";
import CvGeneratorModal from "../modals/CvGeneratorModal";
import PdfImportModal from "../modals/PdfImportModal";
import DeleteCvModal from "../modals/DeleteCvModal";
import BulkDeleteCvModal from "../modals/BulkDeleteCvModal";
import NewCvModal from "../modals/NewCvModal";
import ExportPdfModal from "../modals/ExportPdfModal";
import TaskQueueModal from "@/components/task-queue/TaskQueueModal";
import Modal from "@/components/ui/Modal";

/**
 * Composant pour le rendu de tous les modals du TopBar
 */
export default function TopBarModals({
  generator,
  modals,
  exportModal,
  operations,
  state,
  linkHistory,
  deleteLinkHistory,
  refreshLinkHistory,
  baseSelectorRef,
  baseDropdownRef,
  t
}) {
  return (
    <>
      <CvGeneratorModal
        open={generator.openGenerator}
        onClose={generator.closeGenerator}
        onSubmit={generator.submitGenerator}
        linkInputs={generator.linkInputs}
        updateLink={generator.updateLink}
        addLinkField={generator.addLinkField}
        removeLinkField={generator.removeLinkField}
        fileSelection={generator.fileSelection}
        onFilesChanged={generator.onFilesChanged}
        clearFiles={generator.clearFiles}
        fileInputRef={generator.fileInputRef}
        generatorBaseFile={generator.generatorBaseFile}
        setGeneratorBaseFile={generator.setGeneratorBaseFile}
        baseSelectorOpen={generator.baseSelectorOpen}
        setBaseSelectorOpen={generator.setBaseSelectorOpen}
        generatorSourceItems={generator.generatorSourceItems}
        generatorBaseItem={generator.generatorBaseItem}
        plans={generator.plans}
        generatorError={generator.generatorError}
        linkHistory={linkHistory}
        deleteLinkHistory={deleteLinkHistory}
        refreshLinkHistory={refreshLinkHistory}
        linkHistoryDropdowns={generator.linkHistoryDropdowns}
        setLinkHistoryDropdowns={generator.setLinkHistoryDropdowns}
        isSubmitting={generator.isSubmitting}
        tickerResetKey={state.tickerResetKey}
        t={t}
        baseSelectorRef={baseSelectorRef}
        baseDropdownRef={baseDropdownRef}
      />

      <PdfImportModal
        open={modals.openPdfImport}
        onClose={modals.closePdfImport}
        onSubmit={modals.submitPdfImport}
        pdfFile={modals.pdfFile}
        onPdfFileChanged={modals.onPdfFileChanged}
        pdfFileInputRef={modals.pdfFileInputRef}
        busy={modals.pdfImportBusy}
        t={t}
      />

      <DeleteCvModal
        open={modals.openDelete}
        onClose={() => modals.setOpenDelete(false)}
        onConfirm={() => {
          operations.deleteCurrent();
          modals.setOpenDelete(false);
        }}
        currentItem={state.currentItem}
        current={state.current}
        t={t}
      />

      <BulkDeleteCvModal
        open={modals.openBulkDelete}
        onClose={() => modals.setOpenBulkDelete(false)}
        onConfirm={async (selectedFiles) => {
          const result = await operations.deleteMultiple(selectedFiles);
          if (result.success) {
            modals.setOpenBulkDelete(false);
          }
          return result;
        }}
        items={state.items}
        currentFile={state.current}
        t={t}
      />

      <NewCvModal
        open={modals.openNewCv}
        onClose={() => modals.setOpenNewCv(false)}
        onCreate={modals.createNewCv}
        fullName={modals.newCvFullName}
        setFullName={modals.setNewCvFullName}
        currentTitle={modals.newCvCurrentTitle}
        setCurrentTitle={modals.setNewCvCurrentTitle}
        email={modals.newCvEmail}
        setEmail={modals.setNewCvEmail}
        error={modals.newCvError}
        setError={modals.setNewCvError}
        busy={modals.newCvBusy}
        t={t}
      />

      <TaskQueueModal
        open={modals.openTaskQueue}
        onClose={() => modals.setOpenTaskQueue(false)}
      />

      <ExportPdfModal
        isOpen={exportModal.isOpen}
        onClose={exportModal.closeModal}
        filename={exportModal.filename}
        setFilename={exportModal.setFilename}
        selections={exportModal.selections}
        toggleSection={exportModal.toggleSection}
        toggleSubsection={exportModal.toggleSubsection}
        toggleSectionOption={exportModal.toggleSectionOption}
        toggleItem={exportModal.toggleItem}
        toggleItemOption={exportModal.toggleItemOption}
        selectAll={exportModal.selectAll}
        deselectAll={exportModal.deselectAll}
        exportPdf={exportModal.exportPdf}
        exportWord={exportModal.exportWord}
        isExportingWord={exportModal.isExportingWord}
        counters={exportModal.counters}
        subCounters={exportModal.subCounters}
        cvData={exportModal.cvData}
        isExporting={exportModal.isExporting}
        isPreview={exportModal.isPreview}
        previewHtml={exportModal.previewHtml}
        isLoadingPreview={exportModal.isLoadingPreview}
        loadPreview={exportModal.loadPreview}
        closePreview={exportModal.closePreview}
        templates={exportModal.templates}
        isLoadingTemplates={exportModal.isLoadingTemplates}
        isSavingTemplate={exportModal.isSavingTemplate}
        saveAsTemplate={exportModal.saveAsTemplate}
        applyTemplate={exportModal.applyTemplate}
        deleteTemplate={exportModal.deleteTemplate}
        sectionsOrder={exportModal.sectionsOrder}
        setSectionsOrder={exportModal.setSectionsOrder}
        resetSectionsOrder={exportModal.resetSectionsOrder}
        t={t}
      />

      {/* Modal de confirmation pour génération par titre de poste */}
      <Modal
        open={modals.jobTitleConfirmModal.open}
        onClose={modals.cancelJobTitleConfirmation}
        title={t("jobTitleGenerator.confirmTitle") || "Confirmation"}
      >
        <div className="space-y-3">
          <p className="text-sm text-white drop-shadow">
            {t("jobTitleGenerator.confirmMessage", { credits: modals.jobTitleConfirmModal.creditCost }) ||
              `Cette fonctionnalité va consommer ${modals.jobTitleConfirmModal.creditCost} crédit(s). Voulez-vous continuer ?`}
          </p>
          <p className="text-xs text-white/70 drop-shadow">
            {t("jobTitleGenerator.confirmJobTitle", { jobTitle: modals.jobTitleConfirmModal.jobTitle }) ||
              `Titre de poste : "${modals.jobTitleConfirmModal.jobTitle}"`}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={modals.cancelJobTitleConfirmation}
              className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
            >
              {t("common.no") || "Non"}
            </button>
            <button
              type="button"
              onClick={modals.confirmJobTitleGeneration}
              className="px-6 py-2.5 rounded-lg bg-emerald-500/30 hover:bg-emerald-500/40 border border-emerald-500/50 text-white text-sm font-semibold transition-colors"
            >
              {t("common.yes") || "Oui"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
