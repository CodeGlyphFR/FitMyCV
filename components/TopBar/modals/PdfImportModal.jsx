import React from "react";
import Modal from "@/components/ui/Modal";

/**
 * Modal d'import de CV depuis un fichier PDF
 */
export default function PdfImportModal({
  open,
  onClose,
  onSubmit,
  pdfFile,
  onPdfFileChanged,
  pdfFileInputRef,
  t,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("pdfImport.title")}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="text-sm text-white/90 drop-shadow">
          {t("pdfImport.description")}
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t("pdfImport.pdfFile")}</div>
          <input
            ref={pdfFileInputRef}
            className="hidden"
            type="file"
            accept=".pdf"
            onChange={onPdfFileChanged}
          />
          <button
            type="button"
            onClick={() => pdfFileInputRef.current?.click()}
            className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10 hover:border-white/30 transition-all duration-200 flex items-center justify-center gap-2 group"
          >
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className="font-medium">
              {pdfFile ? pdfFile.name : t("pdfImport.selectFile")}
            </span>
          </button>
          {pdfFile ? (
            <div className="rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-2 text-xs text-white flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <div className="font-medium">{t("pdfImport.fileSelected")}</div>
                <div className="truncate opacity-80">{pdfFile.name}</div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            {t("pdfImport.cancel")}
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
            disabled={!pdfFile}
          >
            {t("pdfImport.import")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
