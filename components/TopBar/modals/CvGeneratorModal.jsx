"use client";

import React from "react";
import Image from "next/image";
import Modal from "@/components/ui/Modal";
import { getCvIcon } from "../utils/cvUtils";
import DefaultCvIcon from "@/components/ui/DefaultCvIcon";
import ItemLabel from "../components/ItemLabel";
import { CREATE_TEMPLATE_OPTION } from "../utils/constants";
import { useCreditCost } from "@/hooks/useCreditCost";
import CreditCostDisplay from "@/components/ui/CreditCostDisplay";
import { LANGUAGE_FLAGS } from "@/lib/cv-core/language/languageConstants";
import { ChevronRight } from "lucide-react";

/**
 * Modal de génération de CV à partir d'une offre d'emploi
 */
export default function CvGeneratorModal({
  open,
  onClose,
  onSubmit,
  linkInputs,
  updateLink,
  addLinkField,
  removeLinkField,
  fileSelection,
  onFilesChanged,
  clearFiles,
  fileInputRef,
  generatorBaseFile,
  setGeneratorBaseFile,
  baseSelectorOpen,
  setBaseSelectorOpen,
  generatorSourceItems,
  generatorBaseItem,
  generatorError,
  linkHistory,
  deleteLinkHistory,
  refreshLinkHistory,
  linkHistoryDropdowns,
  setLinkHistoryDropdowns,
  isSubmitting,
  tickerResetKey,
  t,
  baseSelectorRef,
  baseDropdownRef,
  extensionDetected,
  onOpenExtensionTutorial,
}) {
  // Récupérer les coûts en crédits
  const { showCosts, getCost } = useCreditCost();

  // Calculer le coût total (liens non vides + fichiers)
  const linkCount = linkInputs.filter((l) => l.trim() !== "").length;
  const fileCount = (fileSelection || []).length;
  const totalOperations = Math.max(linkCount + fileCount, 1);
  const unitCost = getCost("gpt_cv_generation");
  const totalCost = unitCost * totalOperations;
  const costDetail = totalOperations > 1 ? `${totalOperations} × ${unitCost}` : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("cvGenerator.title")}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="text-sm text-white/90 drop-shadow bg-emerald-500/10 border border-emerald-500/50 rounded-lg p-3 text-justify">
          {t("cvGenerator.description")}
        </div>

        {!extensionDetected && onOpenExtensionTutorial && (
          <button
            type="button"
            onClick={onOpenExtensionTutorial}
            className="w-full flex items-center gap-3 rounded-lg border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 px-3 py-2.5 text-left transition-colors group"
          >
            <img src="/icons/extension-brain.png" alt="" className="w-8 h-8 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-sky-300">{t("extensionPromo.installButton")}</div>
              <div className="text-xs text-white/50 mt-0.5">{t("extensionPromo.installButtonHint")}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-sky-400/60 shrink-0" />
          </button>
        )}

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t("cvGenerator.referenceCV")}</div>
          <div className="relative" ref={baseSelectorRef}>
            <button
              type="button"
              onClick={() => setBaseSelectorOpen((prev) => !prev)}
              className="w-full min-w-0 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm flex items-center justify-between gap-3 text-white transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden"
            >
              <span className="flex items-center gap-3 min-w-0 overflow-hidden">
                {generatorBaseFile === CREATE_TEMPLATE_OPTION ? (
                  <>
                    <span className="flex h-6 w-6 items-center justify-center shrink-0">
                      <span className="text-lg">✨</span>
                    </span>
                    <span className="font-medium text-emerald-300">
                      {t("cvGenerator.createTemplateOption")}
                    </span>
                  </>
                ) : generatorBaseItem ? (
                  <>
                    <span
                      key={`gen-base-icon-${generatorBaseFile}-${generatorBaseItem.createdBy}`}
                      className="flex h-6 w-6 items-center justify-center shrink-0"
                    >
                      {getCvIcon(generatorBaseItem.createdBy, generatorBaseItem.originalCreatedBy, "h-4 w-4", generatorBaseItem.isTranslated) || <DefaultCvIcon className="h-4 w-4" size={16} />}
                    </span>
                    <span className="min-w-0">
                      <ItemLabel
                        item={generatorBaseItem}
                        withHyphen={false}
                        tickerKey={tickerResetKey}
                        showLanguageFlag={true}
                        t={t}
                      />
                    </span>
                  </>
                ) : (
                  <span className="truncate italic text-neutral-500">
                    {t("cvGenerator.selectCV")}
                  </span>
                )}
              </span>
              <span className="text-xs opacity-60">▾</span>
            </button>
            {baseSelectorOpen ? (
              <div
                ref={baseDropdownRef}
                className="absolute z-10 mt-1 w-full rounded-lg border-2 border-white/30 bg-slate-900/95 backdrop-blur-3xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar"
                style={{ backdropFilter: 'blur(40px)' }}
              >
                <ul className="py-1">
                  <li key={CREATE_TEMPLATE_OPTION}>
                    <button
                      type="button"
                      onClick={() => {
                        setGeneratorBaseFile(CREATE_TEMPLATE_OPTION);
                        setBaseSelectorOpen(false);
                      }}
                      className={`w-full px-3 py-1 text-left text-sm flex items-center gap-3 text-white transition-colors duration-200 hover:bg-white/25 ${CREATE_TEMPLATE_OPTION === generatorBaseFile ? "bg-white/20" : ""}`}
                    >
                      <span className="flex h-6 w-6 items-center justify-center shrink-0">
                        <span className="text-lg">✨</span>
                      </span>
                      <span className="font-medium text-emerald-300">
                        {t("cvGenerator.createTemplateOption")}
                      </span>
                    </button>
                  </li>
                  {generatorSourceItems.length > 0 && (
                    <li className="my-1 border-t border-white/20"></li>
                  )}
                  {generatorSourceItems.map((item) => (
                    <li key={item.file}>
                      <button
                        type="button"
                        onClick={() => {
                          setGeneratorBaseFile(item.file);
                          setBaseSelectorOpen(false);
                        }}
                        className={`w-full px-3 py-1 text-left text-sm flex items-center gap-3 text-white transition-colors duration-200 hover:bg-white/25 ${item.file === generatorBaseFile ? "bg-white/20" : ""}`}
                      >
                        <span
                          key={`gen-dropdown-icon-${item.file}-${item.createdBy}`}
                          className="flex h-6 w-6 items-center justify-center shrink-0"
                        >
                          {getCvIcon(item.createdBy, item.originalCreatedBy, "h-4 w-4", item.isTranslated) || <DefaultCvIcon className="h-4 w-4" size={16} />}
                        </span>
                        <ItemLabel
                          item={item}
                          className="leading-tight"
                          withHyphen={false}
                          tickerKey={tickerResetKey}
                          showLanguageFlag={true}
                          t={t}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t("cvGenerator.links")}</div>
          {linkInputs.map((value, index) => (
            <div key={index} className="flex gap-2">
              <div className="relative">
                <button
                  type="button"
                  data-link-history-dropdown="true"
                  onClick={() => {
                    const isOpening = !linkHistoryDropdowns[index];
                    if (isOpening && refreshLinkHistory) {
                      refreshLinkHistory();
                    }
                    setLinkHistoryDropdowns(prev => ({
                      ...prev,
                      [index]: !prev[index]
                    }));
                  }}
                  className="h-full rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-xs text-white hover:bg-white/10 hover:border-white/30 transition-colors duration-200 disabled:opacity-50"
                  title={t("cvGenerator.loadRecentLink")}
                >
                  📋
                </button>
                {linkHistoryDropdowns[index] && linkHistory.length > 0 && (
                  <div
                    data-link-history-dropdown="true"
                    className="absolute left-0 top-full mt-1 w-80 max-h-48 overflow-y-auto scrollbar-hidden bg-slate-900/95 backdrop-blur-3xl border-2 border-white/30 rounded-lg shadow-2xl z-10"
                    style={{ backdropFilter: 'blur(40px)' }}
                  >
                    <div className="p-2 border-b border-white/20 bg-white/10 text-xs font-medium text-white drop-shadow">
                      {t("cvGenerator.recentLinks")}
                    </div>
                    <ul className="py-1">
                      {linkHistory.map((linkItem, histIndex) => {
                        // linkItem est maintenant un objet {url, title, company, language, domain}
                        const url = typeof linkItem === 'string' ? linkItem : linkItem.url;
                        const title = typeof linkItem === 'object' ? linkItem.title : null;
                        const company = typeof linkItem === 'object' ? linkItem.company : null;
                        const language = typeof linkItem === 'object' ? linkItem.language : null;
                        const domain = typeof linkItem === 'object' ? linkItem.domain : null;

                        // Formater l'affichage: "Titre (Compagnie)" ou "Titre (Domaine)" ou juste le lien
                        let displayText;
                        if (title) {
                          // Tronquer le titre à 35 caractères
                          const truncatedTitle = title.length > 35 ? title.slice(0, 32) + '...' : title;
                          // Utiliser company en priorité, sinon domain en fallback
                          const suffix = company || domain;
                          displayText = suffix ? `${truncatedTitle} (${suffix})` : truncatedTitle;
                        } else {
                          // Fallback: juste le lien
                          displayText = url;
                        }

                        // Drapeau basé sur la langue de l'offre
                        const flagPath = language ? LANGUAGE_FLAGS[language] : null;

                        return (
                          <li key={histIndex} className="flex items-center">
                            <button
                              type="button"
                              onClick={() => {
                                updateLink(url, index);
                                setLinkHistoryDropdowns(prev => ({
                                  ...prev,
                                  [index]: false
                                }));
                              }}
                              className="flex-1 flex items-center gap-2 px-3 py-2 text-left text-xs text-white hover:bg-white/25 truncate transition-colors duration-200"
                              title={url}
                            >
                              {flagPath && (
                                <Image
                                  src={flagPath}
                                  alt={language}
                                  width={16}
                                  height={12}
                                  className="shrink-0"
                                />
                              )}
                              <span className="truncate">{displayText}</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (linkItem.id) {
                                  deleteLinkHistory(linkItem.id);
                                }
                              }}
                              className="px-2 py-2 text-white/50 hover:text-red-400 hover:bg-white/10 transition-colors duration-200"
                              title={t("topbar.delete")}
                            >
                              ✕
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
              <input
                className="flex-1 min-w-0 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden"
                placeholder={t("cvGenerator.linkPlaceholder")}
                value={value}
                onChange={(event) => updateLink(event.target.value, index)}
              />
              <button
                type="button"
                onClick={() => removeLinkField(index)}
                className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-xs text-white hover:bg-white/10 hover:border-white/30 transition-colors duration-200"
                title={t("topbar.delete")}
              >
                ✕
              </button>
            </div>
          ))}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={addLinkField}
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 hover:border-white/30 transition-colors duration-200 inline-flex items-center gap-1"
            >
              <img src="/icons/add.svg" alt="" className="h-3 w-3 " /> {t("cvGenerator.addLink")}
            </button>
          </div>
          <p className="text-xs text-amber-300/80 flex items-start gap-1.5">
            <span>⚠️</span>
            <span>{t("cvGenerator.languageHint")}</span>
          </p>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t("cvGenerator.files")}</div>
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept=".pdf,.doc,.docx"
            multiple
            onChange={onFilesChanged}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10 hover:border-white/30 transition-colors duration-200 flex items-center justify-center gap-2 group"
          >
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className="font-medium">
              {(fileSelection || []).length > 0 ? `${(fileSelection || []).length} fichier${(fileSelection || []).length > 1 ? 's' : ''} sélectionné${(fileSelection || []).length > 1 ? 's' : ''}` : t("pdfImport.selectFile")}
            </span>
          </button>
          {(fileSelection || []).length ? (
            <div className="rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-2 text-xs space-y-1">
              <div className="font-medium text-white drop-shadow flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1.1.2.010 1.414l-8 8a1.1.2.01-1.414 0l-4-4a1.1.2.011.414-1.414L8 12.586l7.293-7.293a1.1.2.011.414 0z" clipRule="evenodd" />
                </svg>
                {t("cvGenerator.selection")}
              </div>
              {(fileSelection || []).map((file, idx) => (
                <div key={idx} className="truncate text-white/90">
                  {file.name}
                </div>
              ))}
              <button
                type="button"
                onClick={clearFiles}
                className="mt-1 rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-xs text-white hover:bg-white/10 hover:border-white/30 transition-colors duration-200"
              >
                {t("cvGenerator.clearFiles")}
              </button>
            </div>
          ) : null}
        </div>

        {generatorError ? (
          <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {generatorError}
          </div>
        ) : null}

        {/* Affichage du coût en crédits (mode crédits-only uniquement) */}
        <CreditCostDisplay
          cost={totalCost}
          show={showCosts}
          detail={costDetail}
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            {t("cvGenerator.cancel")}
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={!generatorBaseFile || isSubmitting}
          >
            {isSubmitting ? t("cvGenerator.submitting") : t("cvGenerator.validate")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
